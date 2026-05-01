import { createDoc, listDocs, readDoc, writeDoc, deleteDoc } from "./docs";

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
};

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

async function runTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "list_docs":
        return JSON.stringify(await listDocs());
      case "read_doc": {
        const d = await readDoc(String(args.slug));
        return JSON.stringify(d ?? { error: "not found" });
      }
      case "create_doc": {
        const d = await createDoc(String(args.title), args.content);
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
      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: String(err?.message ?? err) });
  }
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

  let changedDocs = false;
  const MAX_STEPS = 6;

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
        tools: TOOLS,
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
      const result = await runTool(name, args);
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
