export function nextQuality(
  state: { level: number; good: number },
  elapsed: number,
  failed?: boolean,
): { level: number; good: number };
export function retryDelay(attempt: number, random?: () => number): number;

export function monitorChatStream(source: EventTarget, lost: () => void, options?: {
  timeout?: number; setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout;
}): () => void;
