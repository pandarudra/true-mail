export const REPLY_MODES = ["reply", "replyAll", "forward"] as const;
export type ReplyMode = (typeof REPLY_MODES)[number];

export function isReplyMode(value: string | null | undefined): value is ReplyMode {
  return !!value && (REPLY_MODES as readonly string[]).includes(value);
}

type SourceEmail = {
  direction: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string | null;
  createdAt: string | Date;
};

function dedupe(addresses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of addresses) {
    const key = addr.toLowerCase();
    if (!addr || seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

function subtract(addresses: string[], exclude: string[]): string[] {
  const excluded = new Set(exclude.map((a) => a.toLowerCase()));
  return addresses.filter((a) => !excluded.has(a.toLowerCase()));
}

function withSubjectPrefix(subject: string, prefix: string): string {
  return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix}${subject}`;
}

export function buildReplyPrefill(email: SourceEmail, mode: ReplyMode, ownAddress: string) {
  const date = new Date(email.createdAt).toLocaleString();

  if (mode === "forward") {
    return {
      to: [] as string[],
      cc: [] as string[],
      subject: withSubjectPrefix(email.subject, "Fwd: "),
      text: `\n\n---------- Forwarded message ---------\nFrom: ${email.from}\nDate: ${date}\nSubject: ${email.subject}\nTo: ${email.to.join(", ")}\n\n${email.text ?? ""}`,
    };
  }

  const isInbound = email.direction === "in";
  const otherParty = dedupe(isInbound ? [email.from] : email.to);
  let cc: string[] = [];

  if (mode === "replyAll") {
    const everyoneElse = [...email.to, ...email.cc, ...(isInbound ? [] : [email.from])];
    cc = subtract(dedupe(everyoneElse), [...otherParty, ownAddress]);
  }

  const quoted = (email.text ?? "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return {
    to: otherParty,
    cc,
    subject: withSubjectPrefix(email.subject, "Re: "),
    text: `\n\nOn ${date}, ${email.from} wrote:\n${quoted}`,
  };
}
