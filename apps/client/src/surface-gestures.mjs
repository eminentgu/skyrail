const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
// Frame coordinates are read after zoom/pan. Both transports consume normalized
// image coordinates, never browser pixels or another window's desktop origin.
export class SurfaceGestures {
  constructor({
    frame,
    send,
    cursor,
    transform,
    mode = "trackpad",
    clock = () => performance.now(),
  }) {
    Object.assign(this, { frame, send, cursor, transform, mode, clock });
    this.position = { x: 0.5, y: 0.5 };
    this.points = new Map();
    this.lastTap = null;
    this.held = false;
    this.multi = false;
    this.mouse = false;
  }
  has(id) {
    return this.points.has(id);
  }
  hover(x, y) {
    this.moveTo(this.point(x, y));
  }
  point(x, y) {
    const r = this.frame();
    if (!r?.width || !r?.height) return null;
    return {
      x: clamp((x - r.left) / r.width),
      y: clamp((y - r.top) / r.height),
    };
  }
  moveTo(p, kind = "move", button = 0, clickCount = 1) {
    if (!p) return;
    this.position = p;
    this.cursor(p);
    this.send({ kind, ...p, button, clickCount, dragging: this.held });
  }
  down(id, x, y, type = "touch", button = 0) {
    if (!this.point(x, y)) return;
    if (this.points.size >= 2) return;
    const now = this.clock(),
      p = { x, y, sx: x, sy: y, time: now, moved: false, type, button };
    this.points.set(id, p);
    if (this.points.size === 2) {
      if (this.held) this.moveTo(this.position, "up");
      this.held = false;
      this.multi = true;
      this.lastTap = null;
      return;
    }
    this.multi = false;
    this.mouse = type !== "touch";
    if (this.mouse) {
      this.held = true;
      this.moveTo(this.point(x, y), "down", button);
      return;
    }
    // Delay a second tap until release or actual drag movement, so adding
    // another finger for pinch never presses a remote button.
    if (
      this.lastTap &&
      now - this.lastTap.time < 320 &&
      Math.hypot(x - this.lastTap.x, y - this.lastTap.y) < 24
    ) {
      p.second = true;
    }
  }
  move(id, x, y) {
    const p = this.points.get(id);
    if (!p) return;
    if (this.points.size === 2) {
      const [a, b] = [...this.points.values()];
      const old = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        d: Math.hypot(a.x - b.x, a.y - b.y),
      };
      p.x = x;
      p.y = y;
      const next = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        d: Math.hypot(a.x - b.x, a.y - b.y),
      };
      if (old.d > 8)
        this.transform(
          next.d / old.d,
          next.x - old.x,
          next.y - old.y,
          old.x,
          old.y,
        );
      return;
    }
    if (this.multi) return;
    const dx = x - p.x,
      dy = y - p.y;
    p.x = x;
    p.y = y;
    if (dx === 0 && dy === 0) return;
    if (!p.moved && Math.hypot(x - p.sx, y - p.sy) < 6) return;
    if (p.second && !this.held) {
      this.held = true;
      this.moveTo(
        this.mode === "direct" ? this.point(p.sx, p.sy) : this.position,
        "down",
        0,
        2,
      );
    }
    p.moved = true;
    const r = this.frame();
    if (!r?.width || !r?.height) return;
    const target =
      this.mouse || this.mode === "direct"
        ? this.point(x, y)
        : {
            x: clamp(this.position.x + dx / r.width),
            y: clamp(this.position.y + dy / r.height),
          };
    this.moveTo(target, "move", p.button, p.second ? 2 : 1);
  }
  up(id, x, y) {
    const p = this.points.get(id);
    if (!p) return;
    if (!this.multi) this.move(id, x, y);
    this.points.delete(id);
    if (this.multi) {
      if (!this.points.size) this.multi = false;
      return;
    }
    if (this.held) {
      this.moveTo(this.position, "up", p.button, p.second ? 2 : 1);
      this.held = false;
      this.lastTap = null;
    } else if (!p.moved && this.clock() - p.time < 450) {
      this.moveTo(
        this.mode === "direct" ? this.point(x, y) : this.position,
        "tap",
        0,
        p.second ? 2 : 1,
      );
      this.lastTap = p.second ? null : { x, y, time: this.clock() };
    } else this.lastTap = null;
  }
  cancel() {
    if (this.held) this.moveTo(this.position, "up");
    this.held = false;
    this.points.clear();
    this.multi = false;
    this.lastTap = null;
  }
}
export function zoomTransform(view, width, height, factor, dx, dy, x, y) {
  const scale = clamp(view.scale * factor, 1, 4),
    ratio = scale / view.scale;
  return {
    scale,
    x: clamp(x - (x - view.x) * ratio + dx, width * (1 - scale), 0),
    y: clamp(y - (y - view.y) * ratio + dy, height * (1 - scale), 0),
  };
}

export function keepPointVisible(view, frame, viewport, point) {
  const pad = Math.min(28, viewport.width / 5, viewport.height / 5);
  const x = frame.left - viewport.left + frame.width * point.x,
    y = frame.top - viewport.top + frame.height * point.y;
  const dx =
    x < pad ? pad - x : x > viewport.width - pad ? viewport.width - pad - x : 0;
  const dy =
    y < pad
      ? pad - y
      : y > viewport.height - pad
        ? viewport.height - pad - y
        : 0;
  return zoomTransform(view, viewport.width, viewport.height, 1, dx, dy, 0, 0);
}
