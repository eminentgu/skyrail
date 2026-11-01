import RFB from "@novnc/novnc";
import type { SurfaceInput } from "./surface-gestures.mjs";
export default class DesktopRFB extends RFB {
  sendPointer(input: SurfaceInput): void;
  releasePointer(): void;
}
