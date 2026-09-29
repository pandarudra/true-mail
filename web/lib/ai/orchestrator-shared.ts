// Pure types shared between the server-only orchestrator (lib/ai/orchestrator.ts,
// which imports lib/db → pg → Node built-ins) and any client component that
// needs to know the shape of a chat turn or its result. Kept in its own file
// with zero server imports, same reasoning as lib/productivity-snapshot-shared.ts.
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type Citation = { emailId: string; from: string; subject: string; snippet: string };

export type ProposedAction = {
  type: "create_task" | "create_promise";
  label: string;
  params: Record<string, unknown>;
};

export type ChatResult = {
  message: string;
  citations: Citation[];
  actions: ProposedAction[];
};
