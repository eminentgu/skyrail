import { mkdir, realpath, opendir, open, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { imageType, MAX_IMAGE } from "../../packages/codex/attachments.mjs";
export const MAX_UPLOAD = 50 * 1024 * 1024;
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
const inside = (root, target) =>
  target === root || target.startsWith(root + path.sep);
export function safeRelative(value = "") {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    value.includes("\\") ||
    path.isAbsolute(value) ||
    value.split("/").includes("..")
  )
    throw fail("无效文件路径");
  return value;
}
export function safeName(name) {
  const value = String(name || "file")
    .normalize("NFC")
    .replace(/[\x00-\x1f\x7f/\\:]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 180);
  return value || "file";
}
export class ThreadFiles {
  constructor(dataRoot, { maxBytes = MAX_UPLOAD } = {}) {
    this.dataRoot = path.resolve(dataRoot);
    this.maxBytes = maxBytes;
  }
  async root(thread, kind) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(thread.id)) throw fail("无效对话编号");
    if (kind === "workspace") {
      if (!thread.cwd || !path.isAbsolute(thread.cwd))
        throw fail("当前项目尚未创建", 404);
      return realpath(thread.cwd);
    }
    if (kind !== "uploads") throw fail("无效文件范围");
    const folder = path.join(this.dataRoot, thread.id, "uploads");
    await mkdir(folder, { recursive: true, mode: 0o700 });
    return realpath(folder);
  }
  async resolve(thread, kind, relative = "") {
    safeRelative(relative);
    const root = await this.root(thread, kind),
      target = await realpath(path.join(root, relative));
    if (!inside(root, target)) throw fail("文件位于当前项目之外", 403);
    return { root, target };
  }
  async list(thread, kind, relative = "") {
    const { target } = await this.resolve(thread, kind, relative),
      dir = await opendir(target),
      entries = [];
    let truncated = false;
    if (kind === "uploads" && !relative) {
      for await (const entry of dir) {
        if (entries.length >= 300) {
          truncated = true;
          break;
        }
        if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name))
          continue;
        const page = await this.list(thread, kind, entry.name);
        entries.push(...page.entries.filter((f) => !f.directory));
      }
      entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
      return { root: kind, path: relative, entries, truncated };
    }
    for await (const entry of dir) {
      if (entries.length >= 300) {
        truncated = true;
        break;
      }
      if (entry.name.endsWith(".part")) continue;
      const rel = path.posix.join(relative, entry.name);
      try {
        const { target: file } = await this.resolve(thread, kind, rel);
        const handle = await open(
          file,
          constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
        );
        try {
          const stat = await handle.stat();
          if (stat.isDirectory() || stat.isFile())
            entries.push({
              name: entry.name,
              path: rel,
              directory: stat.isDirectory(),
              size: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            });
        } finally {
          await handle.close();
        }
      } catch {}
    }
    entries.sort(
      (a, b) =>
        Number(b.directory) - Number(a.directory) ||
        a.name.localeCompare(b.name),
    );
    return { root: kind, path: relative, entries, truncated };
  }
  async upload(thread, filename, source, length) {
    if (
      length !== undefined &&
      (!/^\d+$/.test(String(length)) || Number(length) > this.maxBytes)
    )
      throw fail("单个文件最多 50 MB", 413);
    const root = await this.root(thread, "uploads"),
      id = randomUUID(),
      name = safeName(filename),
      folder = path.join(root, id);
    await mkdir(folder, { mode: 0o700 });
    const tmp = path.join(folder, ".upload.part"),
      destination = path.join(folder, name);
    let size = 0;
    try {
      const handle = await open(tmp, "wx", 0o600);
      const bounded = new Transform({
        transform: (chunk, _enc, done) => {
          size += chunk.length;
          done(
            size > this.maxBytes ? fail("单个文件最多 50 MB", 413) : null,
            chunk,
          );
        },
      });
      await pipeline(source, bounded, handle.createWriteStream());
      await rename(tmp, destination);
      const previewHandle = await open(destination, "r");
      let mediaType;
      try {
        mediaType = await imageType(previewHandle);
      } finally {
        await previewHandle.close();
      }
      if (mediaType && size > MAX_IMAGE) throw fail("单张图片最多 20 MB", 413);
      return { root: "uploads", path: id + "/" + name, name, size, mediaType };
    } catch (e) {
      await rm(folder, { recursive: true, force: true });
      throw e;
    }
  }
  async download(thread, kind, relative) {
    const { target } = await this.resolve(thread, kind, relative);
    const handle = await open(
      target,
      constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
    );
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      throw fail("请选择普通文件");
    }
    return { handle, stat, name: path.basename(target) };
  }
  async attachments(thread, items = []) {
    if (!Array.isArray(items) || items.length > 20)
      throw fail("每条消息最多添加 20 个文件");
    const result = [];
    for (const item of items) {
      if (
        !item ||
        !["uploads", "workspace"].includes(item.root) ||
        typeof item.path !== "string"
      )
        throw fail("无效附件");
      const { target } = await this.resolve(thread, item.root, item.path);
      const handle = await open(
        target,
        constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw fail("附件必须是普通文件");
        const mediaType = await imageType(handle);
        if (mediaType && stat.size > MAX_IMAGE)
          throw fail("单张图片最多 20 MB", 413);
        result.push({
          mediaType,
          root: item.root,
          path: item.path,
          name: path.basename(target),
          size: stat.size,
          localPath: target,
          threadId: thread.id,
        });
      } finally {
        await handle.close();
      }
    }
    return result;
  }
}
