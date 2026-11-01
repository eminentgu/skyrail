import React, { useEffect, useRef, useState } from "react";
import {
  SurfaceGestures,
  zoomTransform,
  keepPointVisible,
  type SurfaceInput,
  type Point,
} from "./surface-gestures.mjs";
type Props = {
  children: React.ReactNode;
  enabled: boolean;
  visible: boolean;
  frame: () => DOMRect | null;
  send: (input: SurfaceInput) => void;
  onCancel?: () => void;
  onFocus?: () => void;
  mode: "trackpad" | "direct";
  resetKey?: string | number;
  onZoomReady?: (zoom: () => void) => void;
};
export function RemoteSurface({
  children,
  enabled,
  visible,
  frame,
  send,
  onCancel,
  onFocus,
  mode,
  resetKey,
  onZoomReady,
}: Props) {
  const root = useRef<HTMLDivElement>(null),
    layer = useRef<HTMLDivElement>(null),
    marker = useRef<HTMLSpanElement>(null);
  const latest = useRef({ enabled, visible, frame, send, onCancel });
  latest.current = { enabled, visible, frame, send, onCancel };
  const view = useRef({ scale: 1, x: 0, y: 0 }),
    [zoom, setZoom] = useState(1),
    [touch, setTouch] = useState(false);
  const gesture = useRef<SurfaceGestures | null>(null);
  const paint = (p: Point) => {
    const r = latest.current.frame(),
      host = root.current?.getBoundingClientRect();
    if (r && host && marker.current) {
      if (
        gesture.current?.mode === "trackpad" &&
        latest.current.enabled &&
        latest.current.visible &&
        view.current.scale > 1
      ) {
        const next = keepPointVisible(view.current, r, host, p);
        const dx = next.x - view.current.x,
          dy = next.y - view.current.y;
        if (dx || dy) {
          view.current = next;
          if (layer.current)
            layer.current.style.transform = `translate(${next.x}px,${next.y}px) scale(${next.scale})`;
          r.x += dx;
          r.y += dy;
        }
      }
      marker.current.style.left = `${r.left - host.left + r.width * p.x}px`;
      marker.current.style.top = `${r.top - host.top + r.height * p.y}px`;
    }
  };
  const transform = (
    factor: number,
    dx: number,
    dy: number,
    x: number,
    y: number,
  ) => {
    const el = root.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    view.current = zoomTransform(
      view.current,
      rect.width,
      rect.height,
      factor,
      dx,
      dy,
      x - rect.left,
      y - rect.top,
    );
    if (layer.current)
      layer.current.style.transform = `translate(${view.current.x}px,${view.current.y}px) scale(${view.current.scale})`;
    setZoom(view.current.scale);
    if (gesture.current) paint(gesture.current.position);
  };
  if (!gesture.current)
    gesture.current = new SurfaceGestures({
      frame: () => latest.current.frame(),
      send: (input) => {
        if (latest.current.enabled && latest.current.visible)
          latest.current.send(input);
      },
      cursor: paint,
      transform,
      mode,
    });
  const cancel = () => {
    gesture.current?.cancel();
    latest.current.onCancel?.();
  };
  useEffect(() => {
    cancel();
    gesture.current!.mode = mode;
  }, [mode, enabled, visible, resetKey]);
  useEffect(() => {
    view.current = { scale: 1, x: 0, y: 0 };
    if (layer.current) layer.current.style.transform = "";
    setZoom(1);
    gesture.current!.position = { x: 0.5, y: 0.5 };
    paint(gesture.current!.position);
  }, [resetKey]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const resize = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      transform(1, 0, 0, rect.left, rect.top);
    });
    resize.observe(el);
    const blur = () => cancel();
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      resize.disconnect();
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
      cancel();
    };
  }, []);
  useEffect(() => {
    onZoomReady?.(() => {
      const r = root.current?.getBoundingClientRect();
      if (r)
        transform(
          view.current.scale > 1.01 ? 1 / view.current.scale : 2,
          0,
          0,
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
    });
  }, [onZoomReady]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!visible) return;
      e.preventDefault();
      if (e.ctrlKey) {
        transform(Math.exp(-e.deltaY * 0.005), 0, 0, e.clientX, e.clientY);
        return;
      }
      if (enabled) {
        const p = gesture.current!.position;
        send({
          ...p,
          kind: "scroll",
          button: 0,
          deltaX: Math.round(e.deltaX),
          deltaY: Math.round(e.deltaY),
        });
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [enabled, visible, send]);
  return (
    <div
      ref={root}
      className="remote-gesture-surface"
      data-zoom={zoom.toFixed(2)}
      data-input-mode={mode}
    >
      <div className="remote-gesture-content" ref={layer}>
        {children}
      </div>
      <div
        className="remote-gesture-layer"
        aria-label="远程画面操作区域"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (!visible) return;
          e.preventDefault();
          if (e.pointerType !== "touch") onFocus?.();
          if (e.pointerType === "touch") setTouch(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current!.down(
            e.pointerId,
            e.clientX,
            e.clientY,
            e.pointerType,
            e.button,
          );
          paint(gesture.current!.position);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch" && !gesture.current!.has(e.pointerId))
            gesture.current!.hover(e.clientX, e.clientY);
          else gesture.current!.move(e.pointerId, e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          gesture.current!.up(e.pointerId, e.clientX, e.clientY);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={(e) => {
          if (gesture.current!.has(e.pointerId)) cancel();
        }}
      />
      <span
        ref={marker}
        className="remote-pointer"
        hidden={!touch || !enabled || !visible}
        aria-hidden="true"
      >
        <svg width="22" height="28" viewBox="0 0 22 28">
          <path
            d="M2 2L2 22L7.5 17L12 26L16 24L11.5 15L19 15Z"
            fill="#f8fcff"
            stroke="#16394c"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
