import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet } from "../truemail.js";

export function registerSearchTasks(server: McpServer, userId: string) {
  server.tool(
    "search_tasks",
    {
      query: z.string().optional().describe("Filter by title substring"),
      status: z.enum(["all", "pending", "completed", "overdue"]).optional().default("all"),
    },
    async (args) => {
      const data = (await tmGet(userId, "/api/tasks")) as { tasks: Array<Record<string, unknown>> };
      const now = Date.now();
      let tasks = data.tasks ?? [];

      if (args.status === "pending") tasks = tasks.filter((t) => !t.completed);
      else if (args.status === "completed") tasks = tasks.filter((t) => t.completed);
      else if (args.status === "overdue")
        tasks = tasks.filter((t) => !t.completed && t.dueAt && new Date(t.dueAt as string).getTime() < now);

      if (args.query) {
        const q = args.query.toLowerCase();
        tasks = tasks.filter((t) => (t.title as string).toLowerCase().includes(q));
      }

      const result = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt,
        completed: t.completed,
        priority: t.priority,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );
}
