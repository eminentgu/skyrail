import RFB from "@novnc/novnc";
import { desktopEncodings, desktopProfiles, nextDesktopProfile } from "./desktop-stream.mjs";
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
  _disconnect() {
    clearTimeout(this._skyrailRequestTimer);
    this._skyrailRequestTimer = null;
    super._disconnect();
  }
  _sendEncodings() {
    RFB.messages.clientEncodings(
      this._sock,
      desktopEncodings(this._fbDepth, this._qualityLevel, this._compressionLevel),
    );
  }
  _normalMsg() {
    // Upstream requests a frame immediately after decoding each update. Suppress
    // that request for this synchronous call and let our bounded scheduler ask.
    this._enabledContinuousUpdates = true;
    try {
      return super._normalMsg();
    } finally {
      this._enabledContinuousUpdates = false;
    }
  }
  _updateContinuousUpdates() {
    // We never advertise continuous updates. If a server offers them anyway,
    // keep demand-driven updates so frame data cannot accumulate behind input.
    if (this._supportsContinuousUpdates)
      RFB.messages.enableContinuousUpdates(this._sock, false, 0, 0, this._fbWidth, this._fbHeight);
  }
  setStreamVisible(visible) {
    this._skyrailVisible = visible;
    if (visible) this._requestFrame();
    else {
      clearTimeout(this._skyrailRequestTimer);
      this._skyrailRequestTimer = null;
    }
  }
  setStreamMode(mode) {
    if (!["auto", "high", "smooth"].includes(mode)) return;
    this._skyrailMode = mode;
    this._skyrailCongestedUntil = 0;
    this.setStreamLevel(mode === "high" ? 2 : mode === "smooth" ? 0 : 1);
  }
  reportNetworkSample(elapsed, failed = false) {
    if ((this._skyrailMode ?? "auto") !== "auto") return;
    if (failed || elapsed > 350) {
      this._skyrailCongestedUntil = performance.now() + 12000;
      this.setStreamLevel(0);
    }
  }
  setStreamLevel(level) {
    if (!desktopProfiles[level]) return;
    const mode = this._skyrailMode ?? "auto";
    level = mode === "high" ? 2 : mode === "smooth" ? 0 : level;
    this._skyrailProfile = { level, good: 0 };
    this._applyStreamProfile();
  }
  _applyStreamProfile() {
    const level = this._skyrailProfile?.level ?? 1;
    const profile = desktopProfiles[level];
    this.qualityLevel = profile.quality;
    this.compressionLevel = profile.compression;
    this.dispatchEvent(new CustomEvent("skyrail-stream-quality", {
      detail: { level, encoding: this._skyrailEncoding ?? null },
    }));
  }
  _requestFrame() {
    if (this._skyrailRequestTimer || this._skyrailVisible === false ||
        this._rfbConnectionState !== "connected") return;
    const level = this._skyrailProfile?.level ?? 1;
    this._skyrailRequestTimer = setTimeout(() => {
      this._skyrailRequestTimer = null;
      if (this._skyrailVisible === false || this._rfbConnectionState !== "connected") return;
      RFB.messages.fbUpdateRequest(this._sock, true, 0, 0, this._fbWidth, this._fbHeight);
    }, desktopProfiles[level].interval);
  }
  _handleRect() {
    if (this._FBU.encoding >= 0) this._skyrailEncoding = this._FBU.encoding;
    return super._handleRect();
  }
  _framebufferUpdate() {
    this._skyrailFrameStarted ??= performance.now();
    const complete = super._framebufferUpdate();
    if (complete) {
      const elapsed = performance.now() - this._skyrailFrameStarted;
      this._skyrailFrameStarted = undefined;
      if ((this._skyrailMode ?? "auto") === "auto") {
        if (elapsed > 250) this._skyrailCongestedUntil = performance.now() + 12000;
        this._skyrailProfile = performance.now() < (this._skyrailCongestedUntil ?? 0)
          ? {level: 0, good: 0}
          : nextDesktopProfile(this._skyrailProfile ?? {level: 1, good: 0}, elapsed);
      }
      this._applyStreamProfile();
      if (elapsed > 250) this.dispatchEvent(new Event("skyrail-slow-frame"));
      this._requestFrame();
    }
    return complete;
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
  releaseInput() {
    this.releasePointer();
    this._keyboard._allKeysUp();
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
