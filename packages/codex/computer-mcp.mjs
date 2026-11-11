import { randomUUID } from "node:crypto";

export function createComputerMcp({ tools, findThread, call }) {
  return async (req, res) => {
    const thread = findThread(req.headers.authorization);
    const reply = (status, body) => {
      if (body === undefined) return res.writeHead(status).end();
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.origin || !thread) return reply(403);
    if (req.method !== "POST") return reply(405);
    let raw = "";
    let message;
    try {
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 64000) return reply(413);
      }
      message = JSON.parse(raw);
    } catch {
      return reply(400);
    }
    if (!message || message.jsonrpc !== "2.0") return reply(400);
    if (!Object.hasOwn(message, "id")) return reply(202);
    const { id, method, params } = message;
    const send = (result) => reply(200, { jsonrpc: "2.0", id, result });
    switch (method) {
      case "initialize":
        return send({
          protocolVersion: ["2025-03-26", "2025-06-18", "2025-11-25"].includes(params?.protocolVersion)
            ? params.protocolVersion : "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "skyrail", version: "1.0.0" },
        });
      case "ping":
        return send({});
      case "tools/list":
        return send({ tools: tools.map(({ type, ...tool }) => tool) });
      case "tools/call":
        try {
          if (findThread(req.headers.authorization) !== thread ||
              !["running", "submitting"].includes(thread.status) || !thread.codexId)
            throw Error("Skyrail computer control requires an active turn in this session.");
          if (!tools.some(tool => tool.name === params?.name) ||
              !params.arguments || typeof params.arguments !== "object")
            throw Error("Invalid Skyrail computer tool request.");
          const result = await call({
            threadId: thread.codexId, callId: randomUUID(),
            tool: params.name, arguments: params.arguments,
          });
          return send({
            isError: !result.success,
            content: result.contentItems.map(item => {
              if (item.type === "inputText") return { type: "text", text: item.text };
              const [, mimeType, data] = /^data:([^;]+);base64,(.+)$/.exec(item.imageUrl) || [];
              return mimeType ? { type: "image", mimeType, data } : { type: "text", text: "Skyrail screenshot unavailable." };
            }),
          });
        } catch (error) {
          return send({ isError: true, content: [{ type: "text", text: error.message }] });
        }
      default:
        return reply(200, { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
    }
  };
}
