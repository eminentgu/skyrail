import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export function sessionPermissions(fullAccess = true) {
  return {
    approvalPolicy: fullAccess ? "never" : "on-request",
    sandbox: fullAccess ? "danger-full-access" : "workspace-write",
  };
}
export function turnPermissions(fullAccess = true, cwd) {
  return {
    approvalPolicy: fullAccess ? "never" : "on-request",
    sandboxPolicy: fullAccess
      ? { type: "dangerFullAccess" }
      : { type: "workspaceWrite", writableRoots: [cwd], networkAccess: false },
  };
}
export async function loadPermissions(file) {
  try {
    const value = JSON.parse(await readFile(file, "utf8"));
    if (typeof value.fullAccess !== "boolean") throw Error("权限设置格式无效");
    return { fullAccess: value.fullAccess };
  } catch (e) {
    if (e.code === "ENOENT") return { fullAccess: true };
    throw e;
  }
}
export async function savePermissions(file, fullAccess) {
  if (typeof fullAccess !== "boolean")
    throw Object.assign(Error("无效权限模式"), { status: 400 });
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + "." + randomUUID() + ".tmp";
  await writeFile(tmp, JSON.stringify({ fullAccess }), { mode: 0o600 });
  await rename(tmp, file);
  return { fullAccess };
}
export function approvalResponse(method, allowed, permissions = {}) {
  if (
    [
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
    ].includes(method)
  )
    return { decision: allowed ? "accept" : "decline" };
  if (method === "item/permissions/requestApproval")
    return {
      permissions: allowed
        ? Object.fromEntries(
            Object.entries(permissions).filter(([, v]) => v != null),
          )
        : {},
      scope: "turn",
    };
  throw Error("尚未支持此授权类型，未批准");
}
