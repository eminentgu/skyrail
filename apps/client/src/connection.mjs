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
