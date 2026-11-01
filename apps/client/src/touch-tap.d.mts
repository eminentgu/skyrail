export class TouchTap {
  constructor(x: number, y: number, threshold?: number);
  cancelled: boolean;
  move(x: number, y: number): void;
  end(point: {
    x: number;
    y: number;
  }): {
    kind: string;
    x: number;
    y: number;
    button: number;
    clickCount: number;
  } | null;
}
