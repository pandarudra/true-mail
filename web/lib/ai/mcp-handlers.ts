import type { ToolHandlerMap } from "./orchestrator";
import { callMcpTool } from "./mcp-client";

// Every tool handler simply proxies through MCP; the MCP server owns the
// implementation. propose_task and propose_promise are UI-only no-ops kept
// here so the orchestrator's tool list stays consistent.
export function buildMcpHandlers(): ToolHandlerMap {
  const proxy =
    (name: string) =>
    (userId: string, args: Record<string, unknown>) =>
      callMcpTool(userId, name, args) as Promise<unknown>;

  return {
    search_emails: proxy("search_emails"),
    get_email: proxy("get_email"),
    summarize_email: proxy("summarize_email"),
    extract_actions: proxy("extract_actions"),
    search_tasks: proxy("search_tasks"),
    create_task: proxy("create_task"),
    complete_task: proxy("complete_task"),
    search_promises: proxy("search_promises"),
    create_promise: proxy("create_promise"),
    search_calendar: proxy("search_calendar"),
    send_email: proxy("send_email"),
    reply_email: proxy("reply_email"),
    // ponytail: no-ops; proposals are surfaced by the model in its text, not as data actions
    propose_task: async () => ({ noted: true }),
    propose_promise: async () => ({ noted: true }),
  };
}
