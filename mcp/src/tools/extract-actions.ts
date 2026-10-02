import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmPost } from "../truemail.js";

export function registerExtractActions(server: McpServer, userId: string) {
  server.tool(
    "extract_actions",
    {
      id: z.string().describe("Email ID to extract action items from"),
    },
    async ({ id }) => {
      const data = await tmPost(userId, "/api/ai/extract-actions", { emailId: id });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
