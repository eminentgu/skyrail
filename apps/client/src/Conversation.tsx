import { getLanguage, t as ui } from "./i18n";
import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadUrl, type Attachment } from "./FilesPanel";
import { MessageAttachments, Picture } from "./Attachments";
import { Icon } from "./Icon";
export type ChatMessage = {
  id: string;
  attachments?: Attachment[];
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
      aria-label={ui("复制 Codex 回复")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState(ui("已复制"));
        } catch {
          setState(ui("复制未成功"));
        }
        setTimeout(() => setState(""), 2000);
      }}
    >
      <Icon name={state === ui("已复制") ? "check" : "copy"} size={14} />
      {state || ui("复制回复")}
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
  const description =
    approval.kind === "runtime"
      ? approval.args.value || ui("确认本次命令 / 文件操作")
      : application
        ? ui(
            "打开 {0}，连接它的窗口，并让 Codex 在当前对话中观察与操作。",
            approval.app,
          )
        : approval.args.action === "press"
          ? ui("点击控件 {0}", approval.args.index)
          : approval.args.action === "setValue"
            ? ui("填写：{0}", approval.args.value)
            : ui("按下 {0}", approval.args.key);
  return (
    <div
      className="chat-approval"
      role="group"
      aria-label={application ? ui("应用访问确认") : ui("电脑操作确认")}
    >
      <div className="approval-heading">
        <span>◈</span>
        <strong>
          {approval.kind === "runtime"
            ? ui("命令与文件权限确认")
            : application
              ? ui("允许使用这个应用？")
              : ui("确认这次电脑操作")}
        </strong>
      </div>
      <p>{description}</p>
      {application && (
        <small>
          {ui(
            "可以单次确认，也可以允许此次连接中的全部操作；换应用或断开后自动失效。",
          )}
        </small>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="approval-buttons">
        <button disabled={pending} onClick={() => act(false)}>
          {ui("拒绝")}
        </button>
        <button disabled={pending} onClick={() => act(true, true)}>
          {ui("本次连接全部允许")}
        </button>
        <button
          className="primary"
          disabled={pending}
          onClick={() => act(true)}
        >
          {pending
            ? ui("正在处理…")
            : application
              ? ui("允许并连接")
              : ui("允许本次")}
        </button>
      </div>
    </div>
  );
}
export function Conversation({
  threadId,
  cwd,
  messages,
  approvals,
  decide,
}: {
  threadId?: string;
  cwd?: string;
  messages: ChatMessage[];
  approvals: ChatApproval[];
  decide: (id: string, allow: boolean, allowAll?: boolean) => Promise<void>;
}) {
  return (
    <>
      {groupMessages(messages).map((m) => {
        const approval = approvals.find((a) => "tool:" + a.id === m.id);
        const time = m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString(getLanguage(), {
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
                <strong>{ui(m.text)}</strong>
                <span>
                  {m.status === "waiting_approval"
                    ? ui("等待确认")
                    : m.status === "completed"
                      ? ui("已完成")
                      : m.status === "failed"
                        ? ui("未完成")
                        : ui("进行中")}
                </span>
              </div>
              {approval && <ApprovalCard approval={approval} decide={decide} />}
              <details>
                <summary>{ui("查看详情")}</summary>
                <p>
                  {m.app || ui("本机 Mac")}
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
              <span>{m.role === "user" ? ui("你") : "Codex"}</span>
              <time>{time}</time>
              {m.pending && <small>{ui("发送结果待确认")}</small>}
            </div>
            <div className="message-body">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ children, ...props }) =>
                    (() => {
                      const href = props.href || "";
                      const local =
                        cwd && href.startsWith(cwd + "/")
                          ? href.slice(cwd.length + 1)
                          : !href.startsWith("/") &&
                              !/^[a-z][a-z0-9+.-]*:/i.test(href) &&
                              !href.startsWith("#")
                            ? href
                            : null;
                      return local && threadId ? (
                        <a
                          href={downloadUrl({
                            threadId,
                            root: "workspace",
                            path: local,
                            name: String(children),
                            size: 0,
                          })}
                          download
                        >
                          {children}
                        </a>
                      ) : (
                        <a {...props} target="_blank" rel="noreferrer noopener">
                          {children}
                        </a>
                      );
                    })(),
                  img: ({ src, alt }) => {
                    const href = String(src || "");
                    const local =
                      cwd && href.startsWith(cwd + "/")
                        ? href.slice(cwd.length + 1)
                        : !href.startsWith("/") &&
                            !/^[a-z][a-z0-9+.-]*:/i.test(href) &&
                            !href.startsWith("#")
                          ? href
                          : null;
                    return local && threadId ? (
                      <Picture
                        file={{
                          threadId,
                          root: "workspace",
                          path: local,
                          name: alt || local,
                          size: 0,
                        }}
                      />
                    ) : (
                      <span>
                        {ui("[图片：")}
                        {alt || ui("外部图片未加载")}]
                      </span>
                    );
                  },
                }}
              >
                {m.text || ui("正在生成…")}
              </Markdown>
            </div>
            {!!m.attachments?.length && (
              <MessageAttachments files={m.attachments} />
            )}
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
