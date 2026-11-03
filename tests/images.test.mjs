import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import {
  attachmentInputs,
  imageMediaType,
  MAX_IMAGE,
} from "../packages/codex/attachments.mjs";
import { ThreadFiles } from "../apps/local-service/files.mjs";
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
test("sniff raster signatures instead of trusting names or MIME supplied by browsers", () => {
  assert.equal(imageMediaType(png), "image/png");
  assert.equal(imageMediaType(Buffer.from([255, 216, 255, 224])), "image/jpeg");
  assert.equal(imageMediaType(Buffer.from("RIFF0000WEBP")), "image/webp");
  assert.equal(imageMediaType(Buffer.from("GIF89a")), "image/gif");
  for (const bytes of [
    Buffer.from('<svg onload="evil()"/>'),
    Buffer.from("<html>"),
    Buffer.alloc(0),
    Buffer.from("PNG"),
  ])
    assert.equal(imageMediaType(bytes), null);
});
test("only verified raster attachments become native localImage input; documents remain file metadata", () => {
  const files = [
    { localPath: "/verified/image", mediaType: "image/png" },
    { localPath: "/verified/report.pdf", mediaType: null },
  ];
  const input = attachmentInputs(files);
  assert.deepEqual(input[0], { type: "localImage", path: "/verified/image" });
  assert.equal(input.filter((x) => x.type === "localImage").length, 1);
  assert.match(input[1].text, /report.pdf/);
  assert.deepEqual(attachmentInputs([]), []);
});
test("image metadata survives upload and attachment validation without consuming preview bytes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "skyrail-images-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = path.join(root, "project");
  await mkdir(cwd);
  const thread = { id: "image-test", cwd };
  const files = new ThreadFiles(path.join(root, "data"));
  const uploaded = await files.upload(thread, "截图.png", Readable.from([png]));
  assert.equal(uploaded.mediaType, "image/png");
  const attached = await files.attachments(thread, [
    { ...uploaded, mediaType: "text/plain" },
  ]);
  assert.equal(attached[0].mediaType, "image/png");
  assert.deepEqual(await readFile(attached[0].localPath), png);
  const listed = await files.list(thread, "uploads");
  assert.equal(listed.entries[0].name, "截图.png");
  const fake = await files.upload(
    thread,
    "fake.png",
    Readable.from(["<svg/>"]),
  );
  assert.equal(fake.mediaType, null);
  assert.equal(
    (await files.attachments(thread, [{ ...fake, mediaType: "image/png" }]))[0]
      .mediaType,
    null,
  );
});
test("oversized image is rejected and its upload folder removed", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "skyrail-images-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const thread = { id: "image-limit", cwd: root },
    files = new ThreadFiles(path.join(root, "data"));
  await assert.rejects(
    files.upload(
      thread,
      "large.png",
      Readable.from([png, Buffer.alloc(MAX_IMAGE)]),
    ),
    (e) => e.status === 413,
  );
  assert.deepEqual(await readdir(await files.root(thread, "uploads")), []);
});
