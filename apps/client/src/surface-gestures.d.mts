export type Point = { x: number; y: number };
export type SurfaceInput = Point & {
  kind: string;
  button: number;
  clickCount?: number;
  dragging?: boolean;
  deltaX?: number;
  deltaY?: number;
};
export class SurfaceGestures {
  constructor(options: {
    frame: () => {
      left: number;
      top: number;
      width: number;
      height: number;
    } | null;
    send: (input: SurfaceInput) => void;
    cursor: (p: Point) => void;
    transform: (
      factor: number,
      dx: number,
      dy: number,
      x: number,
      y: number,
    ) => void;
    mode?: string;
    clock?: () => number;
  });
  has(id: number): boolean;
  hover(x: number, y: number): void;
  position: Point;
  mode: string;
  held: boolean;
  down(id: number, x: number, y: number, type?: string, button?: number): void;
  move(id: number, x: number, y: number): void;
  up(id: number, x: number, y: number): void;
  cancel(): void;
}
export function zoomTransform(
  view: { scale: number; x: number; y: number },
  width: number,
  height: number,
  factor: number,
  dx: number,
  dy: number,
  x: number,
  y: number,
): { scale: number; x: number; y: number };

export function keepPointVisible(
  view: { scale: number; x: number; y: number },
  frame: { left: number; top: number; width: number; height: number },
  viewport: { left: number; top: number; width: number; height: number },
  point: Point,
): { scale: number; x: number; y: number };
