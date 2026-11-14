import React from "react";
import { t as ui } from "./i18n";
import { Icon } from "./Icon";

export function StreamStatus({
  label,
  warning = false,
  retry,
  children,
}: {
  label: string;
  warning?: boolean;
  retry?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <details className={"stream-status" + (warning ? " is-warning" : "")}>
      <summary aria-label={ui("连接状态：{0}", label)} title={label}>
        <span className="status-dot" aria-hidden="true" />
        <Icon name="chevron" size={12} />
      </summary>
      <div role="status">
        <span>{label}</span>
        {children}
        {retry && <button type="button" onClick={retry}>{ui("重新连接")}</button>}
      </div>
    </details>
  );
}
