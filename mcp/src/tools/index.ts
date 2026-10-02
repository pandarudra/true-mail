import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchEmails } from "./search-emails.js";
import { registerGetEmail } from "./get-email.js";
import { registerSummarizeEmail } from "./summarize-email.js";
import { registerExtractActions } from "./extract-actions.js";
import { registerSendEmail } from "./send-email.js";
import { registerReplyEmail } from "./reply-email.js";
import { registerCreateTask } from "./create-task.js";
import { registerSearchTasks } from "./search-tasks.js";
import { registerCompleteTask } from "./complete-task.js";
import { registerSearchPromises } from "./search-promises.js";
import { registerCreatePromise } from "./create-promise.js";
import { registerSearchCalendar } from "./search-calendar.js";

export function registerAllTools(server: McpServer, userId: string) {
  registerSearchEmails(server, userId);
  registerGetEmail(server, userId);
  registerSummarizeEmail(server, userId);
  registerExtractActions(server, userId);
  registerSendEmail(server, userId);
  registerReplyEmail(server, userId);
  registerCreateTask(server, userId);
  registerSearchTasks(server, userId);
  registerCompleteTask(server, userId);
  registerSearchPromises(server, userId);
  registerCreatePromise(server, userId);
  registerSearchCalendar(server, userId);
}
