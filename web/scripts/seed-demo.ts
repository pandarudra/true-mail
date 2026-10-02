// @ts-nocheck — seed script requires `prisma generate` to be run first; not part of app build
/**
 * Seed a demo user with realistic emails, tasks, and promises for hackathon demos.
 *
 * Usage:
 *   npx prisma generate && npx tsx scripts/seed-demo.ts <email>
 *
 * The user must already exist (sign up first). This script only adds data.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-demo.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: user.id, isDefault: true },
  });
  if (!mailbox) {
    console.error("User has no default mailbox — finish onboarding first.");
    process.exit(1);
  }

  // Tasks require a TaskList
  const taskList = await prisma.taskList.findFirst({ where: { userId: user.id } });
  if (!taskList) {
    console.error("User has no task list — finish onboarding first.");
    process.exit(1);
  }

  console.log(`Seeding demo data for ${email} (mailbox: ${mailbox.address})…`);

  const now = new Date();

  // ---- Emails ----------------------------------------------------------------
  const emailSeeds = [
    {
      from: "alice@acme.com",
      subject: "Q4 roadmap review — your input needed",
      text: "Hi, we're finalising the Q4 roadmap this Friday. Could you review the attached doc and send your priorities by Thursday EOD? Thanks, Alice",
      daysAgo: 1,
    },
    {
      from: "bob@venture.io",
      subject: "Re: Partnership proposal",
      text: "Following up on our call last week. I promised to send over the term sheet by Monday — it's attached. Let me know if you have questions.",
      daysAgo: 2,
    },
    {
      from: "carol@design.co",
      subject: "New brand assets ready",
      text: "The updated logo files and brand guidelines are now in Figma. Action items: 1) approve logo variant B by Friday 2) confirm brand colours with marketing.",
      daysAgo: 3,
    },
    {
      from: "dave@ops.internal",
      subject: "Production incident post-mortem",
      text: "Post-mortem for last Tuesday's outage is attached. You promised to review and sign off by end of week. Please also assign the follow-up action items.",
      daysAgo: 4,
    },
    {
      from: "newsletter@techdigest.io",
      subject: "This week in AI: MCP goes mainstream",
      text: "Model Context Protocol is being adopted across the industry. Highlights: Anthropic, Google, and OpenAI all announced MCP support this month.",
      daysAgo: 0,
    },
  ];

  for (const seed of emailSeeds) {
    const date = new Date(now.getTime() - seed.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.email.create({
      data: {
        mailboxId: mailbox.id,
        from: seed.from,
        to: [mailbox.address],
        cc: [],
        subject: seed.subject,
        text: seed.text,
        html: `<p>${seed.text.replace(/\n/g, "<br>")}</p>`,
        direction: "INCOMING",
        status: "RECEIVED",
        read: false,
        createdAt: date,
        updatedAt: date,
      },
    });
  }

  // ---- Tasks -----------------------------------------------------------------
  const taskSeeds = [
    { title: "Review Q4 roadmap doc", daysFromNow: 2, priority: "HIGH" as const },
    { title: "Approve logo variant B", daysFromNow: 3, priority: "NORMAL" as const },
    { title: "Sign off post-mortem", daysFromNow: 1, priority: "HIGH" as const },
    { title: "Reply to partnership term sheet", daysFromNow: 5, priority: "NORMAL" as const },
  ];

  for (const seed of taskSeeds) {
    const dueAt = new Date(now.getTime() + seed.daysFromNow * 24 * 60 * 60 * 1000);
    await prisma.task.create({
      data: {
        userId: user.id,
        listId: taskList.id,
        title: seed.title,
        dueAt,
        priority: seed.priority,
        completed: false,
      },
    });
  }

  // ---- Promises --------------------------------------------------------------
  const promiseSeeds = [
    {
      direction: "OUTGOING" as const,
      commitment: "Send Q4 priorities to Alice by Thursday EOD",
      personName: "Alice",
      personEmail: "alice@acme.com",
      daysFromNow: 1,
    },
    {
      direction: "INCOMING" as const,
      commitment: "Bob will send the partnership term sheet",
      personName: "Bob",
      personEmail: "bob@venture.io",
      daysFromNow: -1,
    },
  ];

  for (const seed of promiseSeeds) {
    const dueAt = new Date(now.getTime() + seed.daysFromNow * 24 * 60 * 60 * 1000);
    await prisma.promise.create({
      data: {
        userId: user.id,
        direction: seed.direction,
        commitment: seed.commitment,
        personName: seed.personName,
        personEmail: seed.personEmail,
        dueAt,
        status: "ACTIVE",
      },
    });
  }

  console.log(
    `Done. Seeded ${emailSeeds.length} emails, ${taskSeeds.length} tasks, ${promiseSeeds.length} promises.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
