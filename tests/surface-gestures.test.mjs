import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SurfaceGestures,
  zoomTransform,
  keepPointVisible,
} from "../apps/client/src/surface-gestures.mjs";
function setup(mode = "trackpad") {
  let now = 0;
  const sent = [],
    views = [],
    cursors = [];
  const g = new SurfaceGestures({
    mode,
    clock: () => now,
    frame: () => ({ left: 20, top: 40, width: 400, height: 200 }),
    send: (a) => sent.push(a),
    cursor: (p) => cursors.push(p),
    transform: (...a) => views.push(a),
  });
  return { g, sent, views, cursors, time: (v) => (now = v) };
}
test("trackpad movement changes cursor without pressing a remote button", () => {
  const { g, sent } = setup();
  g.down(1, 100, 100);
  g.move(1, 140, 120);
  g.up(1, 140, 120);
  assert.equal(sent.length, 1);
  assert.deepEqual(
    [sent[0].x, sent[0].y, sent[0].kind, sent[0].dragging],
    [0.6, 0.6, "move", false],
  );
});
test("touchpad tap clicks at cursor, independent of finger location", () => {
  const { g, sent } = setup();
  g.down(1, 40, 60);
  g.up(1, 40, 60);
  assert.deepEqual([sent[0].kind, sent[0].x, sent[0].y], ["tap", 0.5, 0.5]);
});
test("direct mode maps transformed image coordinates", () => {
  const { g, sent } = setup("direct");
  g.down(1, 120, 90);
  g.up(1, 120, 90);
  assert.deepEqual([sent[0].x, sent[0].y], [0.25, 0.25]);
});
test("double tap emits two clicks and second clickCount 2", () => {
  const { g, sent, time } = setup();
  g.down(1, 100, 100);
  g.up(1, 100, 100);
  time(150);
  g.down(2, 100, 100);
  g.up(2, 100, 100);
  assert.deepEqual(
    sent.map((a) => [a.kind, a.clickCount]),
    [
      ["tap", 1],
      ["tap", 2],
    ],
  );
});
test("double tap and drag holds then releases button", () => {
  const { g, sent, time } = setup();
  g.down(1, 100, 100);
  g.up(1, 100, 100);
  time(150);
  g.down(2, 100, 100);
  g.move(2, 180, 100);
  g.up(2, 180, 100);
  assert.deepEqual(
    sent.map((a) => a.kind),
    ["tap", "down", "move", "up"],
  );
  assert.equal(sent[2].dragging, true);
  assert.equal(g.held, false);
});
test("pinch changes view only, including remaining finger lift", () => {
  const { g, sent, views } = setup();
  g.down(1, 100, 100);
  g.down(2, 200, 100);
  g.move(2, 250, 100);
  g.up(2, 250, 100);
  g.move(1, 80, 100);
  g.up(1, 80, 100);
  assert.equal(sent.length, 0);
  assert.equal(views[0][0], 1.5);
  assert.equal(views[0][1], 25);
});
test("second finger releases an active drag before view gestures", () => {
  const { g, sent, time } = setup();
  g.down(1, 100, 100);
  g.up(1, 100, 100);
  time(150);
  g.down(2, 100, 100);
  g.move(2, 120, 100);
  g.down(3, 200, 100);
  assert.equal(sent.at(-1).kind, "up");
  assert.equal(g.held, false);
});
test("cancel releases held input, clears tap history and pointers", () => {
  const { g, sent } = setup();
  g.down(1, 100, 100, "mouse");
  g.cancel();
  g.up(1, 100, 100);
  assert.deepEqual(
    sent.map((a) => a.kind),
    ["down", "up"],
  );
  assert.equal(g.has(1), false);
});
test("long touch never becomes an unintended click", () => {
  const { g, sent, time } = setup();
  g.down(1, 100, 100);
  time(800);
  g.up(1, 100, 100);
  assert.equal(sent.length, 0);
});
test("cursor stays in image boundaries", () => {
  const { g } = setup();
  g.down(1, 100, 100);
  g.move(1, 5000, -1000);
  assert.deepEqual(g.position, { x: 1, y: 0 });
});
test("zoom keeps anchor stable and clamps scale and panning", () => {
  assert.deepEqual(
    zoomTransform({ scale: 1, x: 0, y: 0 }, 400, 200, 2, 0, 0, 200, 100),
    { scale: 2, x: -200, y: -100 },
  );
  assert.deepEqual(
    zoomTransform(
      { scale: 2, x: -200, y: -100 },
      400,
      200,
      0.1,
      999,
      999,
      200,
      100,
    ),
    { scale: 1, x: 0, y: 0 },
  );
  assert.equal(
    zoomTransform({ scale: 4, x: 0, y: 0 }, 400, 200, 2, 0, 0, 0, 0).scale,
    4,
  );
});

test("pinch immediately after tap does not become a second click", () => {
  const { g, sent, time } = setup();
  g.down(1, 100, 100);
  g.up(1, 100, 100);
  time(100);
  g.down(1, 100, 100);
  g.down(2, 200, 100);
  g.move(2, 240, 100);
  g.up(2, 240, 100);
  g.up(1, 100, 100);
  assert.deepEqual(
    sent.map((a) => a.kind),
    ["tap"],
  );
});

test("zoomed trackpad view follows cursor without changing remote point", () => {
  const next = keepPointVisible(
    { scale: 2, x: -180, y: -100 },
    { left: -165, top: 200, width: 720, height: 440 },
    { left: 15, top: 100, width: 360, height: 532 },
    { x: 0.95, y: 0.5 },
  );
  assert.deepEqual(next, { scale: 2, x: -352, y: -100 });
});
