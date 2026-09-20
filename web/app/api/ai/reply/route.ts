import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { emailBodyText } from "@/lib/email-text";
import { chatText } from "@/lib/ai/nvidia";

const INTENTS = ["accept", "decline", "ask_details", "thank", "follow_up", "custom"] as const;
type Intent = (typeof INTENTS)[number];

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as readonly string[]).includes(value);
}

const INTENT_INSTRUCTIONS: Record<Exclude<Intent, "custom">, string> = {
  accept: "Write a reply accepting what's being proposed or requested.",
  decline: "Write a reply politely declining what's being proposed or requested.",
  ask_details: "Write a reply asking for more details or clarification before committing to anything.",
  thank: "Write a short reply thanking the sender.",
  follow_up: "Write a brief follow-up reply, gently checking in on the topic of the email.",
};

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const emailId: string | undefined = body?.emailId;
  const intent = body?.intent;
  const customInstruction: string | undefined = body?.customInstruction;

  if (!emailId || !isIntent(intent)) {
    return NextResponse.json({ error: "emailId and a valid intent are required" }, { status: 400 });
  }
  if (intent === "custom" && !customInstruction?.trim()) {
    return NextResponse.json({ error: "customInstruction is required for a custom intent" }, { status: 400 });
  }

  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const instruction = intent === "custom" ? customInstruction!.trim() : INTENT_INSTRUCTIONS[intent];

  try {
    const text = await chatText({
      system:
        "You draft email replies. Write only the reply body — 2 to 4 sentences, plain text, " +
        "no subject line, no greeting/signature boilerplate beyond what naturally fits, " +
        "no markdown, matching the sender's tone loosely.",
      user: `${instruction}\n\nOriginal email:\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${emailBodyText(email)}`,
      maxTokens: 200,
      temperature: 0.4,
    });
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
