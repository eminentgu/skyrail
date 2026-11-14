export type WindowRect = {left:number;top:number;width:number;height:number};
export type WindowLimits = {left:number;top:number;right:number;bottom:number;minWidth:number;maxWidth:number;minHeight:number;maxHeight:number};
export function windowLimits(viewport:{left?:number;top?:number;width:number;height:number},headerBottom?:number,desktop?:boolean):WindowLimits;
export function fitWindow(rect:WindowRect,limits:WindowLimits):WindowRect;
export function resizeWindow(rect:WindowRect,dx:number,dy:number,limits:WindowLimits):WindowRect;
export function sidebarLimits(available:number):{min:number;max:number};
export function fitSidebar(width:number,available:number):number;
