import { useEffect, useRef, useState, type RefObject, type PointerEvent, type KeyboardEvent } from "react";
import { fitWindow, shrinkWindow, resizeWindow, windowLimits, fitSidebar, sidebarLimits, type WindowRect } from "./computer-layout.mjs";
export function useFloatingComputer(enabled: boolean, host: RefObject<HTMLElement | null>, desktop = false, sidebar = false) {
    const storageKey = desktop ? "skyrail.desktop-window" : "skyrail.mobile-window";
    const readSaved = () => { try {
        return JSON.parse(localStorage.getItem(storageKey) || "null");
    }
    catch {
        return null;
    } };
    const limits = () => {
        const v = window.visualViewport;
        return windowLimits({ left: v?.offsetLeft, top: v?.offsetTop, width: v?.width || innerWidth, height: v?.height || innerHeight }, document.querySelector('.app-header')?.getBoundingClientRect().bottom || (desktop ? 56 : 48), desktop);
    };
    const initial = (): WindowRect => {
        const saved = readSaved(), l = limits();
        return fitWindow({ width: saved?.width ?? (desktop ? 640 : innerWidth - 24),
            height: saved?.height ?? Math.min(desktop ? 560 : 420, innerHeight * (desktop ? .62 : .46)),
            left: saved?.left ?? (desktop ? innerWidth - 660 : 12), top: saved?.top ?? 72 }, l);
    };
    const [rect, setRect] = useState(initial);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = Number(localStorage.getItem('skyrail.sidebar-width'));
        return saved > 0 ? saved : 440;
    });
    const drag = useRef<{
        id: number;
        x: number;
        y: number;
        rect: WindowRect;
        kind: 'move' | 'size' | 'sidebar';
        width: number;
    } | null>(null);
    const current = useRef(rect);
    current.current = rect;
    const preferred = useRef(rect);
    const preferredSidebar = useRef(sidebarWidth);
    const available = () => host.current?.closest('main')?.getBoundingClientRect().width || innerWidth - 48;
    const save = (value: WindowRect) => { try {
        localStorage.setItem(storageKey, JSON.stringify(value));
    }
    catch { } };
    const setWidth = (value: number) => {
        const next = fitSidebar(value, available());
        preferredSidebar.current = next;
        setSidebarWidth(next);
        return next;
    };
    useEffect(() => {
        drag.current = null;
        if (enabled) {
            const next = initial();
            preferred.current = next;
            setRect(next);
        }
        const resize = () => {
            if (enabled)
                setRect(fitWindow(preferred.current, limits()));
            if (sidebar)
                setSidebarWidth(fitSidebar(preferredSidebar.current, available()));
        };
        resize();
        const observer = new ResizeObserver(() => { if (sidebar)
            setSidebarWidth(fitSidebar(preferredSidebar.current, available())); });
        if (host.current?.closest('main'))
            observer.observe(host.current.closest('main')!);
        window.visualViewport?.addEventListener('resize', resize);
        window.visualViewport?.addEventListener('scroll', resize);
        window.addEventListener('resize', resize);
        return () => {
            drag.current = null;
            observer.disconnect();
            window.visualViewport?.removeEventListener('resize', resize);
            window.visualViewport?.removeEventListener('scroll', resize);
            window.removeEventListener('resize', resize);
        };
    }, [enabled, desktop, sidebar]);
    const start = (kind: 'move' | 'size' | 'sidebar') => (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || (!enabled && kind !== 'sidebar'))
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: current.current, kind, width: sidebarWidth };
    };
    const move = (event: PointerEvent<HTMLElement>) => {
        const d = drag.current;
        if (d?.id !== event.pointerId)
            return;
        event.preventDefault();
        if (d.kind === 'sidebar') {
            setWidth(d.width + d.x - event.clientX);
            return;
        }
        const next = d.kind === 'size' ? resizeWindow(d.rect, event.clientX - d.x, event.clientY - d.y, limits())
            : fitWindow({ ...d.rect, left: d.rect.left + event.clientX - d.x, top: d.rect.top + event.clientY - d.y }, limits());
        current.current = next;
        preferred.current = next;
        setRect(next);
    };
    const stop = () => {
        if (drag.current?.kind === 'sidebar') {
            try {
                localStorage.setItem('skyrail.sidebar-width', String(sidebarWidth));
            }
            catch { }
        }
        else if (drag.current)
            save(current.current);
        drag.current = null;
    };
    const keys = (kind: 'size' | 'sidebar') => (e: KeyboardEvent<HTMLElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key))
            return;
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 40 : 16;
        if (kind === 'sidebar') {
            const l = sidebarLimits(available());
            const next = setWidth(e.key === 'Home' ? l.min : e.key === 'End' ? l.max : sidebarWidth + (e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0));
            try {
                localStorage.setItem('skyrail.sidebar-width', String(next));
            }
            catch { }
        }
        else {
            const next = resizeWindow(current.current, e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0, e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0, limits());
            current.current = next;
            preferred.current = next;
            setRect(next);
            save(next);
        }
    };
    const handlers = (kind: 'move' | 'size' | 'sidebar') => ({ onPointerDown: start(kind), onPointerMove: move, onPointerUp: stop, onPointerCancel: stop,
        onLostPointerCapture: stop, ...(kind !== 'move' ? { onKeyDown: keys(kind) } : {}) });
    const shrink = () => {
        const next = shrinkWindow(current.current, limits());
        if (!next) return false;
        current.current = next;
        preferred.current = next;
        setRect(next);
        save(next);
        return true;
    };
    return { shrink, rect, sidebarWidth, sidebarRange: sidebarLimits(available()), move: handlers('move'), resize: handlers('size'), separator: handlers('sidebar') };
}
