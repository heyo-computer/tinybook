import { createDoc, listDocs, readDoc, writeDoc, deleteDoc } from "./docs";
import { tavilySearch } from "./tools/tavily";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type AgentRequest = {
  messages: ChatMessage[];
  apiKey: string;
  model: string;
  baseUrl?: string;
  mentions?: string[];
  tavilyApiKey?: string;
};

const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the public web via Tavily. Returns a list of results with title, url, and a content snippet. Use for current events, citations, or anything outside the user's documents.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        max_results: { type: "number" },
      },
      required: ["query"],
    },
  },
};

const WEB_SEARCH_RESULT_BUDGET = 10000;

const MENTION_MAX_CHARS = 16000;

const DEFAULT_BASE_URL = "https://api.inceptionlabs.ai/v1";

const SYSTEM_PROMPT = `You are tinybook, an assistant that helps the user manage a small library of markdown documents.
You can list, read, create, edit, and delete markdown files via the provided tools.
When the user asks to write or modify a document, do it via tools rather than just describing what you would do.
Document content should be valid markdown. After making a change, briefly confirm what you did.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_docs",
      description: "List all markdown documents (slug, title, updatedAt).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_doc",
      description: "Read the full markdown content of a document by slug.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_doc",
      description:
        "Create a new markdown document. Returns the new doc's slug. Provide a clear title; content is optional and should be valid markdown.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_doc",
      description:
        "Overwrite the content of an existing markdown document identified by slug.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string" },
          content: { type: "string" },
        },
        required: ["slug", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_doc",
      description: "Delete a markdown document by slug.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
  },
];

async function runTool(
  name: string,
  args: any,
  ctx: { tavilyApiKey?: string },
): Promise<string> {
  try {
    switch (name) {
      case "list_docs":
        return JSON.stringify(await listDocs());
      case "read_doc": {
        const d = await readDoc(String(args.slug));
        return JSON.stringify(d ?? { error: "not found" });
      }
      case "create_doc": {
        const d = await createDoc(String(args.title), "md", args.content);
        return JSON.stringify(d);
      }
      case "edit_doc": {
        const d = await writeDoc(String(args.slug), String(args.content));
        return JSON.stringify(d);
      }
      case "delete_doc": {
        const ok = await deleteDoc(String(args.slug));
        return JSON.stringify({ ok });
      }
      case "web_search": {
        if (!ctx.tavilyApiKey) {
          return JSON.stringify({ error: "tavily not configured" });
        }
        const out = await tavilySearch({
          apiKey: ctx.tavilyApiKey,
          query: String(args.query ?? ""),
          maxResults: Number(args.max_results) || 5,
        });
        let json = JSON.stringify(out);
        if (json.length > WEB_SEARCH_RESULT_BUDGET) {
          const trimmed = out.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content.slice(0, 800),
          }));
          json = JSON.stringify({ ...out, results: trimmed }).slice(
            0,
            WEB_SEARCH_RESULT_BUDGET,
          );
        }
        return json;
      }
      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: String(err?.message ?? err) });
  }
}

export type CompactRequest = {
  messages: ChatMessage[];
  apiKey: string;
  model: string;
  baseUrl?: string;
};

const COMPACT_SYSTEM = `You compact conversation history. Read the prior chat turns and produce a concise bullet-point summary that preserves: user intents, decisions made, files/docs referenced, and any pending work. Omit chit-chat and tool boilerplate. Output ONLY the bullet summary — no preface.`;

export async function compactHistory(
  req: CompactRequest,
): Promise<{ summary: string }> {
  const baseUrl = req.baseUrl || DEFAULT_BASE_URL;
  const transcript = req.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");
  if (!transcript.trim()) return { summary: "" };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: COMPACT_SYSTEM },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`compact error ${res.status}: ${text}`);
  }
  const data: any = await res.json();
  const summary: string = data.choices?.[0]?.message?.content ?? "";
  return { summary: summary.trim() };
}

export async function runAgent(req: AgentRequest): Promise<{
  messages: ChatMessage[];
  reply: string;
  changedDocs: boolean;
}> {
  const baseUrl = req.baseUrl || DEFAULT_BASE_URL;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...req.messages,
  ];

  if (req.mentions && req.mentions.length) {
    const seen = new Set<string>();
    const blocks: string[] = [];
    for (const slug of req.mentions) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      const d = await readDoc(slug);
      if (!d) continue;
      const body = d.content.slice(0, MENTION_MAX_CHARS);
      blocks.push(`## ${d.slug} (${d.title})\n\n\`\`\`${d.kind}\n${body}\n\`\`\``);
    }
    if (blocks.length) {
      const lastUserIdx = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]!.role === "user") return i;
        }
        return -1;
      })();
      const insertion: ChatMessage = {
        role: "user",
        content: `Referenced documents (read-only context):\n\n${blocks.join("\n\n")}`,
      };
      if (lastUserIdx >= 0) {
        messages.splice(lastUserIdx, 0, insertion);
      } else {
        messages.push(insertion);
      }
    }
  }

  let changedDocs = false;
  const MAX_STEPS = 6;
  const tools = req.tavilyApiKey ? [...TOOLS, WEB_SEARCH_TOOL] : TOOLS;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mercury API error ${res.status}: ${text}`);
    }

    const data: any = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error("no message in completion response");

    const toolCalls = msg.tool_calls ?? [];
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: toolCalls.length ? toolCalls : undefined,
    };
    messages.push(assistantMsg);

    if (!toolCalls.length) {
      return {
        messages: messages.slice(1),
        reply: assistantMsg.content,
        changedDocs,
      };
    }

    for (const call of toolCalls) {
      const name = call.function?.name;
      let args: any = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {}
      const result = await runTool(name, args, {
        tavilyApiKey: req.tavilyApiKey,
      });
      if (
        name === "create_doc" ||
        name === "edit_doc" ||
        name === "delete_doc"
      ) {
        changedDocs = true;
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  return {
    messages: messages.slice(1),
    reply:
      "(stopped after max tool-use steps — try rephrasing or check the agent settings)",
    changedDocs,
  };
}
