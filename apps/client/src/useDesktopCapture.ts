import { useEffect, useRef, useState } from "react";

const desktopQuery = "(min-width: 700px) and (hover: hover) and (pointer: fine)";

// Keep keyboard focus with the remote surface until Escape. Both transports
// release held input before relinquishing their server-side control lease.
export function useDesktopCapture({
  enabled,
  focus,
  ownsFocus,
  releaseInput,
  exit,
}: {
  enabled: boolean;
  focus: () => void;
  ownsFocus: (target: EventTarget | null) => boolean;
  releaseInput: () => void;
  exit: () => void;
}) {
  const [desktop, setDesktop] = useState(() => matchMedia(desktopQuery).matches);
  const [captured, setCaptured] = useState(false);
  const dismissed = useRef(false);
  const latest = useRef({ focus, ownsFocus, releaseInput, exit });
  latest.current = { focus, ownsFocus, releaseInput, exit };
  useEffect(() => {
    const media = matchMedia(desktopQuery);
    const change = () => setDesktop(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setCaptured(enabled && desktop && !dismissed.current);
  }, [enabled, desktop]);
  useEffect(() => {
    if (!enabled || !desktop || !captured) return;
    let stopping = false;
    let fullscreen = document.fullscreenElement;
    const focusRemote = () => {
      if (!stopping && !document.hidden) latest.current.focus();
    };
    const focusChanged = (event: FocusEvent) => {
      if (!latest.current.ownsFocus(event.target)) focusRemote();
    };
    const stop = () => {
      if (stopping) return;
      stopping = true;
      dismissed.current = true;
      setCaptured(false);
      latest.current.releaseInput();
      latest.current.exit();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        stop();
      } else if (event.type === "keydown" && !latest.current.ownsFocus(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusRemote();
      }
    };
    const fullscreenChanged = () => {
      if (fullscreen && !document.fullscreenElement) stop();
      fullscreen = document.fullscreenElement;
    };
    const release = () => latest.current.releaseInput();
    const visibility = () => {
      if (document.hidden) release();
      else focusRemote();
    };
    const frame = requestAnimationFrame(focusRemote);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("keyup", escape, true);
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    window.addEventListener("focus", focusRemote);
    window.addEventListener("blur", release);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("keyup", escape, true);
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreenChanged);
      window.removeEventListener("focus", focusRemote);
      window.removeEventListener("blur", release);
      release();
    };
  }, [enabled, desktop, captured]);
  return { desktop, captured, capture: () => {
    dismissed.current = false;
    setCaptured(true);
  } };
}
