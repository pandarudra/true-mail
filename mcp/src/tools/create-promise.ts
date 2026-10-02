import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmPost } from "../truemail.js";

export function registerCreatePromise(server: McpServer, userId: string) {
  server.tool(
    "create_promise",
    {
      direction: z.enum(["INCOMING", "OUTGOING"]).describe("OUTGOING = you promised; INCOMING = someone else promised"),
      commitment: z.string().describe("What was promised"),
      personName: z.string().optional(),
      personEmail: z.string().optional(),
      dueAt: z.string().optional().describe("ISO date string for due date"),
      sourceEmailId: z.string().optional(),
    },
    async (args) => {
      const data = await tmPost(userId, "/api/promises", args);
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
