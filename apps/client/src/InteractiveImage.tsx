import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { RemoteSurface } from "./RemoteSurface";
import type { SurfaceInput } from "./surface-gestures.mjs";
import { Icon } from "./Icon";
type Props = {
  src?: string;
  name: string;
  enabled: boolean;
  epoch: number;
  threadId: string;
  clientId: string;
  post: (path: string, data?: object) => Promise<any>;
  onError: (message: string) => void;
  takeControl?: () => void;
  visible?: boolean;
};
export function InteractiveImage({
  src,
  name,
  enabled,
  epoch,
  threadId,
  clientId,
  post,
  onError,
  takeControl,
  visible = true,
}: Props) {
  const image = useRef<HTMLImageElement>(null),
    keyboard = useRef<HTMLTextAreaElement>(null),
    queue = useRef(Promise.resolve()),
    generation = useRef(0),
    composing = useRef(false),
    zoom = useRef<() => void>(() => {});
  const latest = useRef({ enabled, epoch, threadId });
  latest.current = { enabled, epoch, threadId };
  const [focused, setFocused] = useState(false),
    [mode, setMode] = useState<"trackpad" | "direct">(() =>
      localStorage.getItem("skyrail.input") === "direct"
        ? "direct"
        : "trackpad",
    );
  const pendingMove = useRef<{ input: SurfaceInput } | null>(null);
  function send(input: object) {
    const expected = { epoch, threadId },
      version = generation.current;
    const packet = { input: input as SurfaceInput };
    if (packet.input.kind === "move") {
      if (!packet.input.dragging) return; // Hover is local; native app input needs a held button.
      if (pendingMove.current) {
        pendingMove.current.input = packet.input;
        return;
      }
      pendingMove.current = packet;
    } else pendingMove.current = null;
    queue.current = queue.current
      .then(async () => {
        if (pendingMove.current === packet) pendingMove.current = null;
        if (
          generation.current !== version ||
          !latest.current.enabled ||
          latest.current.epoch !== expected.epoch ||
          latest.current.threadId !== expected.threadId
        )
          return;
        await post("mac/input", { ...expected, clientId, input: packet.input });
      })
      .catch(async (e) => {
        generation.current++;
        onError(e.message);
        try {
          await post("mac/release", { epoch, clientId });
        } catch {}
      });
  }
  function release() {
    generation.current++;
    pendingMove.current = null;
    setFocused(false);
    keyboard.current?.blur();
    if (enabled)
      queue.current = queue.current
        .then(() => post("mac/release", { epoch, clientId }))
        .catch(() => {});
  }
  useEffect(
    () => () => {
      release();
    },
    [enabled, epoch, threadId],
  );
  useEffect(() => {
    if (!visible) release();
  }, [visible]);
  const frame = () => {
    const el = image.current;
    if (!el?.naturalWidth || !el.naturalHeight) return null;
    const r = el.getBoundingClientRect(),
      scale = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight),
      w = el.naturalWidth * scale,
      h = el.naturalHeight * scale;
    return new DOMRect(
      r.left + (r.width - w) / 2,
      r.top + (r.height - h) / 2,
      w,
      h,
    );
  };
  const text = (value: string) => {
    if (value) send({ kind: "text", text: value.slice(0, 4000) });
  };
  const key = (code: string) => send({ kind: "key", code });
  return (
    <div className="interactive-image app-interactive">
      <RemoteSurface
        enabled={enabled}
        visible={visible}
        frame={frame}
        send={send}
        onCancel={release}
        onFocus={() => {
          if (enabled) {
            setFocused(true);
            keyboard.current?.focus({ preventScroll: true });
          }
        }}
        mode={mode}
        resetKey={`${threadId}:${name}`}
        onZoomReady={(fn) => {
          zoom.current = fn;
        }}
      >
        <img
          ref={image}
          className="live-image"
          src={src}
          alt={`${name}的实时窗口画面`}
          draggable={false}
        />
      </RemoteSurface>
      <div className="app-touch-controls">
        <span>{enabled ? "滑动移光标 · 轻点点击" : "只看画面"}</span>
        <button aria-label="缩放应用画面" onClick={() => zoom.current()}>
          <Icon name="expand" size={17} />
        </button>
        {!enabled ? (
          <button className="primary" onClick={takeControl}>
            接手操作
          </button>
        ) : (
          <button
            className="primary"
            aria-pressed={focused}
            onClick={() => {
              flushSync(() => setFocused(!focused));
              if (!focused) keyboard.current?.focus({ preventScroll: true });
              else keyboard.current?.blur();
            }}
          >
            <Icon name="keyboard" size={18} />
            {focused ? "收起键盘" : "输入文字"}
          </button>
        )}
        <details className="desktop-menu">
          <summary aria-label="应用操作选项">
            <Icon name="settings" size={18} />
          </summary>
          <div>
            <label>
              手机操作
              <select
                aria-label="应用操作方式"
                value={mode}
                onChange={(e) => {
                  const next = e.target.value as typeof mode;
                  setMode(next);
                  localStorage.setItem("skyrail.input", next);
                }}
              >
                <option value="trackpad">触控板：滑动移光标</option>
                <option value="direct">直接点按目标</option>
              </select>
            </label>
            <small>
              轻点单击，连点双击；连点后按住可拖拽。双指缩放和移动画面。
            </small>
          </div>
        </details>
      </div>
      <textarea
        ref={keyboard}
        className={
          "remote-keyboard " + (focused ? "mobile-keyboard-visible" : "")
        }
        aria-label="应用键盘输入"
        disabled={!enabled}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="在这里输入到应用…"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || composing.current) return;
          const specials = [
            "Enter",
            "Tab",
            "Backspace",
            "Delete",
            "Escape",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
            "PageUp",
            "PageDown",
          ];
          if (specials.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) {
            e.preventDefault();
            send({
              kind: "key",
              code: e.code,
              shift: e.shiftKey,
              meta: e.metaKey,
              ctrl: e.ctrlKey,
              alt: e.altKey,
            });
          }
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          text(e.currentTarget.value);
          e.currentTarget.value = "";
        }}
        onInput={(e) => {
          if (composing.current || (e.nativeEvent as InputEvent).isComposing)
            return;
          text(e.currentTarget.value);
          e.currentTarget.value = "";
        }}
        onPaste={(e) => {
          e.preventDefault();
          text(e.clipboardData.getData("text/plain"));
        }}
      />
      {focused && (
        <div className="desktop-special-keys">
          {[
            ["Tab", "Tab"],
            ["Enter", "回车"],
            ["Backspace", "退格"],
          ].map(([code, label]) => (
            <button
              key={code}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => key(code)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
