import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet } from "../truemail.js";

export function registerSearchEmails(server: McpServer, userId: string) {
  server.tool(
    "search_emails",
    {
      query: z.string().optional().describe("Keyword to search in subject, sender, or body"),
      folder: z
        .enum(["inbox", "sent", "drafts", "starred", "archive", "spam", "trash", "all"])
        .optional()
        .describe("Folder to search in — omit to search all"),
      limit: z.number().int().min(1).max(20).optional().describe("Max results, default 10"),
    },
    async ({ query, folder, limit }) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (folder) params.set("folder", folder);
      if (limit) params.set("limit", String(limit));
      const data = await tmGet(userId, `/api/emails/search?${params}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
