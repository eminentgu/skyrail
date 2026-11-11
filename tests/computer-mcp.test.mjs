import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createComputerMcp } from "../packages/codex/computer-mcp.mjs";

test("resumed session MCP authenticates and forwards only to its active thread", async (t) => {
  const thread = { status: "idle", codexId: "original" };
  const calls = [];
  const server = createServer(createComputerMcp({
    tools: [{ type: "function", name: "skyrail_computer", inputSchema: {} }],
    findThread: auth => auth === "Bearer private-writer" ? thread : null,
    call: async request => {
      calls.push(request);
      return { success: true, contentItems: [
        { type: "inputText", text: "status" },
        { type: "inputImage", imageUrl: "data:image/png;base64,AAAA" },
      ] };
    },
  }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const request = (method, params, headers = {}) => fetch(
    "http://127.0.0.1:" + server.address().port,
    { method: "POST", headers: { authorization: "Bearer private-writer", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) },
  );
  assert.equal((await request("tools/list", {}, { authorization: "Bearer invalid" })).status, 403);
  assert.equal((await request("tools/list", {}, { origin: "https://example.test" })).status, 403);
  const tools = await (await request("tools/list")).json();
  assert.deepEqual(tools.result.tools, [{ name: "skyrail_computer", inputSchema: {} }]);
  const params = { name: "skyrail_computer", arguments: { action: "status", threadId: "other" } };
  assert.equal((await (await request("tools/call", params)).json()).result.isError, true);
  thread.status = "running";
  const { result } = await (await request("tools/call", params)).json();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].threadId, "original");
  assert.deepEqual(result.content, [
    { type: "text", text: "status" },
    { type: "image", mimeType: "image/png", data: "AAAA" },
  ]);
});
