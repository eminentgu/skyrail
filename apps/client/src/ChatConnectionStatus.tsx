import React from 'react';
import { t as ui } from './i18n';
import { Icon } from './Icon';

export function ChatConnectionStatus({ network, caughtUp, retry }: {
  network: string; caughtUp: boolean; retry: () => void;
}) {
  if (network === 'online' && !caughtUp) return null;
  const restored = network === 'online';
  const initial = network === 'connecting';
  return <div className={'chat-connection-status' + (restored ? ' is-restored' : '')} role="status" aria-live="polite">
    <Icon name={restored ? 'check' : 'history'} size={16} />
    <div>
      <strong>{ui(restored ? '已恢复，记录已更新' : initial ? '正在连接对话…' : network === 'offline' ? '当前离线，等待网络恢复' : '正在重连并补齐记录…')}</strong>
      {!restored && !initial && <p>{ui('已提交的任务不会因网页断线被取消。恢复连接后自动获取最新进度，无需重复发送。')}</p>}
    </div>
    {!restored && !initial && <button type="button" onClick={retry}>{ui('立即重试')}</button>}
  </div>;
}
