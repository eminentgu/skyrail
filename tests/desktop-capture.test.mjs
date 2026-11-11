import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../apps/client/src/useDesktopCapture.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

// Execute the actual hook with an effect scheduler. Events exercise focus and
// Escape behavior without requiring a live Mac control lease in CI.
function captureFixture({ desktop = true, enabled = true } = {}) {
  const document = new EventTarget(), window = new EventTarget(), media = new EventTarget();
  document.hidden = false;
  media.matches = desktop;
  const slots = [], frames = new Map(), effects = [];
  let cursor = 0, dirty = true, frameId = 0, output;
  let focusCount = 0, releases = 0, exits = 0;
  const remote = new EventTarget();
  const input = {
    enabled,
    focus: () => { focusCount++; },
    ownsFocus: target => target === remote,
    releaseInput: () => { releases++; },
    exit: () => { exits++; },
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, value => {
        if (Object.is(slots[index].value, value)) return;
        slots[index].value = value;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => { assert.equal(name, "react"); return hooks; },
    document, window, matchMedia: () => media,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  function flush() {
    for (let n = 0; dirty || frames.size; n++) {
      assert.ok(n < 20, "capture should settle");
      if (dirty) {
        dirty = false;
        cursor = 0;
        output = exports.useDesktopCapture(input);
        for (const effect of effects.splice(0)) effect();
      }
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
    }
  }
  flush();
  return {
    document, window, media, remote, input,
    get output() { return output; },
    get focusCount() { return focusCount; },
    get releases() { return releases; },
    get exits() { return exits; },
    render() { dirty = true; flush(); },
    flush,
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("desktop takeover retains keyboard focus and Escape releases capture before control RPC completes", () => {
  const fixture = captureFixture();
  assert.equal(fixture.output.captured, true);
  assert.equal(fixture.focusCount, 1);
  const focus = new Event("focusin");
  Object.defineProperty(focus, "target", { value: new EventTarget() });
  fixture.document.dispatchEvent(focus);
  assert.equal(fixture.focusCount, 2);
  let forwardedEscape = false;
  fixture.document.addEventListener("keydown", () => { forwardedEscape = true; });
  const escape = new Event("keydown", { cancelable: true });
  Object.defineProperty(escape, "key", { value: "Escape" });
  fixture.document.dispatchEvent(escape);
  fixture.flush();
  assert.equal(escape.defaultPrevented, true);
  assert.equal(forwardedEscape, false);
  assert.equal(fixture.exits, 1);
  assert.ok(fixture.releases > 0);
  assert.equal(fixture.input.enabled, true); // Host response is still pending.
  assert.equal(fixture.output.captured, false);
  fixture.render();
  assert.equal(fixture.output.captured, false, "a routine rerender must not take control again");
  fixture.input.enabled = false;
  fixture.render();
  fixture.input.enabled = true;
  fixture.render();
  assert.equal(fixture.output.captured, false, "a failed release or stream recovery must not recapture after Escape");
  fixture.output.capture();
  fixture.flush();
  assert.equal(fixture.output.captured, true);
  fixture.unmount();
});

test("blur releases held input; visibility and revocation stop focus capture", () => {
  const fixture = captureFixture();
  fixture.window.dispatchEvent(new Event("blur"));
  assert.equal(fixture.releases, 1);
  fixture.document.hidden = true;
  fixture.document.dispatchEvent(new Event("visibilitychange"));
  const count = fixture.focusCount;
  fixture.window.dispatchEvent(new Event("focus"));
  assert.equal(fixture.focusCount, count);
  fixture.input.enabled = false;
  fixture.render();
  assert.equal(fixture.output.captured, false);
  fixture.document.dispatchEvent(new Event("focusin"));
  assert.equal(fixture.focusCount, count);
  fixture.unmount();
});

test("touch devices keep explicit keyboard input; resizing to touch releases desktop capture", () => {
  const touch = captureFixture({ desktop: false });
  assert.equal(touch.output.captured, false);
  assert.equal(touch.focusCount, 0);
  touch.unmount();
  const fixture = captureFixture();
  fixture.media.matches = false;
  fixture.media.dispatchEvent(new Event("change"));
  fixture.flush();
  assert.equal(fixture.output.captured, false);
  assert.ok(fixture.releases > 0);
  fixture.unmount();
});


test("leaving browser fullscreen releases capture even when the browser consumes Escape", () => {
  const fixture = captureFixture();
  fixture.document.fullscreenElement = new EventTarget();
  fixture.document.dispatchEvent(new Event("fullscreenchange"));
  fixture.document.fullscreenElement = null;
  fixture.document.dispatchEvent(new Event("fullscreenchange"));
  fixture.flush();
  assert.equal(fixture.output.captured, false);
  assert.equal(fixture.exits, 1);
  fixture.unmount();
});
