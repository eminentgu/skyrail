import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  desktopEncodings, desktopProfiles, nextDesktopProfile,
} from "../apps/client/src/desktop-stream.mjs";

function fixture() {
  const requests = [], timers = new Map();
  let now = 0, id = 0;
  class FakeRFB extends EventTarget {
    constructor() {
      super();
      this._sock = {};
      this._fbWidth = 1920;
      this._fbHeight = 1080;
      this._fbDepth = 24;
      this._FBU = { encoding: 21 };
      this._qualityLevel = 3;
      this._compressionLevel = 8;
      this._rfbConnectionState = "connected";
      this.complete = true;
    }
    _framebufferUpdate() { return this.complete; }
    _normalMsg() {
      const done = this._framebufferUpdate();
      if (done && !this._enabledContinuousUpdates)
        FakeRFB.messages.fbUpdateRequest(this._sock);
      return done;
    }
    _handleRect() { return true; }
    _disconnect() { this._rfbConnectionState = "disconnected"; }
    set qualityLevel(value) { this._qualityLevel = value; }
    set compressionLevel(value) { this._compressionLevel = value; }
  }
  FakeRFB.messages = {
    fbUpdateRequest: (...args) => requests.push(args),
    clientEncodings: (_socket, list) => { FakeRFB.lastEncodings = list; },
    enableContinuousUpdates: (_socket, enabled) => { FakeRFB.continuous = enabled; },
  };
  const source = readFileSync(new URL("../apps/client/src/desktop-rfb.mjs", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace("export default class DesktopRFB", "globalThis.DesktopRFB = class DesktopRFB");
  const context = {
    RFB: FakeRFB, desktopEncodings, desktopProfiles, nextDesktopProfile,
    Event, EventTarget,
    CustomEvent: class extends Event { constructor(name, options) { super(name); this.detail = options.detail; } },
    performance: { now: () => now },
    setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id; },
    clearTimeout: timer => timers.delete(timer),
  };
  vm.runInNewContext(source, context);
  const client = new context.DesktopRFB();
  return {
    client, requests, timers, FakeRFB,
    advance(ms) { now += ms; },
    flush() {
      const pending = [...timers.values()];
      timers.clear();
      for (const timer of pending) timer.callback();
    },
  };
}

test("whole-desktop profiles request lossy coding before lossless and omit unsolicited continuous updates", () => {
  const encodings = desktopEncodings(24, 0, 9);
  assert.ok(encodings.indexOf(21) < encodings.indexOf(16));
  assert.ok(encodings.indexOf(21) < encodings.indexOf(7));
  assert.ok(encodings.includes(-32));
  assert.ok(encodings.includes(-247));
  assert.equal(encodings.includes(-313), false);
  assert.equal(encodings.includes(50), false);
  assert.equal(new Set(encodings).size, encodings.length);
});

test("slow whole-desktop frames reduce quality and request rate with gradual recovery", () => {
  const f = fixture();
  f.client.complete = false;
  assert.equal(f.client._normalMsg(), false);
  assert.equal(f.requests.length, 0);
  f.advance(500);
  f.client.complete = true;
  f.client._normalMsg();
  assert.equal(f.client._skyrailProfile.level, 0);
  assert.equal(f.client._qualityLevel, 0);
  assert.equal(f.client._compressionLevel, 9);
  assert.equal(f.requests.length, 0, "upstream must not send an immediate unpaced request");
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 200);
  f.flush();
  assert.equal(f.requests.length, 1);
  let profile = { level: 0, good: 0 };
  for (let i = 0; i < 29; i++) profile = nextDesktopProfile(profile, 40);
  assert.equal(profile.level, 0);
  profile = nextDesktopProfile(profile, 40);
  assert.equal(profile.level, 1);
});

test("folding the whole-desktop viewer pauses frame requests without disconnecting input transport", () => {
  const f = fixture();
  f.client._normalMsg();
  f.client.setStreamVisible(false);
  assert.equal(f.timers.size, 0);
  f.flush();
  assert.equal(f.requests.length, 0);
  assert.equal(f.client._rfbConnectionState, "connected");
  f.client.setStreamVisible(true);
  f.client.setStreamVisible(true);
  assert.equal(f.timers.size, 1);
  f.client._disconnect();
  f.flush();
  assert.equal(f.requests.length, 0);
});

test("whole-desktop negotiation handles an unsolicited continuous-update capability and records the actual pixel encoding", () => {
  const f = fixture();
  f.client._sendEncodings();
  assert.equal(f.FakeRFB.lastEncodings.includes(-313), false);
  f.client._supportsContinuousUpdates = true;
  f.client._updateContinuousUpdates();
  assert.equal(f.FakeRFB.continuous, false);
  f.client._handleRect();
  assert.equal(f.client._skyrailEncoding, 21);
});

test("fast control heartbeats cannot undo a slow-frame downgrade", () => {
 const f=fixture();f.client.setStreamMode('auto');
 f.client.complete=false;f.client._normalMsg();f.advance(700);f.client.complete=true;f.client._normalMsg();
 for(let i=0;i<5;i++)f.client.reportNetworkSample(20);
 assert.equal(f.client._skyrailProfile.level,0);
 for(let i=0;i<30;i++)f.client._normalMsg();
 assert.equal(f.client._skyrailProfile.level,0,'congestion cooldown prevents oscillation');
 f.advance(12001);for(let i=0;i<30;i++)f.client._normalMsg();
 assert.equal(f.client._skyrailProfile.level,1);
 f.client.reportNetworkSample(600);assert.equal(f.client._skyrailProfile.level,0);
});

test("manual high and connection-first modes stay fixed across congestion and recovery", () => {
 const f=fixture();
 f.client.setStreamMode('high');f.client.reportNetworkSample(900,true);
 f.client.complete=false;f.client._normalMsg();f.advance(1000);f.client.complete=true;f.client._normalMsg();
 assert.equal(f.client._qualityLevel,8);assert.equal(f.client._skyrailProfile.level,2);
 f.client.setStreamMode('smooth');f.client.setStreamLevel(2);
 for(let i=0;i<60;i++)f.client._normalMsg();
 assert.equal(f.client._skyrailProfile.level,0);assert.equal(f.client._qualityLevel,0);
 f.client.setStreamMode('auto');assert.equal(f.client._skyrailProfile.level,1);
});
