import RFB from "@novnc/novnc";
import type { SurfaceInput } from "./surface-gestures.mjs";
export default class DesktopRFB extends RFB {
  setStreamVisible(visible: boolean): void;
  setStreamLevel(level: number): void;
  sendPointer(input: SurfaceInput): void;
  releasePointer(): void;
  releaseInput(): void;
}
