import { useEffect, useState, type RefObject } from "react";
import { nextQuality, retryDelay } from "./connection.mjs";

export function useWindowFrames(
  source: string | undefined,
  image: RefObject<HTMLImageElement | null>,
) {
  const [state, setState] = useState({
    source,
    level: 1,
    ready: false,
    waiting: false,
    paused: false,
  });
  useEffect(() => {
    const element = image.current;
    if (!source || !element) return;
    let stopped = false;
    let controller: AbortController;
    let timer: ReturnType<typeof setTimeout>;
    let displayed: string | undefined;
    let sequence = "";
    let failures = 0;
    let quality = { level: 1, good: 0 };
    const update = (ready: boolean, waiting: boolean, paused = false) => {
      if (stopped) return;
      setState((previous) =>
        previous.source === source &&
        previous.level === quality.level &&
        previous.ready === ready &&
        previous.waiting === waiting &&
        previous.paused === paused
          ? previous
          : { source, level: quality.level, ready, waiting, paused },
      );
    };
    let offlinePaused = false;
    const poll = async () => {
      if (stopped) return;
      if (!navigator.onLine) {
        offlinePaused = true;
        update(!!displayed, true);
        return;
      }
      offlinePaused = false;
      controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 3500);
      const began = performance.now();
      let delay = 35;
      try {
        const response = await fetch(
          source + "&quality=" + quality.level + "&after=" + sequence,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (stopped) return;
        if ([401, 403, 409, 423].includes(response.status)) {
          element.removeAttribute("src");
          if (displayed) URL.revokeObjectURL(displayed);
          displayed = undefined;
          update(false, true, true);
          return;
        }
        if (response.status !== 204) {
          if (!response.ok) throw Error("Frame unavailable");
          const blob = await response.blob();
          if (stopped) return;
          quality = nextQuality(quality, performance.now() - began);
          sequence = response.headers.get("X-Skyrail-Frame") || "";
          const next = URL.createObjectURL(blob);
          element.src = next;
          if (displayed) URL.revokeObjectURL(displayed);
          displayed = next;
          await element.decode();
        }
        failures = 0;
        update(!!displayed, false);
      } catch {
        quality = nextQuality(quality, 0, true);
        delay = retryDelay(failures++);
        update(!!displayed, true, failures >= 6);
        if (failures >= 6) return;
      } finally {
        clearTimeout(deadline);
      }
      if (!stopped) timer = setTimeout(poll, delay);
    };
    const resume = () => {
      if (offlinePaused) void poll();
    };
    window.addEventListener("online", resume);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      window.removeEventListener("online", resume);
      element.removeAttribute("src");
      if (displayed) URL.revokeObjectURL(displayed);
    };
  }, [source, image]);
  return state.source === source && !!source
    ? state
    : { level: 1, ready: false, waiting: false, paused: false };
}
