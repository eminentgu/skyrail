import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rm,
  readdir,
  realpath,
} from "node:fs/promises";
import { Readable } from "node:stream";
import os from "node:os";
import path from "node:path";
import { ThreadFiles, safeRelative } from "../apps/local-service/files.mjs";
async function fixture(t, maxBytes) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "skyrail-files-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cwd = path.join(dir, "workspace");
  await mkdir(cwd);
  return {
    dir,
    thread: { id: "test-thread", cwd },
    files: new ThreadFiles(path.join(dir, "data"), { maxBytes }),
  };
}
test("binary upload lists original Unicode name and downloads identical bytes", async (t) => {
  const { files, thread } = await fixture(t);
  const bytes = Buffer.from([0, 255, 128, 42]);
  const file = await files.upload(
    thread,
    "文件.txt",
    Readable.from([bytes]),
    bytes.length,
  );
  assert.equal(file.name, "文件.txt");
  const list = await files.list(thread, "uploads");
  assert.equal(list.entries[0].name, "文件.txt");
  assert.equal(list.entries[0].path, file.path);
  const { handle } = await files.download(thread, "uploads", file.path);
  assert.deepEqual(await handle.readFile(), bytes);
  await handle.close();
});
test("attachment paths cannot cross threads or escape project via traversal / symlink", async (t) => {
  const { files, thread, dir } = await fixture(t);
  await writeFile(path.join(dir, "private"), "secret");
  await symlink(path.join(dir, "private"), path.join(thread.cwd, "escape"));
  await assert.rejects(files.download(thread, "workspace", "../private"));
  await assert.rejects(
    files.download(thread, "workspace", "escape"),
    (e) => e.status === 403,
  );
  assert.throws(() => safeRelative("/etc/passwd"));
  assert.throws(() => safeRelative("a\\b"));
  const upload = await files.upload(thread, "a", Readable.from(["ok"]));
  await assert.rejects(files.attachments({ ...thread, id: "other" }, [upload]));
});
test("oversized and aborted uploads leave no partial files", async (t) => {
  const { files, thread } = await fixture(t, 3);
  await assert.rejects(
    files.upload(thread, "big", Readable.from(["1234"]), 4),
    (e) => e.status === 413,
  );
  await assert.rejects(
    files.upload(thread, "chunked", Readable.from(["12", "34"])),
    (e) => e.status === 413,
  );
  const source = new Readable({
    read() {
      this.destroy(Error("aborted"));
    },
  });
  await assert.rejects(files.upload(thread, "aborted", source), /aborted/);
  assert.deepEqual(await readdir(await files.root(thread, "uploads")), []);
});
test("same-name uploads are isolated, names never become executable paths", async (t) => {
  const { files, thread } = await fixture(t);
  const a = await files.upload(
    thread,
    "../../résumé.txt",
    Readable.from(["first"]),
  );
  const b = await files.upload(
    thread,
    "../../résumé.txt",
    Readable.from(["second"]),
  );
  assert.notEqual(a.path, b.path);
  assert.equal(a.name.includes("/"), false);
  const attached = await files.attachments(thread, [a, b]);
  assert.equal(await readFile(attached[0].localPath, "utf8"), "first");
  assert.equal(await readFile(attached[1].localPath, "utf8"), "second");
});
test("project output files are listed and downloadable; directories are not attachments", async (t) => {
  const { files, thread } = await fixture(t);
  await mkdir(path.join(thread.cwd, "out"));
  await writeFile(path.join(thread.cwd, "out", "result.txt"), "generated");
  const list = await files.list(thread, "workspace", "out");
  assert.equal(list.entries[0].path, "out/result.txt");
  await assert.rejects(
    files.attachments(thread, [{ root: "workspace", path: "out" }]),
  );
  const { handle } = await files.download(
    thread,
    "workspace",
    "out/result.txt",
  );
  assert.equal(await handle.readFile("utf8"), "generated");
  await handle.close();
});

test("local file links allow visible documents and reject hidden files and symlink escapes", async (t) => {
  const { files, dir } = await fixture(t);
  const desktop = path.join(dir, "Desktop");
  await mkdir(desktop);
  const document = path.join(desktop, "红字版.docx");
  await writeFile(document, "document");
  assert.equal(await files.localTarget(document, dir), await realpath(document));
  await writeFile(path.join(desktop, ".private"), "secret");
  await symlink(path.join(desktop, ".private"), path.join(desktop, "hidden"));
  await symlink(path.join(dir, "workspace"), path.join(desktop, "escape"));
  await writeFile(path.join(dir, "workspace", "private"), "secret");
  for (const filename of [".private", "hidden", "escape/private", "../workspace/private"])
    await assert.rejects(files.localTarget(path.join(desktop, filename), dir), { status: 403 });
});
