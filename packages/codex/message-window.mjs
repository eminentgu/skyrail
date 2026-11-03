// Keep the active transcript bounded on the wire. Older entries are read by ID.
export function messageWindow(messages, before) {
  const end = before
    ? messages.findIndex((message) => message.id === before)
    : messages.length;
  if (end < 0) return { messages: [], hasEarlier: false };
  let start = end;
  let bytes = 0;
  while (start > 0 && end - start < 32) {
    const size = Buffer.byteLength(JSON.stringify(messages[start - 1]));
    if (start < end && bytes + size > 32 * 1024) break;
    bytes += size;
    start--;
  }
  return { messages: messages.slice(start, end), hasEarlier: start > 0 };
}
