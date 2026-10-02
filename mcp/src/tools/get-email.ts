import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet } from "../truemail.js";

export function registerGetEmail(server: McpServer, userId: string) {
  server.tool(
    "get_email",
    {
      id: z.string().describe("Email ID from a search_emails result"),
    },
    async ({ id }) => {
      const data = (await tmGet(userId, `/api/emails/${encodeURIComponent(id)}`)) as Record<string, unknown>;
      const email = (data.email ?? data) as Record<string, unknown>;
      // Strip HTML, return plain text body
      const body = (typeof email.text === "string" ? email.text : "") ||
        (typeof email.html === "string"
          ? email.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
          : "");
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: email.id,
            from: email.from,
            to: email.to,
            subject: email.subject,
            date: email.receivedAt ?? email.sentAt ?? email.createdAt,
            body: body.slice(0, 4000),
          }),
        }],
      };
    }
  );
}
