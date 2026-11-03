import { spawn } from "node:child_process";
import { opendir, stat, open } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

// Run filesystem calls in a disposable process: cloud providers can leave a
// syscall pending beyond an ordinary Promise timeout. No shell or GUI driver.
export function boundedFiles(request, { timeoutMs = 8000, launch = spawn } = {}) {
  return new Promise((resolve) => {
    const child = launch(process.execPath, [import.meta.filename, "--worker", JSON.stringify(request)], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "", settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ status: "timeout", complete: false, message: "本地文件系统未在时限内响应；不能据此判断文件不存在。停止重复扫描，检查 macOS 隐私授权或云盘下载状态。" });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 128 * 1024) {
        child.kill("SIGKILL");
        finish({ status: "error", complete: false, message: "文件检查输出超限" });
      }
    });
    child.stderr.resume();
    child.on("error", (e) => finish({ status: "error", complete: false, message: e.message }));
    child.on("close", () => {
      if (settled) return;
      try { finish(JSON.parse(output)); }
      catch { finish({ status: "error", complete: false, message: "文件检查进程未返回有效结果" }); }
    });
  });
}

export async function inspectFiles({ action = "find", directory = path.join(os.homedir(), "Desktop"), query, file }) {
  if (action === "probe") {
    if (!path.isAbsolute(file || "")) throw Error("probe 需要绝对文件路径");
    const metadata = await stat(file);
    if (!metadata.isFile()) throw Error("请选择普通文件");
    const handle = await open(file, "r");
    try {
      const { bytesRead } = await handle.read(Buffer.alloc(4), 0, 4, 0);
      return { status: "readable", complete: true, path: file, size: metadata.size, bytesRead };
    } finally { await handle.close(); }
  }
  if (action !== "find" || !path.isAbsolute(directory) || typeof query !== "string" || !query.trim()) throw Error("find 需要绝对目录路径和文件名关键词");
  const normalized = query.normalize("NFKC").toLowerCase().trim();
  // A user may say “反馈3723” while the actual name is “3723-顾问…”.
  // Numeric fallback is returned as a candidate, never silently selected.
  const digits = normalized.match(/\d{3,}/g) || [];
  const entries = [], dir = await opendir(directory);
  let scanned = 0, complete = true;
  for await (const entry of dir) {
    if (++scanned > 2000 || entries.length >= 30) { complete = false; break; }
    if (!entry.isFile()) continue;
    const name = entry.name.normalize("NFKC").toLowerCase();
    const exact = name.includes(normalized);
    if (exact || digits.some((n) => name.includes(n))) entries.push({ name: entry.name, path: path.join(directory, entry.name), match: exact ? "name" : "numeric_candidate" });
  }
  return { status: entries.length ? "found" : "not_found", complete, directory, recursive: false, scanned, entries };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv[2] === "--worker") {
    try { console.log(JSON.stringify(await inspectFiles(JSON.parse(process.argv[3])))); }
    catch (e) { console.log(JSON.stringify({ status: ["EACCES", "EPERM"].includes(e.code) ? "denied" : e.code === "ENOENT" ? "not_found" : "error", complete: false, code: e.code, message: e.message })); }
  } else {
    const [action = "find", value, directory] = process.argv.slice(2);
    console.log(JSON.stringify(await boundedFiles(action === "probe" ? { action, file: value } : { action, query: value, ...(directory ? { directory } : {}) })));
  }
}
