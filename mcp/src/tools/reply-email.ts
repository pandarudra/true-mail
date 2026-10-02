import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet, tmPost } from "../truemail.js";

export function registerReplyEmail(server: McpServer, userId: string) {
  server.tool(
    "reply_email",
    {
      emailId: z.string().describe("ID of the email to reply to"),
      text: z.string().describe("Reply body text"),
      confirmed: z.boolean().optional().describe("Must be true to actually send. Omit to preview."),
    },
    async ({ emailId, text, confirmed }) => {
      const raw = (await tmGet(userId, `/api/emails/${encodeURIComponent(emailId)}`)) as Record<string, unknown>;
      const email = (raw.email ?? raw) as Record<string, unknown>;

      if (!confirmed) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              pendingConfirmation: true,
              action: "reply_email",
              preview: {
                replyTo: email.from,
                subject: `Re: ${email.subject}`,
                body: text.slice(0, 300),
              },
              hint: "Call reply_email again with confirmed:true to actually send",
            }),
          }],
        };
      }

      // Resolve the mailbox from the email
      const mailboxId = email.mailboxId as string;
      const replyTo = email.from as string;
      const subject = `Re: ${email.subject as string}`.replace(/^(Re: )+/, "Re: ");

      const data = await tmPost(userId, "/api/emails", {
        mailboxId,
        to: [replyTo],
        subject,
        text,
        html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
