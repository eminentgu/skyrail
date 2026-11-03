export function nextQuality(
  state: { level: number; good: number },
  elapsed: number,
  failed?: boolean,
): { level: number; good: number };
export function retryDelay(attempt: number, random?: () => number): number;
