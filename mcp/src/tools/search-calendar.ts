import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet } from "../truemail.js";

export function registerSearchCalendar(server: McpServer, userId: string) {
  server.tool(
    "search_calendar",
    {
      fromDate: z.string().optional().describe("Local date YYYY-MM-DD, defaults to today"),
      toDate: z.string().optional().describe("Local date YYYY-MM-DD, defaults to fromDate"),
    },
    async (args) => {
      const data = (await tmGet(userId, "/api/tasks")) as { tasks: Array<Record<string, unknown>> };
      const tasks = data.tasks ?? [];

      const todayStr = new Date().toISOString().slice(0, 10);
      const from = new Date(`${args.fromDate ?? todayStr}T00:00:00`);
      const to = new Date(`${args.toDate ?? args.fromDate ?? todayStr}T23:59:59`);

      const result = tasks
        .filter((t) => {
          if (!t.dueAt) return false;
          const d = new Date(t.dueAt as string);
          return d >= from && d <= to;
        })
        .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, completed: t.completed }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );
}
