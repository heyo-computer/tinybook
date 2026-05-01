import type { ChatMessage } from "../server/agent";

export type DocMeta = { slug: string; title: string; updatedAt: number };
export type Doc = DocMeta & { content: string };

// Session ID storage - set by App.tsx after PIN authentication
let sessionId: string | null = null;

export function setSessionId(id: string | null) {
  sessionId = id;
}

export function getSessionId(): string | null {
  return sessionId;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (sessionId) {
    headers.set("x-session-id", sessionId);
  }
  return fetch(url, { ...options, headers });
}

export const api = {
  list: () => fetchWithAuth("/api/docs").then(j<DocMeta[]>),
  read: (slug: string) => fetchWithAuth(`/api/docs/${slug}`).then(j<Doc>),
  create: (title: string, content?: string) =>
    fetchWithAuth("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    }).then(j<Doc>),
  update: (slug: string, content: string) =>
    fetchWithAuth(`/api/docs/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then(j<Doc>),
  remove: (slug: string) =>
    fetchWithAuth(`/api/docs/${slug}`, { method: "DELETE" }).then(
      j<{ ok: boolean }>,
    ),
  chat: (body: {
    messages: ChatMessage[];
    apiKey: string;
    model: string;
    baseUrl?: string;
  }) =>
    fetchWithAuth("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(
      j<{ messages: ChatMessage[]; reply: string; changedDocs: boolean }>,
    ),
  logout: () =>
    fetchWithAuth("/api/auth/logout", { method: "POST" }).then(() => {
      sessionId = null;
    }),
};
