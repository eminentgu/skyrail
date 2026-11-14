import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { t as ui } from "./i18n";
import { useFloatingComputer } from "./useFloatingComputer";
type Layout = 'floating' | 'sidebar' | 'full';
type Props = {
    visible: boolean;
    desktop: boolean;
    layout: Layout;
    toolsOpen: boolean;
    onTools: () => void;
    onLayout: (layout: Layout) => void;
    onClose: () => void;
    children: React.ReactNode;
};
export function ComputerDock({ visible, desktop, layout, toolsOpen, onTools, onLayout, onClose, children }: Props) {
    const host = useRef<HTMLElement>(null), menuButton = useRef<HTMLButtonElement>(null);
    const [menuOpen, setMenuOpen] = useState(false), [resizing, setResizing] = useState(false);
    const floating = visible && layout === 'floating', sidebar = visible && layout === 'sidebar';
    const frame = useFloatingComputer(floating, host, desktop, sidebar);
    useEffect(() => { setMenuOpen(false); setResizing(false); }, [visible, layout]);
    const choose = (next: Layout) => { setMenuOpen(false); onLayout(next); };
    const dismiss = () => { setMenuOpen(false); menuButton.current?.focus(); };
    return <aside ref={host} className={'computer-dock ' + (!visible ? 'is-hidden ' : '') + (floating ? desktop ? 'is-desktop-floating' : 'is-mobile-floating' : '')} style={floating ? frame.rect : sidebar ? { width: frame.sidebarWidth } : undefined} aria-label={ui(floating ? '电脑浮窗' : sidebar ? '电脑侧栏' : '电脑')} onKeyDown={event => { if (event.key === 'Escape' && menuOpen) {
        event.stopPropagation();
        dismiss();
    } }}>
    {sidebar && <div className="computer-sidebar-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={ui('调整侧栏宽度')} aria-valuemin={Math.round(frame.sidebarRange.min)} aria-valuemax={Math.round(frame.sidebarRange.max)} aria-valuenow={Math.round(frame.sidebarWidth)} {...frame.separator}><i /></div>}
    <div className="computer-dock-actions">
      <button className="computer-dock-toggle" aria-label={ui('收起电脑')} title={ui('收起电脑')} onClick={onClose}>
        <Icon name="monitor" size={18}/>
      </button>
      {floating ? <button className="mobile-window-grip" aria-label={ui('拖动电脑浮窗')} {...frame.move}>
        <span>{ui('电脑')}</span><i aria-hidden="true"/>
      </button> : <span className="computer-dock-title">{ui('电脑')}</span>}
      <button ref={menuButton} className="computer-menu-trigger" aria-label={ui('电脑菜单')} aria-expanded={menuOpen} aria-controls="computer-dock-menu" onClick={event => { event.currentTarget.focus(); setMenuOpen(!menuOpen); }}>
        <Icon name={menuOpen ? 'close' : 'more'} size={20}/>
      </button>
    </div>
    {menuOpen && <div id="computer-dock-menu" className="computer-dock-menu" aria-label={ui('电脑菜单选项')}>
      <div className="computer-menu-section">
        <span className="computer-menu-label">{ui('显示方式')}</span>
        <div className="computer-layout-options" role="group" aria-label={ui('电脑布局')}>
          {(['floating', ...(desktop ? ['sidebar'] as const : []), 'full'] as const).map(mode => <button key={mode} aria-pressed={layout === mode} onClick={() => choose(mode)}>
            <Icon name={mode === 'floating' ? 'monitor' : mode === 'sidebar' ? 'sidebar' : 'expand'} size={18}/>
            <span>{ui(mode === 'floating' ? '浮窗' : mode === 'sidebar' ? '侧边栏' : '最大化')}</span>
          </button>)}
        </div>
      </div>
      <div className="computer-menu-options">
        <button aria-pressed={toolsOpen} onClick={() => { onTools(); dismiss(); }}>
          <Icon name="settings" size={18}/><span>{ui(toolsOpen ? '收起操作工具' : '展开操作工具')}</span>
          <small>{ui('键盘、画质与连接')}</small><Icon name="chevron" size={15}/>
        </button>
        {floating && !desktop && <button onClick={() => { const changed = frame.shrink(); if (toolsOpen) onTools(); dismiss(); if (!changed) onClose(); }}>
          <Icon name="expand" size={18}/><span>{ui('缩小窗口')}</span>
        </button>}
        {floating && <button onClick={() => { setResizing(true); if (!desktop && toolsOpen) onTools(); dismiss(); }}>
          <Icon name="expand" size={18}/><span>{ui('调整窗口大小')}</span><Icon name="chevron" size={15}/>
        </button>}
        <button onClick={() => { dismiss(); onClose(); }}>
          <Icon name="back" size={18}/><span>{ui('收起电脑')}</span>
        </button>
      </div>
    </div>}
    <div className="desk-host">{children}</div>
    {floating && resizing && <div className="computer-resize-rail">
      <span>{ui('拖动右侧手柄调整大小')}</span>
      <button className="computer-resize-done" aria-label={ui('完成调整大小')} onClick={() => setResizing(false)}><Icon name="check" size={17}/>{ui('完成')}</button>
      <button className="computer-window-resizer" aria-label={ui('拖动调整窗口大小')} title={ui('拖动调整窗口大小')} onClick={event => event.currentTarget.focus()} {...frame.resize}><Icon name="resize" size={20}/></button>
    </div>}
  </aside>;
}
