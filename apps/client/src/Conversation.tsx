import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./Icon";
export type ChatMessage = {
  id: string;
  role: string;
  text: string;
  createdAt?: string;
  status?: string;
  action?: string;
  app?: string;
  error?: string;
  pending?: boolean;
};
export type ChatApproval = {
  id: string;
  threadId: string;
  kind?: string;
  app: string;
  args: { action: string; index?: number; value?: string; key?: string };
};
export function groupMessages(messages: ChatMessage[]) {
  const result: ChatMessage[] = [];
  for (const message of messages) {
    const last = result.at(-1);
    if (message.role === "assistant" && last?.role === "assistant") {
      last.text += "\n\n" + message.text;
    } else result.push({ ...message });
  }
  return result;
}
function CopyReply({ text }: { text: string }) {
  const [state, setState] = React.useState("");
  return (
    <button
      className="message-copy"
      aria-label="复制 Codex 回复"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("已复制");
        } catch {
          setState("复制未成功");
        }
        setTimeout(() => setState(""), 2000);
      }}
    >
      <Icon name={state === "已复制" ? "check" : "copy"} size={14} />
      {state || "复制回复"}
    </button>
  );
}
function ApprovalCard({
  approval,
  decide,
}: {
  approval: ChatApproval;
  decide: (id: string, allow: boolean, allowAll?: boolean) => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false),
    [error, setError] = React.useState("");
  const application = approval.kind === "application";
  const act = async (allow: boolean, allowAll = false) => {
    setPending(true);
    try {
      await decide(approval.id, allow, allowAll);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  };
  const description = application
    ? `打开 ${approval.app}，连接它的窗口，并让 Codex 在当前对话中观察与操作。`
    : approval.args.action === "press"
      ? `点击控件 ${approval.args.index}`
      : approval.args.action === "setValue"
        ? `填写：${approval.args.value}`
        : `按下 ${approval.args.key}`;
  return (
    <div
      className="chat-approval"
      role="group"
      aria-label={application ? "应用访问确认" : "电脑操作确认"}
    >
      <div className="approval-heading">
        <span>◈</span>
        <strong>
          {application ? "允许使用这个应用？" : "确认这次电脑操作"}
        </strong>
      </div>
      <p>{description}</p>
      {application && (
        <small>
          可以单次确认，也可以允许此次连接中的全部操作；换应用或断开后自动失效。
        </small>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="approval-buttons">
        <button disabled={pending} onClick={() => act(false)}>
          拒绝
        </button>
        <button disabled={pending} onClick={() => act(true, true)}>
          本次连接全部允许
        </button>
        <button
          className="primary"
          disabled={pending}
          onClick={() => act(true)}
        >
          {pending ? "正在处理…" : application ? "允许并连接" : "允许本次"}
        </button>
      </div>
    </div>
  );
}
export function Conversation({
  messages,
  approvals,
  decide,
}: {
  messages: ChatMessage[];
  approvals: ChatApproval[];
  decide: (id: string, allow: boolean, allowAll?: boolean) => Promise<void>;
}) {
  return (
    <>
      {groupMessages(messages).map((m) => {
        const approval = approvals.find((a) => "tool:" + a.id === m.id);
        const time = m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString("zh-HK", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        if (m.role === "tool")
          return (
            <div className={"tool-event " + m.status} key={m.id}>
              <div className="tool-event-line">
                <span aria-hidden>
                  {m.status === "completed"
                    ? "✓"
                    : m.status === "failed"
                      ? "!"
                      : m.status === "waiting_approval"
                        ? "◈"
                        : "◌"}
                </span>
                <strong>{m.text}</strong>
                <span>
                  {m.status === "waiting_approval"
                    ? "等待确认"
                    : m.status === "completed"
                      ? "已完成"
                      : m.status === "failed"
                        ? "未完成"
                        : "进行中"}
                </span>
              </div>
              {approval && <ApprovalCard approval={approval} decide={decide} />}
              <details>
                <summary>查看详情</summary>
                <p>
                  {m.app || "本机 Mac"}
                  {m.error ? " · " + m.error : ""}
                </p>
              </details>
            </div>
          );
        return (
          <article className={"message " + m.role} key={m.id}>
            <div className="message-meta">
              <span aria-hidden="true" className={"avatar " + m.role}>
                {m.role === "user" ? "●" : <Icon name="code" size={15} />}
              </span>
              <span>{m.role === "user" ? "你" : "Codex"}</span>
              <time>{time}</time>
              {m.pending && <small>发送结果待确认</small>}
            </div>
            <div className="message-body">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noreferrer noopener">
                      {children}
                    </a>
                  ),
                  img: ({ alt }) => <span>[图片：{alt || "未加载"}]</span>,
                }}
              >
                {m.text || "正在生成…"}
              </Markdown>
            </div>
            {m.role === "assistant" && m.text && <CopyReply text={m.text} />}
          </article>
        );
      })}
      {approvals
        .filter((a) => !messages.some((m) => m.id === "tool:" + a.id))
        .map((a) => (
          <ApprovalCard key={a.id} approval={a} decide={decide} />
        ))}
    </>
  );
}
