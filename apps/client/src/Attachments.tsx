import { t as ui } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import { downloadUrl, type Attachment } from "./FilesPanel";
import { Icon } from "./Icon";
export const previewUrl = (file: Attachment) =>
  downloadUrl(file).replace("/download?", "/preview?");
export const isPicture = (file: Attachment) =>
  file.mediaType?.startsWith("image/") ||
  (file.mediaType === undefined && /\.(png|jpe?g|webp|gif)$/i.test(file.name));
export function Picture({
  file,
  compact = false,
}: {
  file: Attachment;
  compact?: boolean;
}) {
  const [opened, setOpened] = useState(false),
    [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (opened) dialog.current?.showModal();
  }, [opened]);
  return (
    <>
      {!failed ? (
        <button
          type="button"
          className={"attachment-picture" + (compact ? " compact" : "")}
          aria-label={ui("查看图片：") + file.name}
          onClick={() => setOpened(true)}
        >
          <img
            src={previewUrl(file)}
            alt={file.name}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </button>
      ) : (
        <a href={downloadUrl(file)} download={file.name}>
          {file.name}
          {ui("· 预览不可用，下载查看")}
        </a>
      )}
      {opened && (
        <dialog
          ref={dialog}
          className="picture-dialog"
          aria-label={ui("图片预览：") + file.name}
          onCancel={(e) => {
            e.preventDefault();
            setOpened(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpened(false);
          }}
        >
          <div className="picture-toolbar">
            <span>{file.name}</span>
            <a
              href={downloadUrl(file)}
              download={file.name}
              aria-label={ui("下载图片")}
            >
              <Icon name="download" />
            </a>
            <button
              type="button"
              aria-label={ui("关闭图片预览")}
              onClick={() => setOpened(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <img src={previewUrl(file)} alt={file.name} />
        </dialog>
      )}
    </>
  );
}
export function MessageAttachments({ files }: { files: Attachment[] }) {
  return (
    <div className="message-files">
      {files.map((file) =>
        isPicture(file) ? (
          <figure className="picture-file" key={file.root + file.path}>
            <Picture file={file} />
            <figcaption>
              <a href={downloadUrl(file)} download={file.name}>
                {file.name}
                <Icon name="download" size={15} />
              </a>
            </figcaption>
          </figure>
        ) : (
          <a
            key={file.root + file.path}
            href={downloadUrl(file)}
            download={file.name}
          >
            <Icon name="file" size={16} />
            {file.name}
            <Icon name="download" size={15} />
          </a>
        ),
      )}
    </div>
  );
}
