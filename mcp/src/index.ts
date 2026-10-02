import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./server.js";
import { validateInternalRequest } from "./auth.js";
import { checkRateLimit } from "./ratelimit.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "truemail-mcp" });
});

app.post("/mcp", async (req, res) => {
  const userId = validateInternalRequest(
    req.headers as Record<string, string | string[] | undefined>
  );
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: "rate limit exceeded — max 30 tool calls per minute" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — each request is independent
  });
  const server = buildMcpServer(userId);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close().catch(() => {});
  }
});

// Return 405 for GET/DELETE — we're stateless, no SSE sessions
app.get("/mcp", (_req, res) => res.status(405).json({ error: "use POST" }));
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "stateless — no sessions" }));

const port = Number(process.env.MCP_PORT ?? 3001);
app.listen(port, () => {
  console.log(`TrueMail MCP server listening on http://localhost:${port}`);
  console.log(`  Health: http://localhost:${port}/health`);
  console.log(`  MCP:    http://localhost:${port}/mcp`);
});
