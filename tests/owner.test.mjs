import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inspectWriter,
  stopWriter,
  isWriterConflict,
} from "../packages/codex/owner.mjs";
const thread = "11111111-1111-1111-1111-111111111111";
test("owner inspection reports shared Codex process scope with stable fingerprint", async () => {
  const run = async (command, args) => {
    if (command.endsWith("ps"))
      return args.includes("lstart=")
        ? "Tue Nov 3 10:00:00 2026"
        : "501 /Applications/ChatGPT.app/codex codex app-server --listen stdio://";
    if (args.includes("-Fpc")) return "p12345\nccodex\nf2";
    return (
      "n/locks/" +
      thread +
      ".lock\nn/locks/22222222-2222-2222-2222-222222222222.lock"
    );
  };
  const owner = await inspectWriter(thread, {
    run,
    lockRoot: "/locks",
    uid: 501,
  });
  assert.equal(owner.sessionCount, 2);
  assert.equal(owner.canStop, true);
  assert.equal(owner.client, "Codex 桌面端");
  assert.equal(owner.fingerprint.length, 64);
});
test("inspection never authorizes another user or a non-Codex service", async () => {
  const run = async (command, args) =>
    command.endsWith("ps")
      ? args.includes("lstart=")
        ? "start"
        : "0 /bin/service service"
      : args.includes("-Fpc")
        ? "p12345"
        : "n/locks/" + thread + ".lock";
  const owner = await inspectWriter(thread, {
    run,
    lockRoot: "/locks",
    uid: 501,
  });
  assert.equal(owner.canStop, false);
});
test("ending a connection rechecks identity before issuing SIGTERM", async () => {
  const killed = [];
  let checks = 0;
  const inspect = async () =>
    ++checks === 1
      ? { occupied: true, pid: 234, canStop: true, fingerprint: "same" }
      : { occupied: false };
  assert.deepEqual(
    await stopWriter(thread, "same", {
      inspect,
      kill: (pid) => killed.push(pid),
      wait: async () => {},
    }),
    { released: true },
  );
  assert.deepEqual(killed, [234]);
});
test("changed scope or untrusted owner is never terminated", async () => {
  for (const owner of [
    { occupied: true, pid: 234, canStop: true, fingerprint: "new" },
    { occupied: true, pid: 234, canStop: false, fingerprint: "old" },
  ])
    await assert.rejects(
      stopWriter(thread, "old", {
        inspect: async () => owner,
        kill: () => assert.fail("must not kill"),
      }),
      (e) => e.status === 409,
    );
});
test("a replacement owner after termination is reported, never killed", async () => {
  let n = 0,
    kills = 0;
  await assert.rejects(
    stopWriter(thread, "ok", {
      inspect: async () => ({
        occupied: true,
        pid: ++n === 1 ? 234 : 235,
        canStop: true,
        fingerprint: "ok",
      }),
      kill: () => kills++,
      wait: async () => {},
    }),
    /另一连接/,
  );
  assert.equal(kills, 1);
});
test("writer error detection recognizes current and historical messages only", () => {
  assert.equal(
    isWriterConflict(Error("thread already has an active writer")),
    true,
  );
  assert.equal(isWriterConflict("这个 Codex 会话仍由另一客户端占用"), true);
  assert.equal(isWriterConflict(Error("network timeout")), false);
});
