import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitorChatStream } from '../apps/client/src/connection.mjs';

function fixture() {
  const source = new EventTarget(), tasks = new Map();
  let now = 0, next = 0, failures = 0;
  const stop = monitorChatStream(source, () => failures++, {
    setTimer(fn, ms) { const id = ++next; tasks.set(id, { at: now + ms, fn }); return id; },
    clearTimer(id) { tasks.delete(id); },
  });
  return { source, stop, get failures() { return failures; },
    advance(ms) {
      now += ms;
      for (const [id, task] of [...tasks]) if (task.at <= now) { tasks.delete(id); task.fn(); }
    }, get timers() { return tasks.size; } };
}
test('an idle chat remains healthy through named heartbeats, without receiving duplicate snapshots', () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) {
    f.advance(15000); f.source.dispatchEvent(new Event('heartbeat'));
  }
  assert.equal(f.failures, 0); assert.equal(f.timers, 1);
  f.stop(); assert.equal(f.timers, 0);
});
test('silent network loss triggers exactly one recovery after three missed heartbeats', () => {
  const f = fixture();
  f.advance(44000); assert.equal(f.failures, 0);
  f.advance(1000); assert.equal(f.failures, 1);
  f.source.dispatchEvent(new Event('heartbeat'));
  f.advance(90000); assert.equal(f.failures, 1); assert.equal(f.timers, 0);
});
test('snapshot and stream traffic refresh liveness and old subscriptions cannot trigger recovery', () => {
  const f = fixture();
  f.advance(30000); f.source.dispatchEvent(new Event('message'));
  f.advance(30000); f.source.dispatchEvent(new Event('stream'));
  f.advance(30000); assert.equal(f.failures, 0);
  f.stop(); f.advance(90000); assert.equal(f.failures, 0);
  f.source.dispatchEvent(new Event('message')); assert.equal(f.timers, 0);
});
