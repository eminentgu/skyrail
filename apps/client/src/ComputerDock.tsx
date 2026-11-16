import React, { useRef, useState } from 'react';
import { Icon } from './Icon';
import { t as ui } from './i18n';
import { useFloatingComputer } from './useFloatingComputer';
import { ComputerControlsHost, ComputerTakeoverHost, ComputerKeyboardHost } from './ComputerControls';

type Layout='floating'|'sidebar'|'full';
type Props={visible:boolean;desktop:boolean;layout:Layout;toolsOpen:boolean;onTools:()=>void;
  onLayout:(layout:Layout)=>void;onClose:()=>void;children:React.ReactNode};
export function ComputerDock({visible,desktop,layout,toolsOpen,onTools,onLayout,onClose,children}:Props){
  const host=useRef<HTMLElement>(null);
  const [controlsHost,setControlsHost]=useState<HTMLDivElement|null>(null);
  const [takeoverHost,setTakeoverHost]=useState<HTMLDivElement|null>(null);
  const [keyboardHost,setKeyboardHost]=useState<HTMLDivElement|null>(null);
  const floating=visible&&layout==='floating',sidebar=visible&&layout==='sidebar';
  const frame=useFloatingComputer(floating,host,desktop,sidebar);
  return <aside ref={host} className={'computer-dock '+(!visible?'is-hidden ':'')+(floating?desktop?'is-desktop-floating':'is-mobile-floating':'')+(toolsOpen?' controls-open':'')}
    style={floating?frame.rect:sidebar?{width:frame.sidebarWidth}:undefined}
    aria-label={ui(floating?'电脑浮窗':sidebar?'电脑侧栏':'电脑')}>
    {sidebar&&<div className="computer-sidebar-resizer" role="separator" tabIndex={0} aria-orientation="vertical"
      aria-label={ui('调整侧栏宽度')} aria-valuemin={Math.round(frame.sidebarRange.min)} aria-valuemax={Math.round(frame.sidebarRange.max)}
      aria-valuenow={Math.round(frame.sidebarWidth)} {...frame.separator}><i/></div>}
    <div className="computer-dock-actions">
      <div className={'computer-window-title'+(floating?' is-draggable':'')} {...(floating?frame.move:{})}>
        <Icon name="monitor" size={17}/><span>{ui('电脑')}</span>
        {floating&&<span className="window-drag-dots" aria-hidden="true">⠿</span>}
      </div>
      <div className="computer-takeover-slot" ref={setTakeoverHost} />
      <button className="computer-controls-toggle" aria-label={ui('电脑控制')} aria-expanded={toolsOpen}
        aria-controls="computer-controls-panel" onClick={onTools}><Icon name="settings" size={17}/><span>{ui('控制')}</span></button>
      <button className="computer-minimize" aria-label={ui('收起电脑')} title={ui('收起电脑')} onClick={onClose}><Icon name="minus" size={19}/></button>
    </div>
    <div className="computer-dock-body">
      <ComputerControlsHost value={controlsHost}><ComputerTakeoverHost value={takeoverHost}><ComputerKeyboardHost value={keyboardHost}>
        <div className="desk-host">{children}</div>
      </ComputerKeyboardHost></ComputerTakeoverHost></ComputerControlsHost>
      <div id="computer-controls-panel" className="computer-controls-panel" ref={setControlsHost} hidden={!toolsOpen} aria-label={ui('电脑控制面板')}>
        <div className="computer-layout-controls">
          <span className="control-label">{ui('显示方式')}</span>
          <div className="control-segments" role="group" aria-label={ui('电脑布局')}>
            {(['floating',...(desktop?['sidebar'] as const:[]),'full'] as const).map(mode=><button key={mode} aria-pressed={layout===mode} onClick={()=>onLayout(mode)}>
              {ui(mode==='floating'?'浮窗':mode==='sidebar'?'侧边栏':'最大化')}
            </button>)}
          </div>
          {floating&&<div className="control-actions">
            <button className="computer-window-resizer" aria-label={ui('拖动调整窗口大小')} title={ui('拖动调整窗口大小')} {...frame.resize}><Icon name="resize" size={17}/>{ui('调整大小')}</button>
            <button onClick={()=>{if(!frame.shrink())onClose();}}>{ui('缩小窗口')}</button>
          </div>}
        </div>
      </div>
    </div>
    <div className="computer-keyboard-host" ref={setKeyboardHost}/>
  </aside>;
}
