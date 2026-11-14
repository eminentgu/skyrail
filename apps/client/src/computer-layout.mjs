const clamp = (value, min, max) => Math.max(min, Math.min(Number.isFinite(value) ? value : min, max));
// Coordinates are CSS pixels in the visual viewport, including iOS keyboard offsets.
export function windowLimits(viewport, headerBottom = 56, desktop = true) {
    const left = (viewport.left || 0) + 8;
    const top = Math.max((viewport.top || 0) + 8, headerBottom + 8);
    const maxWidth = Math.max(1, viewport.width - 16);
    const maxHeight = Math.max(1, (viewport.top || 0) + viewport.height - top - 8);
    return { left, top, right: left + maxWidth, bottom: top + maxHeight,
        minWidth: Math.min(desktop ? 360 : 220, maxWidth), maxWidth: Math.min(1120, maxWidth),
        minHeight: Math.min(desktop ? 260 : 160, maxHeight), maxHeight: Math.min(900, maxHeight) };
}
export function fitWindow(rect, limits) {
    const width = clamp(rect.width, limits.minWidth, limits.maxWidth);
    const height = clamp(rect.height, limits.minHeight, limits.maxHeight);
    return { width, height, left: clamp(rect.left, limits.left, limits.right - width),
        top: clamp(rect.top, limits.top, limits.bottom - height) };
}
export function resizeWindow(rect, dx, dy, limits) {
    return fitWindow({ ...rect,
        width: clamp(rect.width + dx, limits.minWidth, Math.min(limits.maxWidth, limits.right - rect.left)),
        height: clamp(rect.height + dy, limits.minHeight, Math.min(limits.maxHeight, limits.bottom - rect.top)),
    }, limits);
}
export function sidebarLimits(available) {
    const max = Math.max(1, Math.min(880, available - 296));
    return { min: Math.min(320, max), max };
}
export function fitSidebar(width, available) {
    const { min, max } = sidebarLimits(available);
    return clamp(width, min, max);
}

// At the minimum size the next action is to fold, rather than a silent no-op.
export function shrinkWindow(rect, limits) {
    const next = fitWindow({...rect, width: rect.width * .75, height: rect.height * .75}, limits);
    return Math.abs(next.width - rect.width) > .5 || Math.abs(next.height - rect.height) > .5 ? next : null;
}
