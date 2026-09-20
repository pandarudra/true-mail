import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

// Dev-only: creates (or reuses) a local test account with a fake-but-verified
// domain, a mailbox, labels, and sample emails across every folder, so you
// can log in and test the app without going through real Resend/domain
// onboarding. Safe to call repeatedly — every step is upsert-or-skip, nothing
// is ever deleted. The seeded ResendConnection has dummy tokens; don't use
// this account to actually send mail or verify a domain.
//
// Usage: with `npm run dev` running, POST http://localhost:3000/api/dev/seed
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const DEV_EMAIL = "dev@truemail.test";
  const DEV_PASSWORD = "devpassword123";
  const DOMAIN_NAME = "dev.truemail.test";
  const MAILBOX_ADDRESS = `you@${DOMAIN_NAME}`;

  let user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
  if (!user) {
    await auth.api.signUpEmail({ body: { name: "Dev Tester", email: DEV_EMAIL, password: DEV_PASSWORD } });
    user = await prisma.user.findUniqueOrThrow({ where: { email: DEV_EMAIL } });
  }
  const userId = user.id;

  let connection = await prisma.resendConnection.findUnique({ where: { userId } });
  if (!connection) {
    connection = await prisma.resendConnection.create({
      data: {
        userId,
        encryptedAccessToken: encrypt("dev-mock-access-token"),
        encryptedRefreshToken: encrypt("dev-mock-refresh-token"),
        accessTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        scope: "full_access",
        webhookId: "dev-mock-webhook",
        encryptedWebhookSecret: encrypt("dev-mock-webhook-secret"),
      },
    });
  }

  let domain = await prisma.domain.findUnique({ where: { name: DOMAIN_NAME } });
  if (!domain) {
    domain = await prisma.domain.create({
      data: {
        userId,
        connectionId: connection.id,
        resendDomainId: "dev-mock-domain",
        name: DOMAIN_NAME,
        status: "verified",
        dnsRecords: [],
      },
    });
  }

  let mailbox = await prisma.mailbox.findUnique({ where: { address: MAILBOX_ADDRESS } });
  if (!mailbox) {
    mailbox = await prisma.mailbox.create({
      data: { userId, domainId: domain.id, localPart: "you", address: MAILBOX_ADDRESS, isDefault: true },
    });
  }

  const workLabel = await prisma.label.upsert({
    where: { userId_name: { userId, name: "Work" } },
    update: {},
    create: { userId, name: "Work", color: "#3b82f6" },
  });
  await prisma.label.upsert({
    where: { userId_name: { userId, name: "Personal" } },
    update: {},
    create: { userId, name: "Personal", color: "#22c55e" },
  });

  const existingEmailCount = await prisma.email.count({ where: { mailboxId: mailbox.id } });
  if (existingEmailCount === 0) {
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000);

    await prisma.email.createMany({
      data: [
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "John Doe <john@example.com>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Deployment schedule for this week",
          text: "Hey — can we deploy Friday? Backend changes are done on my end, just waiting on the frontend fixes. If Friday doesn't work, Monday is fine too. Let me know what you'd prefer and I'll block out the time.",
          read: false,
          receivedAt: hoursAgo(2),
          createdAt: hoursAgo(2),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "Billing <billing@acme.example>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Invoice #INV-2031 due October 2",
          text: "Your invoice #INV-2031 for $245.00 is due on October 2. Pay online at your convenience or reply to this email with any questions about the charges.",
          read: false,
          important: true,
          receivedAt: hoursAgo(5),
          createdAt: hoursAgo(5),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "Priya Nair <priya@example.com>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Design review notes",
          text: "Left a few comments on the onboarding flow, mostly around spacing on the mobile layout. Nothing blocking — take a look whenever you get a chance.",
          read: true,
          starred: true,
          receivedAt: hoursAgo(20),
          createdAt: hoursAgo(20),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "Alex Chen <alex@example.com>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Are you free to pair tomorrow?",
          text: "Wanted to check if you're free tomorrow afternoon to pair on the webhook retry logic. Would 2pm work, or is there a better time?",
          read: true,
          receivedAt: hoursAgo(30),
          createdAt: hoursAgo(30),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "out",
          status: "sent",
          from: MAILBOX_ADDRESS,
          to: ["alex@example.com"],
          cc: [],
          subject: "Re: Q3 planning doc",
          text: "Sounds good — let's sync Thursday and lock the roadmap.",
          read: true,
          sentAt: hoursAgo(40),
          createdAt: hoursAgo(40),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "out",
          status: "draft",
          from: MAILBOX_ADDRESS,
          to: ["team@example.com"],
          cc: [],
          subject: "Weekly update",
          text: "Hey team,\n\nQuick update on progress this week:\n- ",
          read: true,
          createdAt: hoursAgo(1),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "The Verge <newsletter@theverge.example>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Today's top stories",
          text: "Here's what's happening in tech today...",
          read: true,
          receivedAt: hoursAgo(50),
          createdAt: hoursAgo(50),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "Old Project <noreply@oldproject.example>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Sprint retro notes",
          text: "Notes from last sprint's retro, archived for reference.",
          read: true,
          archived: true,
          receivedAt: hoursAgo(200),
          createdAt: hoursAgo(200),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "Definitely Not A Scam <prize@sketchy.example>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "You've won a prize!!!",
          text: "Click here to claim your prize now before it expires.",
          read: false,
          spam: true,
          receivedAt: hoursAgo(70),
          createdAt: hoursAgo(70),
        },
        {
          id: randomUUID(),
          mailboxId: mailbox.id,
          direction: "in",
          status: "received",
          from: "Cleanup <cleanup@example.com>",
          to: [MAILBOX_ADDRESS],
          cc: [],
          subject: "Meeting cancelled",
          text: "This meeting has been cancelled.",
          read: true,
          trashedAt: hoursAgo(10),
          receivedAt: hoursAgo(100),
          createdAt: hoursAgo(100),
        },
      ],
    });

    // createMany can't set many-to-many relations, so label assignment is a
    // separate step.
    const reviewEmail = await prisma.email.findFirst({ where: { mailboxId: mailbox.id, subject: "Design review notes" } });
    if (reviewEmail) {
      await prisma.email.update({ where: { id: reviewEmail.id }, data: { labels: { connect: { id: workLabel.id } } } });
    }
  }

  return NextResponse.json({
    ok: true,
    credentials: { email: DEV_EMAIL, password: DEV_PASSWORD },
    seededEmails: existingEmailCount === 0 ? 10 : 0,
  });
}
