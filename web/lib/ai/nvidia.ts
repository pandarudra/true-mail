const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
// The only chat model confirmed to work with this project's NVIDIA_API_KEY
// and to follow strict-JSON instructions cleanly — most of the public NIM
// catalog, including every embedding model, 404s for this account.
const MODEL = "meta/llama-3.2-11b-vision-instruct";

type ChatOpts = {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
};

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; rawArguments: string };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCallResult = { content: string } | { toolCalls: ToolCall[] };

export type ChatFn = (opts: { messages: ChatMessage[]; tools: ToolDef[]; maxTokens: number }) => Promise<ToolCallResult>;

async function complete(opts: ChatOpts): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }

  const res = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`NVIDIA API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("NVIDIA API returned no content");
  }
  return content;
}

export async function chatWithTools(opts: {
  messages: ChatMessage[];
  tools: ToolDef[];
  maxTokens: number;
}): Promise<ToolCallResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }

  const res = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: 0.2,
      tools: opts.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    throw new Error(`NVIDIA API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("NVIDIA API returned no message");
  }

  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return {
      toolCalls: message.tool_calls.map(
        (tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          rawArguments: tc.function.arguments,
        })
      ),
    };
  }

  if (typeof message.content !== "string" || !message.content.trim()) {
    throw new Error("NVIDIA API returned no content");
  }
  return { content: message.content.trim() };
}

export async function chatText(opts: ChatOpts): Promise<string> {
  return (await complete(opts)).trim();
}

// Strips a ```json ... ``` fence if the model wrapped its output in one
// despite instructions not to, then parses. Exported for testing.
export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export async function chatJSON<T>(opts: ChatOpts): Promise<T> {
  const raw = await complete(opts);
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`NVIDIA API returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}
