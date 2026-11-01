import RFB from "@novnc/novnc";
// Pinned noVNC 1.7.0 integration boundary. noVNC has no public pointer API.
// Keep wire encoding and keyboard/auth in upstream; only normalized pointer
// dispatch and fallback-cursor lifecycle live here. Do not patch node_modules.
export default class DesktopRFB extends RFB {
  _connect() {
    super._connect();
    // Our local, clipped marker replaces the body-level iOS fallback cursor.
    this._cursor._canvas.style.opacity = "0";
    this._gestures.detach();
  }
  sendPointer(input) {
    if (this._rfbConnectionState !== "connected" || this._viewOnly) return;
    const { x, y, kind, button = 0, deltaX = 0, deltaY = 0 } = input;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const px = Math.max(
      0,
      Math.min(this._fbWidth - 1, Math.round(x * (this._fbWidth - 1))),
    );
    const py = Math.max(
      0,
      Math.min(this._fbHeight - 1, Math.round(y * (this._fbHeight - 1))),
    );
    this._surfaceX = x;
    this._surfaceY = y;
    const write = (mask) => RFB.messages.pointerEvent(this._sock, px, py, mask);
    if (kind === "down") this._surfaceMask = button === 2 ? 4 : 1;
    if (kind === "up") this._surfaceMask = 0;
    if (kind === "tap") {
      write(button === 2 ? 4 : 1);
      write(0);
      return;
    }
    if (kind === "scroll") {
      for (const [delta, negative, positive] of [
        [deltaY, 8, 16],
        [deltaX, 32, 64],
      ])
        for (let i = 0; i < Math.min(8, Math.ceil(Math.abs(delta) / 40)); i++) {
          write((delta < 0 ? negative : positive) | (this._surfaceMask || 0));
          write(this._surfaceMask || 0);
        }
      return;
    }
    write(this._surfaceMask || 0);
  }
  releasePointer() {
    if (this._surfaceMask)
      this.sendPointer({
        kind: "up",
        x: this._surfaceX ?? 0.5,
        y: this._surfaceY ?? 0.5,
      });
    this._surfaceMask = 0;
  }
}
