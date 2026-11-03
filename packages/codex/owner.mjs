import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
const execute = promisify(execFile);
const fail = (message, status = 409) =>
  Object.assign(Error(message), { status });
export const isWriterConflict = (error) =>
  /active writer|另一客户端占用|其他.*客户端.*占用/i.test(
    typeof error === "string" ? error : error?.message || "",
  );
export async function inspectWriter(
  threadId,
  {
    run = async (command, args) =>
      (
        await execute(command, args, {
          encoding: "utf8",
          timeout: 2500,
          maxBuffer: 2 * 1024 * 1024,
        })
      ).stdout,
    lockRoot = path.join(process.env.CODEX_HOME || path.join(homedir(), ".codex"), "thread-writer-locks"),
    uid = process.getuid?.(),
  } = {},
) {
  if (!/^[a-f0-9-]{36}$/i.test(threadId))
    throw fail("无效 Codex 会话编号", 400);
  let result;
  try {
    result = await run("/usr/sbin/lsof", [
      "-n",
      "-Fpc",
      path.join(lockRoot, threadId + ".lock"),
    ]);
  } catch (e) {
    if (e.code === 1 || e.code === "ENOENT") return { occupied: false };
    throw fail("暂时无法检查会话占用，请稍后重试");
  }
  const pid = Number(result.match(/^p(\d+)$/m)?.[1]);
  if (!pid) return { occupied: false };
  try {
    const [identity, started, opened] = await Promise.all([
      run("/bin/ps", ["-p", String(pid), "-o", "uid=,comm=,args="]),
      run("/bin/ps", ["-p", String(pid), "-o", "lstart="]),
      run("/usr/sbin/lsof", ["-n", "-p", String(pid), "-Fn"]),
    ]);
    const ownerUid = Number(identity.trim().match(/^(\d+)/)?.[1]);
    const trusted =
      pid !== process.pid &&
      ownerUid === uid &&
      /\bcodex\b/.test(identity) &&
      /\bapp-server\b/.test(identity);
    const ids = [
      ...new Set(
        opened
          .split("\n")
          .filter((line) => line.startsWith("n" + lockRoot + path.sep))
          .map((line) => path.basename(line.slice(1)))
          .filter((name) => /^[a-f0-9-]{36}\.lock$/i.test(name))
          .map((name) => name.slice(0, -5)),
      ),
    ].sort();
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ pid, started: started.trim(), ids }))
      .digest("hex");
    return {
      occupied: true,
      pid,
      client: identity.includes("/Applications/ChatGPT.app/")
        ? "Codex 桌面端"
        : "Codex 后台连接",
      sessionCount: Math.max(1, ids.length),
      fingerprint,
      canStop: trusted,
    };
  } catch (e) {
    if (e.code === 1) return { occupied: false };
    throw fail("占用进程状态已变化，请重新检查");
  }
}
export async function stopWriter(
  threadId,
  fingerprint,
  {
    inspect = inspectWriter,
    kill = (pid) => process.kill(pid, "SIGTERM"),
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const owner = await inspect(threadId);
  if (!owner.occupied) return { released: true };
  if (!owner.canStop)
    throw fail("这个连接不是当前用户的 Codex 后台进程，无法由 Skyrail 结束");
  if (owner.fingerprint !== fingerprint)
    throw fail("占用连接或关联会话已变化，请重新检查后确认");
  try {
    kill(owner.pid);
  } catch (e) {
    if (e.code !== "ESRCH") throw fail("系统未允许结束占用进程");
  }
  for (let n = 0; n < 12; n++) {
    await wait(250);
    const current = await inspect(threadId);
    if (!current.occupied) return { released: true };
    if (current.pid !== owner.pid)
      throw fail("原连接已结束，但会话已被另一连接接管，请重新检查");
  }
  throw fail("已请求结束占用连接，仍在释放中，请稍后重新连接");
}
