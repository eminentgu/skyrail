// A tap tolerates normal finger jitter. Moving or adding another finger never
// turns a gesture into an unintended click or starts a held remote button.
export class TouchTap {
  constructor(x, y, threshold = 18) {
    this.start = { x, y };
    this.threshold = threshold;
    this.cancelled = false;
  }
  move(x, y) {
    if (Math.hypot(x - this.start.x, y - this.start.y) > this.threshold)
      this.cancelled = true;
  }
  end(point) {
    return this.cancelled
      ? null
      : { kind: "tap", ...point, button: 0, clickCount: 1 };
  }
}
