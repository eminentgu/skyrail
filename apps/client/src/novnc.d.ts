declare module "@novnc/novnc" {
  export default class RFB extends EventTarget {
    constructor(
      target: HTMLElement,
      url: string,
      options?: { shared?: boolean; wsProtocols?: string[] },
    );
    scaleViewport: boolean;
    clipViewport: boolean;
    dragViewport: boolean;
    resizeSession: boolean;
    focusOnClick: boolean;
    showDotCursor: boolean;
    viewOnly: boolean;
    disconnect(): void;
    focus(): void;
    blur(): void;
    sendCredentials(credentials: Record<string, string>): void;
    sendKey(keysym: number, code?: string, down?: boolean): void;
  }
}
declare module "skyrail-novnc-logging" {
  export function initLogging(level: string): void;
}
