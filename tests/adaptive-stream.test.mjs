import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { MacStream } from "../packages/macos/stream.mjs";
import { nextQuality, retryDelay } from "../apps/client/src/connection.mjs";

test("weak connections reduce picture quality promptly and recover gradually", () => {
  let quality = nextQuality({ level: 2, good: 0 }, 1000);
  assert.equal(quality.level, 1);
  quality = nextQuality(quality, 0, true);
  assert.equal(quality.level, 0);
  for (let count = 0; count < 23; count++) quality = nextQuality(quality, 90);
  assert.equal(quality.level, 0);
  assert.equal(nextQuality(quality, 90).level, 1);
  assert.equal(
    retryDelay(2, () => 0.5),
    3000,
  );
  assert.equal(
    retryDelay(40, () => 0.5),
    15000,
  );
});

class Response extends EventEmitter {
  writeHead(status, headers) {
    Object.assign(this, { status, headers });
  }
  end(body) {
    this.body = body;
    this.writableEnded = true;
    this.emit("close");
  }
}

test("sampled video waits for a new frame and closes old requests on window switch", (t) => {
  const stream = new MacStream("/tmp");
  t.after(() => stream.stop());
  stream.measured = Date.now();
  stream.count = 0;
  stream.frame(Buffer.from("first"), "image/jpeg");
  const initial = new Response();
  stream.sample(initial, 1, 0);
  assert.equal(initial.body.toString(), "first");
  const next = new Response();
  stream.sample(next, 0, Number(initial.headers["X-Skyrail-Frame"]));
  assert.equal(next.status, undefined);
  stream.frame(Buffer.from("next"), "image/jpeg");
  assert.equal(next.body.toString(), "next");
  const waiting = new Response();
  stream.sample(waiting, 0, Number(next.headers["X-Skyrail-Frame"]));
  stream.select("different-app", 5);
  assert.equal(waiting.status, 503);
  assert.equal(waiting.body, undefined);
});

test("message paging preserves every entry in order across bounded wire windows", () => {
  const transcript = Array.from({ length: 97 }, (_, id) => ({
    id: String(id),
    text: "早期记录 ".repeat(180),
  }));
  const read = [];
  let before;
  do {
    const page = messageWindow(transcript, before);
    assert.ok(page.messages.length > 0 && page.messages.length <= 32);
    read.unshift(...page.messages);
    before = page.hasEarlier ? page.messages[0].id : undefined;
  } while (before);
  assert.deepEqual(read, transcript);
});

import { messageWindow } from "../packages/codex/message-window.mjs";
