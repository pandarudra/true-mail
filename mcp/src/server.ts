import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerAllTools } from "./tools/index.js";

export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: "truemail-mcp", version: "1.0.0" });

  // Sanity-check tool — confirms transport is alive without touching TrueMail
  server.tool("ping", {}, async () => ({
    content: [{ type: "text" as const, text: `pong — userId: ${userId}` }],
  }));

  registerAllTools(server, userId);
  return server;
}
