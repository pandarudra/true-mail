import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmPost } from "../truemail.js";

export function registerCreateTask(server: McpServer, userId: string) {
  server.tool(
    "create_task",
    {
      title: z.string().describe("Task title"),
      dueAt: z.string().optional().describe("ISO date string for due date, e.g. 2026-10-05T09:00:00"),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      description: z.string().optional(),
      sourceEmailId: z.string().optional().describe("Email ID that prompted this task"),
    },
    async (args) => {
      const data = await tmPost(userId, "/api/tasks", args);
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
