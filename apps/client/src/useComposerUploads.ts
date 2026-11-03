import { t as ui } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { type Attachment } from "./FilesPanel";
export function useComposerUploads({
  token,
  selected,
  attachmentCount,
  ensureThread,
  currentThread,
  attach,
  onError,
}: {
  token: string;
  selected: string;
  attachmentCount: number;
  ensureThread: () => Promise<string>;
  currentThread: () => string;
  attach: (file: Attachment) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState("");
  const active = useRef(false),
    request = useRef<XMLHttpRequest | null>(null),
    generation = useRef(0),
    alive = useRef(true),
    uploadThread = useRef("");
  function cancel() {
    generation.current++;
    request.current?.abort();
    request.current = null;
    active.current = false;
    if (alive.current) {
      setUploading(false);
      setProgress("");
    }
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancel();
    };
  }, []);
  useEffect(() => {
    if (uploadThread.current && selected !== uploadThread.current) cancel();
  }, [selected]);
  async function upload(files: File[]) {
    if (active.current || !files.length) return;
    if (!token) {
      onError(ui("正在连接，请稍后再添加图片"));
      return;
    }
    if (files.length + attachmentCount > 20) {
      onError(ui("每条消息最多添加 20 个文件"));
      return;
    }
    active.current = true;
    setUploading(true);
    onError("");
    const epoch = ++generation.current;
    try {
      const threadId = currentThread() || (await ensureThread());
      uploadThread.current = threadId;
      for (const file of files) {
        if (epoch !== generation.current) break;
        if (file.size > 50 * 1024 * 1024)
          throw Error(ui("{0} 超过 50 MB", file.name));
        if (file.type.startsWith("image/") && file.size > 20 * 1024 * 1024)
          throw Error(ui("{0} 超过单张图片 20 MB 上限", file.name));
        const uploaded = await new Promise<Attachment>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          request.current = xhr;
          xhr.open(
            "POST",
            "/v1/files/upload?" +
              new URLSearchParams({
                threadId,
                name: file.name || ui("粘贴图片.png"),
              }),
          );
          xhr.setRequestHeader("X-Skyrail-Token", token);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.timeout = 180000;
          xhr.upload.onprogress = (e) => {
            if (alive.current && epoch === generation.current)
              setProgress(
                `${file.name} · ${e.lengthComputable ? Math.round((e.loaded / e.total) * 100) + "%" : ui("上传中")}`,
              );
          };
          xhr.onload = () => {
            try {
              const d = JSON.parse(xhr.responseText);
              xhr.status >= 200 && xhr.status < 300
                ? resolve({ ...d, threadId })
                : reject(Error(d.message || ui("上传失败")));
            } catch {
              reject(Error(ui("上传响应无效")));
            }
          };
          xhr.onerror = () => reject(Error(ui("网络中断，文件未添加，请重试")));
          xhr.ontimeout = () =>
            reject(Error(ui("上传超时，文件未添加，请重试")));
          xhr.onabort = () => reject(Error(ui("上传已取消")));
          xhr.send(file);
        });
        if (epoch !== generation.current || !alive.current) break;
        if (currentThread() !== threadId) break;
        attach(uploaded);
        if (
          (file.type.startsWith("image/") ||
            /\.(heic|heif|svg)$/i.test(file.name)) &&
          !uploaded.mediaType
        )
          onError(
            ui("该图片已作为文件添加；直接看图请使用 PNG、JPEG、WebP 或 GIF。"),
          );
      }
    } catch (e) {
      if (alive.current && epoch === generation.current)
        onError((e as Error).message);
    } finally {
      if (epoch === generation.current) {
        request.current = null;
        active.current = false;
        if (alive.current) {
          setUploading(false);
          setProgress("");
        }
      }
    }
  }
  return { uploading, progress, upload, cancel };
}
