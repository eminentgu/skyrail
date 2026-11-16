// Downgrade promptly, recover only after sustained headroom.
export function nextQuality(state, elapsed, failed = false) {
  const slow = failed || elapsed > 320;
  const fast = !slow && elapsed < 145;
  const good = fast ? state.good + 1 : 0;
  if (slow) return { level: Math.max(0, state.level - 1), good: 0 };
  if (good >= 24) return { level: Math.min(2, state.level + 1), good: 0 };
  return { ...state, good };
}

export function retryDelay(attempt, random = Math.random) {
  return Math.round(
    Math.min(15000, 750 * 2 ** Math.min(attempt, 5)) * (0.85 + random() * 0.3),
  );
}

// SSE comments are invisible to EventSource. Named heartbeats keep an idle
// conversation distinguishable from a socket silently lost by a mobile network.
export function monitorChatStream(source, lost, {
  timeout = 45000, setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  let timer, closed = false;
  const touch = () => {
    if (closed) return;
    clearTimer(timer);
    timer = setTimer(() => {
      if (closed) return;
      close();
      lost();
    }, timeout);
  };
  const events = ['message', 'heartbeat', 'stream'];
  const close = () => {
    closed = true;
    clearTimer(timer);
    for (const event of events) source.removeEventListener(event, touch);
  };
  for (const event of events) source.addEventListener(event, touch);
  touch();
  return close;
}
