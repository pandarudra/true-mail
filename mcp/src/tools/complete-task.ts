import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmPatch } from "../truemail.js";

export function registerCompleteTask(server: McpServer, userId: string) {
  server.tool(
    "complete_task",
    {
      id: z.string().describe("Task ID to mark as completed"),
    },
    async (args) => {
      const data = await tmPatch(userId, `/api/tasks/${args.id}`, { completed: true });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
