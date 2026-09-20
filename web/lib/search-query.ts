// Gmail-style operator syntax (from:/to:/subject:/has:attachment/after:/before:,
// bare words, and -excluded words) — the advanced search modal is just a form
// that builds one of these strings; typing it directly in the search box
// works too.

export type ParsedSearchQuery = {
  from: string;
  to: string;
  subject: string;
  after: string | null;
  before: string | null;
  hasAttachment: boolean;
  include: string[];
  exclude: string[];
};

const OPERATOR_RE = /(from|to|subject|has|after|before):(?:"([^"]*)"|(\S+))/gi;

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = {
    from: "",
    to: "",
    subject: "",
    after: null,
    before: null,
    hasAttachment: false,
    include: [],
    exclude: [],
  };

  let remaining = "";
  let lastIndex = 0;
  const re = new RegExp(OPERATOR_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(query))) {
    remaining += query.slice(lastIndex, match.index);
    lastIndex = re.lastIndex;
    const key = match[1].toLowerCase();
    const value = (match[2] ?? match[3] ?? "").toLowerCase();
    if (key === "from") result.from = value;
    else if (key === "to") result.to = value;
    else if (key === "subject") result.subject = value;
    else if (key === "has" && value === "attachment") result.hasAttachment = true;
    else if (key === "after") result.after = value;
    else if (key === "before") result.before = value;
  }
  remaining += query.slice(lastIndex);

  for (const word of remaining.trim().split(/\s+/).filter(Boolean)) {
    if (word.startsWith("-") && word.length > 1) result.exclude.push(word.slice(1).toLowerCase());
    else result.include.push(word.toLowerCase());
  }
  return result;
}

type SearchableEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  createdAt: string;
  attachments: unknown[];
};

export function matchesSearchQuery(email: SearchableEmail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const parsed = parseSearchQuery(trimmed);
  const from = email.from.toLowerCase();
  const to = email.to.map((t) => t.toLowerCase());
  const subject = email.subject.toLowerCase();
  const haystack = `${from} ${subject} ${(email.text ?? "").toLowerCase()}`;

  if (parsed.from && !from.includes(parsed.from)) return false;
  if (parsed.to && !to.some((t) => t.includes(parsed.to))) return false;
  if (parsed.subject && !subject.includes(parsed.subject)) return false;
  if (parsed.hasAttachment && email.attachments.length === 0) return false;
  if (parsed.after && new Date(email.createdAt) < new Date(parsed.after)) return false;
  if (parsed.before) {
    const upperBound = new Date(parsed.before);
    upperBound.setDate(upperBound.getDate() + 1);
    if (new Date(email.createdAt) >= upperBound) return false;
  }
  if (parsed.include.some((word) => !haystack.includes(word))) return false;
  if (parsed.exclude.some((word) => haystack.includes(word))) return false;

  return true;
}

function quoteIfNeeded(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

export function buildSearchQuery(filters: {
  from: string;
  to: string;
  subject: string;
  include: string;
  exclude: string;
  hasAttachment: boolean;
  after: string;
  before: string;
}): string {
  const parts: string[] = [];
  if (filters.from.trim()) parts.push(`from:${quoteIfNeeded(filters.from.trim())}`);
  if (filters.to.trim()) parts.push(`to:${quoteIfNeeded(filters.to.trim())}`);
  if (filters.subject.trim()) parts.push(`subject:${quoteIfNeeded(filters.subject.trim())}`);
  if (filters.after) parts.push(`after:${filters.after}`);
  if (filters.before) parts.push(`before:${filters.before}`);
  if (filters.hasAttachment) parts.push("has:attachment");
  if (filters.include.trim()) parts.push(filters.include.trim());
  for (const word of filters.exclude.trim().split(/\s+/).filter(Boolean)) {
    parts.push(`-${word}`);
  }
  return parts.join(" ");
}
