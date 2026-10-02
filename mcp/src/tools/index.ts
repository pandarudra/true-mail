import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchEmails } from "./search-emails.js";
import { registerGetEmail } from "./get-email.js";
import { registerSummarizeEmail } from "./summarize-email.js";
import { registerExtractActions } from "./extract-actions.js";
import { registerSendEmail } from "./send-email.js";
import { registerReplyEmail } from "./reply-email.js";
import { registerCreateTask } from "./create-task.js";

export function registerAllTools(server: McpServer, userId: string) {
  registerSearchEmails(server, userId);
  registerGetEmail(server, userId);
  registerSummarizeEmail(server, userId);
  registerExtractActions(server, userId);
  registerSendEmail(server, userId);
  registerReplyEmail(server, userId);
  registerCreateTask(server, userId);
}
