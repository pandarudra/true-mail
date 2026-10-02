import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmPost } from "../truemail.js";

export function registerSummarizeEmail(server: McpServer, userId: string) {
  server.tool(
    "summarize_email",
    {
      id: z.string().describe("Email ID to summarize"),
    },
    async ({ id }) => {
      const data = await tmPost(userId, "/api/ai/summarize", { emailId: id });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
