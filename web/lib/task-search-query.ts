// Mirrors lib/search-query.ts's Gmail-style operator syntax, adapted to
// tasks: list:/priority:/status:/after:/before:, bare words, and -excluded
// words. The advanced search modal is just a form that builds one of these
// strings; typing it directly in the search box works too.

export type ParsedTaskSearchQuery = {
  list: string;
  priority: string;
  status: string;
  after: string | null;
  before: string | null;
  include: string[];
  exclude: string[];
};

const OPERATOR_RE = /(list|priority|status|after|before):(?:"([^"]*)"|(\S+))/gi;

export function parseTaskSearchQuery(query: string): ParsedTaskSearchQuery {
  const result: ParsedTaskSearchQuery = {
    list: "",
    priority: "",
    status: "",
    after: null,
    before: null,
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
    if (key === "list") result.list = value;
    else if (key === "priority") result.priority = value;
    else if (key === "status") result.status = value;
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

type SearchableTask = {
  title: string;
  description: string | null;
  priority: string;
  completed: boolean;
  dueAt: string | null;
  listId: string;
};

export function matchesTaskSearchQuery(
  task: SearchableTask,
  query: string,
  taskLists: { id: string; name: string }[]
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const parsed = parseTaskSearchQuery(trimmed);
  const listName = (taskLists.find((l) => l.id === task.listId)?.name ?? "").toLowerCase();
  const haystack = `${task.title.toLowerCase()} ${(task.description ?? "").toLowerCase()}`;

  if (parsed.list && !listName.includes(parsed.list)) return false;
  if (parsed.priority && task.priority.toLowerCase() !== parsed.priority) return false;
  if (parsed.status === "completed" && !task.completed) return false;
  if (parsed.status === "active" && task.completed) return false;
  if (parsed.after && (!task.dueAt || new Date(task.dueAt) < new Date(parsed.after))) return false;
  if (parsed.before) {
    if (!task.dueAt) return false;
    const upperBound = new Date(parsed.before);
    upperBound.setDate(upperBound.getDate() + 1);
    if (new Date(task.dueAt) >= upperBound) return false;
  }
  if (parsed.include.some((word) => !haystack.includes(word))) return false;
  if (parsed.exclude.some((word) => haystack.includes(word))) return false;

  return true;
}

function quoteIfNeeded(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

export function buildTaskSearchQuery(filters: {
  listName: string;
  priority: string;
  status: string;
  include: string;
  exclude: string;
  after: string;
  before: string;
}): string {
  const parts: string[] = [];
  if (filters.listName.trim()) parts.push(`list:${quoteIfNeeded(filters.listName.trim())}`);
  if (filters.priority) parts.push(`priority:${filters.priority.toLowerCase()}`);
  if (filters.status) parts.push(`status:${filters.status}`);
  if (filters.after) parts.push(`after:${filters.after}`);
  if (filters.before) parts.push(`before:${filters.before}`);
  if (filters.include.trim()) parts.push(filters.include.trim());
  for (const word of filters.exclude.trim().split(/\s+/).filter(Boolean)) {
    parts.push(`-${word}`);
  }
  return parts.join(" ");
}
