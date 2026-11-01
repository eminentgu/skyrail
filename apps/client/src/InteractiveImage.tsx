import React, { useEffect, useRef, useState } from "react";
import { mapPoint } from "./coordinates.mjs";
import { TouchTap } from "./touch-tap.mjs";
import { Icon } from "./Icon";
import { flushSync } from "react-dom";
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
}: Props) {
  const image = useRef<HTMLImageElement>(null),
    keyboard = useRef<HTMLTextAreaElement>(null),
    queue = useRef(Promise.resolve());
  const pointer = useRef<number | null>(null),
    gesture = useRef<TouchTap | null>(null),
    lastMove = useRef(0),
    composing = useRef(false),
    generation = useRef(0);
  const [focused, setFocused] = useState(false),
    [touch, setTouch] = useState(
      () => matchMedia("(pointer: coarse),(max-width:699px)").matches,
    ),
    [inputStatus, setInputStatus] = useState("");
  const session = useRef({ enabled, epoch, threadId });
  session.current = { enabled, epoch, threadId };
  function send(input: object) {
    const expected = { epoch, threadId },
      version = generation.current;
    queue.current = queue.current
      .then(async () => {
        if (
          generation.current !== version ||
          !session.current.enabled ||
          session.current.epoch !== expected.epoch ||
          session.current.threadId !== expected.threadId
        )
          return;
        await post("mac/input", { ...expected, clientId, input });
        if (generation.current === version)
          setInputStatus(
            (input as { kind?: string }).kind === "text"
              ? "输入已发送"
              : (input as { kind?: string }).kind === "tap"
                ? "已点按"
                : "已发送",
          );
      })
      .catch(async (e) => {
        generation.current++;
        onError(e.message);
        pointer.current = null;
        gesture.current = null;
        try {
          await post("mac/release", { epoch, clientId });
        } catch {}
      });
  }
  function release() {
    generation.current++;
    pointer.current = null;
    gesture.current = null;
    setFocused(false);
    keyboard.current?.blur();
    if (enabled)
      queue.current = queue.current
        .then(() => post("mac/release", { epoch, clientId }))
        .catch(() => {});
  }
  useEffect(() => {
    const blur = () => release();
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
      release();
    };
  }, [enabled, epoch, threadId]);
  useEffect(() => {
    const media = matchMedia("(pointer: coarse),(max-width:699px)");
    const changed = () => setTouch(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => setInputStatus(""), [enabled, epoch, threadId]);
  useEffect(() => {
    const el = image.current;
    if (!el || !enabled) return;
    const wheel = (e: WheelEvent) => {
      const p = mapPoint(
        el.getBoundingClientRect(),
        el.naturalWidth,
        el.naturalHeight,
        e.clientX,
        e.clientY,
      );
      if (!p) return;
      e.preventDefault();
      send({
        kind: "scroll",
        ...p,
        deltaX: Math.round(e.deltaX),
        deltaY: Math.round(e.deltaY),
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [enabled, epoch, threadId]);
  const point = (e: { clientX: number; clientY: number }, clamp = false) =>
    image.current
      ? mapPoint(
          image.current.getBoundingClientRect(),
          image.current.naturalWidth,
          image.current.naturalHeight,
          e.clientX,
          e.clientY,
          clamp,
        )
      : null;
  const flags = (e: React.MouseEvent | React.KeyboardEvent) => ({
    shift: e.shiftKey,
    meta: e.metaKey,
    alt: e.altKey,
    ctrl: e.ctrlKey,
  });
  function text(value: string) {
    if (value) send({ kind: "text", text: value.slice(0, 4000) });
  }
  function key(code: string) {
    send({ kind: "key", code });
  }
  return (
    <div className={"interactive-image " + (enabled ? "can-control" : "")}>
      <div className="remote-surface">
        <img
          ref={image}
          className="live-image"
          src={src}
          alt={`${name}的实时窗口画面`}
          draggable={false}
          onContextMenu={(e) => {
            if (enabled) e.preventDefault();
          }}
          onPointerDown={(e) => {
            if (!enabled) return;
            if (!e.isPrimary || pointer.current !== null) {
              release();
              return;
            }
            const p = point(e);
            if (!p) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            pointer.current = e.pointerId;
            lastMove.current = 0;
            if (e.pointerType === "touch") {
              setTouch(true);
              gesture.current = new TouchTap(e.clientX, e.clientY);
              return;
            }
            keyboard.current?.focus({ preventScroll: true });
            setFocused(true);
            send({
              kind: "down",
              ...p,
              button: e.button,
              clickCount: e.detail || 1,
              ...flags(e),
            });
          }}
          onPointerMove={(e) => {
            if (
              !enabled ||
              pointer.current !== e.pointerId ||
              Date.now() - lastMove.current < 70
            )
              return;
            const p = point(e, true);
            if (!p) return;
            lastMove.current = Date.now();
            if (gesture.current) gesture.current.move(e.clientX, e.clientY);
            else
              send({
                kind: "move",
                ...p,
                button: e.buttons === 2 ? 2 : 0,
                ...flags(e),
              });
          }}
          onPointerUp={(e) => {
            if (!enabled || pointer.current !== e.pointerId) return;
            const p = point(e, true);
            pointer.current = null;
            if (p) {
              if (gesture.current) {
                gesture.current.move(e.clientX, e.clientY);
                const tap = gesture.current.end(p);
                if (tap) {
                  send(tap);
                  setInputStatus("正在点按…");
                }
              } else
                send({
                  kind: "up",
                  ...p,
                  button: e.button,
                  clickCount: e.detail || 1,
                  ...flags(e),
                });
            } else release();
            gesture.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onLostPointerCapture={(e) => {
            if (pointer.current === e.pointerId) release();
          }}
          onPointerCancel={() => release()}
        />
        {!touch && enabled && (
          <div className="keyboard-hint">
            {focused
              ? "键盘已连接 · Escape 退出输入"
              : "点击画面操作 · 支持拖动、滚轮与输入"}
          </div>
        )}
      </div>
      <textarea
        ref={keyboard}
        className={
          "remote-keyboard " +
          (touch && focused ? "mobile-keyboard-visible" : "")
        }
        aria-label="远程键盘输入，按 Escape 退出"
        disabled={!enabled}
        placeholder="在这里输入到 Mac…"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          if (!touch) release();
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || composing.current) return;
          if (e.key === "Escape") {
            e.preventDefault();
            release();
            return;
          }
          const specials = [
            "Enter",
            "Tab",
            "Backspace",
            "Delete",
            "ArrowLeft",
            "ArrowRight",
            "ArrowDown",
            "ArrowUp",
            "Home",
            "End",
            "PageUp",
            "PageDown",
          ];
          if (specials.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) {
            e.preventDefault();
            send({ kind: "key", code: e.code, ...flags(e) });
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
      {touch && (
        <div
          className="touch-controls"
          role="group"
          aria-label="手机点按与输入"
        >
          {!enabled ? (
            <button
              className="primary touch-takeover"
              onClick={takeControl}
              disabled={!takeControl}
            >
              <Icon name="monitor" size={18} />
              接管后点按画面
            </button>
          ) : (
            <div className="touch-actions">
              <span>
                <span className="status-dot" />
                点按画面即可操作
              </span>
              <button
                aria-pressed={focused}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (focused) release();
                  else {
                    flushSync(() => setFocused(true));
                    keyboard.current?.focus({ preventScroll: true });
                  }
                }}
              >
                <Icon name="keyboard" size={18} />
                {focused ? "收起键盘" : "输入文字"}
              </button>
            </div>
          )}
          {focused && (
            <div className="touch-keys">
              {[
                ["Tab", "Tab"],
                ["Enter", "回车"],
                ["Backspace", "退格"],
              ].map(([code, label]) => (
                <button
                  key={code}
                  disabled={!enabled}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => key(code)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <small role="status">
            {inputStatus ||
              (!enabled
                ? "先接管，再轻点目标位置"
                : "轻点目标位置，再打开键盘输入。")}
          </small>
        </div>
      )}
    </div>
  );
}
