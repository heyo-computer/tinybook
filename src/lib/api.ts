import type { ChatMessage } from "../server/agent";

export type DocKind = "md" | "csv";
export type DocMeta = {
  slug: string;
  title: string;
  kind: DocKind;
  updatedAt: number;
};
export type Doc = DocMeta & { content: string };

export type Role = "owner" | "reader";

let sessionId: string | null = null;
let sessionRole: Role | null = null;

export function setSession(s: { id: string; role: Role } | null) {
  if (!s) {
    sessionId = null;
    sessionRole = null;
  } else {
    sessionId = s.id;
    sessionRole = s.role;
  }
}

export function setSessionId(id: string | null) {
  sessionId = id;
  if (!id) sessionRole = null;
}

export function getSessionId(): string | null {
  return sessionId;
}

export function getRole(): Role | null {
  return sessionRole;
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
  create: (title: string, kind: DocKind = "md", content?: string) =>
    fetchWithAuth("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, kind, content }),
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
  reorder: (slugs: string[]) =>
    fetchWithAuth("/api/docs/_order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
    }).then(j<{ ok: boolean }>),
  chat: (body: {
    messages: ChatMessage[];
    apiKey: string;
    model: string;
    baseUrl?: string;
    mentions?: string[];
    tavilyApiKey?: string;
  }) =>
    fetchWithAuth("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(
      j<{ messages: ChatMessage[]; reply: string; changedDocs: boolean }>,
    ),
  compact: (body: {
    messages: ChatMessage[];
    apiKey: string;
    model: string;
    baseUrl?: string;
  }) =>
    fetchWithAuth("/api/agent/compact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<{ summary: string }>),
  polish: (
    slug: string,
    creds: { apiKey: string; model: string; baseUrl?: string },
  ) =>
    fetchWithAuth(`/api/docs/${slug}/polish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    }).then(j<Doc>),
  transcribe: (
    audio: Blob,
    creds: { apiKey: string; model: string; baseUrl?: string },
  ) => {
    const fd = new FormData();
    fd.append("file", audio, "audio.webm");
    fd.append("apiKey", creds.apiKey);
    fd.append("model", creds.model);
    if (creds.baseUrl) fd.append("baseUrl", creds.baseUrl);
    return fetchWithAuth("/api/agent/transcribe", {
      method: "POST",
      body: fd,
    }).then(j<{ text: string }>);
  },
  logout: () =>
    fetchWithAuth("/api/auth/logout", { method: "POST" }).then(() => {
      sessionId = null;
      sessionRole = null;
    }),
};
