import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet } from "../truemail.js";

export function registerSearchPromises(server: McpServer, userId: string) {
  server.tool(
    "search_promises",
    {
      query: z.string().optional().describe("Filter by commitment text"),
      status: z.enum(["all", "ACTIVE", "FULFILLED", "DISMISSED", "DUE_SOON", "OVERDUE"]).optional().default("all"),
    },
    async (args) => {
      const data = (await tmGet(userId, "/api/promises")) as {
        promises: Array<Record<string, unknown>>;
      };
      let promises = data.promises ?? [];

      if (args.status && args.status !== "all") {
        promises = promises.filter((p) => p.derivedStatus === args.status || p.status === args.status);
      }
      if (args.query) {
        const q = args.query.toLowerCase();
        promises = promises.filter((p) => (p.commitment as string).toLowerCase().includes(q));
      }

      const result = promises.map((p) => ({
        id: p.id,
        commitment: p.commitment,
        direction: p.direction,
        personName: p.personName,
        personEmail: p.personEmail,
        dueAt: p.dueAt,
        status: p.derivedStatus ?? p.status,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );
}
