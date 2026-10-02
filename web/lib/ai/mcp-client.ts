import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_SERVER_URL ?? "http://localhost:3001";
const MCP_SECRET = process.env.MCP_SHARED_SECRET ?? "";

export async function callMcpTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const url = new URL("/mcp", MCP_URL);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        "x-internal-secret": MCP_SECRET,
        "x-user-id": userId,
      },
    },
  });

  const client = new Client({ name: "truemail-web", version: "1.0.0" });
  await client.connect(transport);

  try {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }> | undefined;
    const first = content?.[0];
    if (first?.type === "text" && first.text != null) {
      try { return JSON.parse(first.text); } catch { return first.text; }
    }
    return content;
  } finally {
    await client.close().catch(() => {});
  }
}
