import { ComputerControls, ComputerTakeover } from "./ComputerControls";
import { t as ui } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useDesktopCapture } from "./useDesktopCapture";
import { RemoteSurface } from "./RemoteSurface";
import type { SurfaceInput } from "./surface-gestures.mjs";
import { useWindowFrames } from "./useWindowFrames";
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
  releaseControl?: () => void;
  visible?: boolean;
  controlsVisible?: boolean;
  onRetry?: () => void;
};
export function InteractiveImage({
  src,
  name,
  enabled: controlEnabled,
  epoch,
  threadId,
  clientId,
  post,
  onError,
  takeControl,
  releaseControl,
  visible = true,
  controlsVisible = true,
  onRetry,
}: Props) {
  const image = useRef<HTMLImageElement>(null),
    keyboard = useRef<HTMLTextAreaElement>(null),
    queue = useRef(Promise.resolve()),
    generation = useRef(0),
    composing = useRef(false),
    zoom = useRef<() => void>(() => {});
  const video = useWindowFrames(src, image);
  const granted = controlEnabled && visible && video.ready && !video.waiting;
  const capture = useDesktopCapture({
    enabled: granted,
    focus: () => keyboard.current?.focus({ preventScroll: true }),
    ownsFocus: target => target === keyboard.current,
    releaseInput: () => release(),
    exit: () => releaseControl?.(),
  });
  const enabled = granted && (!capture.desktop || capture.captured);
  const latest = useRef({ enabled, epoch, threadId });
  latest.current = { enabled, epoch, threadId };
  const [focused, setFocused] = useState(false),
    [mode, setMode] = useState<"trackpad" | "direct">(() =>
      localStorage.getItem("skyrail.input") === "direct"
        ? "direct"
        : "trackpad",
    );
  const pendingMove = useRef<{ input: SurfaceInput } | null>(null);
  useEffect(() => {
    if (!controlsVisible) {
      keyboard.current?.blur();
      setFocused(false);
      release();
    }
  }, [controlsVisible]);
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
  const remoteInput = (<textarea
        ref={keyboard}
        className={
          "remote-keyboard " + (focused ? "mobile-keyboard-visible" : "")
        }
        aria-label={ui("应用键盘输入")}
        disabled={!enabled}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={ui("在这里输入到应用…")}
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
      />);
  return (
    <div className={"interactive-image app-interactive" + (focused ? " keyboard-expanded" : "") + (capture.desktop && enabled ? " remote-captured" : "")}>
      <RemoteSurface
        enabled={enabled}
        visible={visible}
        frame={frame}
        send={send}
        onCancel={release}
        onFocus={() => {
          if (enabled) keyboard.current?.focus({ preventScroll: true });
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
          alt={ui("{0}的实时窗口画面", name)}
          draggable={false}
        />
      </RemoteSurface>
      {visible && <ComputerTakeover>
        <button className={"computer-takeover-button" + (!enabled ? " primary" : "")}
          disabled={!video.ready || video.waiting}
          aria-pressed={enabled} aria-label={ui(enabled ? "退出接管" : "接管鼠标和键盘")}
          title={ui(enabled ? "鼠标和键盘已接管 · Esc 退出" : "接管鼠标和键盘")}
          onClick={() => {
            if (enabled) releaseControl?.();
            else {capture.capture();if (!granted) takeControl?.();}
          }}>{ui(enabled ? "退出接管" : "接管")}</button>
      </ComputerTakeover>}
      {capture.desktop&&remoteInput}
      <ComputerControls>{controlsVisible && <p className="desktop-status" role="status">
        {video.paused ? ui("画面已暂停") : video.waiting ? ui("正在恢复画面…") : !video.ready ? ui("等待画面…") : ui("自适应画质")}
        {video.waiting&&onRetry&&<button onClick={onRetry}>{ui("重新连接")}</button>}
      </p>}
      <div className="app-touch-controls" hidden={!controlsVisible}>
        <span>{capture.desktop
          ? enabled ? ui("鼠标和键盘已接管 · Esc 退出") : ui("只看画面")
          : enabled ? ui("滑动移光标 · 轻点点击") : ui("只看画面")}</span>
        <button aria-label={ui("缩放应用画面")} onClick={() => zoom.current()}>
          <Icon name="expand" size={17} />
        </button>
        {!capture.desktop && enabled && (
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
            {focused ? ui("收起键盘") : ui("输入文字")}
          </button>
        )}
        {!capture.desktop&&<div className="control-segments" role="group" aria-label={ui("应用操作方式")}>
          <button aria-pressed={mode==="trackpad"} onClick={()=>{setMode("trackpad");localStorage.setItem("skyrail.input","trackpad");}}>{ui("触控板")}</button>
          <button aria-pressed={mode==="direct"} onClick={()=>{setMode("direct");localStorage.setItem("skyrail.input","direct");}}>{ui("直接点按")}</button>
        </div>}
      </div>
      {!capture.desktop&&remoteInput}
      {focused && (
        <div className="desktop-special-keys">
          {[
            ["Tab", "Tab"],
            ["Enter", ui("回车")],
            ["Backspace", ui("退格")],
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
      )}</ComputerControls>
    </div>
  );
}
