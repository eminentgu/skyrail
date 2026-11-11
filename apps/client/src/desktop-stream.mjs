// Pinned noVNC/RFB encoding identifiers. JPEG is preferred ahead of lossless
// codecs so the negotiated server path can honor the bandwidth profile.
export function desktopEncodings(depth, quality, compression) {
  const pixels = depth === 24 ? [1, 7, 21, 16, 5, 2, 6, 0] : [1, 0];
  return [
    ...pixels, -32 + quality, -256 + compression,
    -223, -224, -258, -261, -308, -309, -312, -307,
    0xc0a1e5ce, -316,
    ...(depth === 24 ? [0x574d5664, -239] : []),
  ];
}
export function nextDesktopProfile(current, elapsed) {
  if (elapsed > 250) return { level: 0, good: 0 };
  const good = elapsed < 100 ? current.good + 1 : 0;
  return good >= 30
    ? { level: Math.min(2, current.level + 1), good: 0 }
    : { ...current, good };
}
export const desktopProfiles = [
  { quality: 0, compression: 9, interval: 200 },
  { quality: 3, compression: 8, interval: 100 },
  { quality: 6, compression: 6, interval: 50 },
];
