import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  sessionPermissions,
  turnPermissions,
  loadPermissions,
  savePermissions,
  approvalResponse,
} from "../packages/codex/permissions.mjs";
import { prepareSession } from "../packages/codex/session.mjs";
test("full access defaults to never approvals and danger full access at session and turn", () => {
  assert.deepEqual(sessionPermissions(), {
    approvalPolicy: "never",
    sandbox: "danger-full-access",
  });
  assert.deepEqual(turnPermissions(), {
    approvalPolicy: "never",
    sandboxPolicy: { type: "dangerFullAccess" },
  });
  assert.equal(
    turnPermissions(false, "/project").sandboxPolicy.writableRoots[0],
    "/project",
  );
  assert.equal(sessionPermissions(false).approvalPolicy, "on-request");
});
test("permission default and changes persist, malformed settings never silently elevate", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "skyrail-perms-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "settings.json");
  assert.equal((await loadPermissions(file)).fullAccess, true);
  await savePermissions(file, false);
  assert.equal((await loadPermissions(file)).fullAccess, false);
  await assert.rejects(savePermissions(file, "true"));
  await writeFile(file, "{}");
  await assert.rejects(loadPermissions(file), /格式无效/);
});
test("switching permission mode resumes same Codex session under new policy", async () => {
  const thread = { id: "local", codexId: "native", appliedFullAccess: true },
    calls = [];
  const resumed = new Set(["local"]);
  await prepareSession(
    { rpc: async (method, p) => calls.push({ method, p }) },
    thread,
    {
      cwd: "/p",
      tools: [],
      instructions: "",
      resumed,
      save: async () => {},
      fullAccess: false,
    },
  );
  assert.deepEqual(
    calls.map((c) => c.method),
    ["thread/unsubscribe", "thread/resume"],
  );
  assert.equal(calls[1].p.threadId, "native");
  assert.equal(calls[1].p.sandbox, "workspace-write");
});
test("known runtime approvals map to typed responses, unknown requests are never approved", () => {
  assert.deepEqual(
    approvalResponse("item/commandExecution/requestApproval", true),
    { decision: "accept" },
  );
  assert.deepEqual(approvalResponse("item/fileChange/requestApproval", false), {
    decision: "decline",
  });
  assert.deepEqual(
    approvalResponse("item/permissions/requestApproval", true, {
      network: null,
      fileSystem: { write: ["/tmp"] },
    }),
    { permissions: { fileSystem: { write: ["/tmp"] } }, scope: "turn" },
  );
  assert.throws(() => approvalResponse("unknown", true));
});
