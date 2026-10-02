import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tmGet, tmPost } from "../truemail.js";

export function registerSendEmail(server: McpServer, userId: string) {
  server.tool(
    "send_email",
    {
      to: z.array(z.string()).describe("Recipient email addresses"),
      subject: z.string(),
      text: z.string().describe("Plain text email body"),
      mailboxId: z.string().optional().describe("Mailbox to send from — omit to use default"),
      confirmed: z.boolean().optional().describe("Must be true to actually send. Omit to preview first."),
    },
    async ({ to, subject, text, mailboxId, confirmed }) => {
      // Resolve default mailbox if not provided
      let resolvedMailboxId = mailboxId;
      if (!resolvedMailboxId) {
        const mb = (await tmGet(userId, "/api/mailboxes")) as { mailboxes?: Array<{ id: string; isDefault: boolean }> };
        const def = mb.mailboxes?.find((m) => m.isDefault) ?? mb.mailboxes?.[0];
        if (!def) throw new Error("No mailbox found — set up a mailbox in TrueMail first");
        resolvedMailboxId = def.id;
      }

      if (!confirmed) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              pendingConfirmation: true,
              action: "send_email",
              preview: { to, subject, body: text.slice(0, 300) },
              hint: "Call send_email again with confirmed:true to actually send",
            }),
          }],
        };
      }

      const data = await tmPost(userId, "/api/emails", {
        mailboxId: resolvedMailboxId,
        to,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );
}
