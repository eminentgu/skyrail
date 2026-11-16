import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

export const ComputerControlsHost = createContext<HTMLElement | null>(null);

// Keep transport components mounted; only their controls live in the one panel.
export function ComputerControls({children}:{children:React.ReactNode}) {
  const host=useContext(ComputerControlsHost);
  const content=<div className="computer-control-group">{children}</div>;
  return host?createPortal(content,host):content;
}

export const ComputerTakeoverHost = createContext<HTMLElement | null>(null);
export function ComputerTakeover({children}:{children:React.ReactNode}) {
  const host=useContext(ComputerTakeoverHost);
  return host ? createPortal(children,host) : <>{children}</>;
}
