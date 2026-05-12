import { serve } from "bun";
import index from "./index.html";
import {
  createDoc,
  deleteDoc,
  listDocs,
  readDoc,
  writeDoc,
} from "./server/docs";
import { setOrder } from "./server/order";
import { runAgent, compactHistory, type ChatMessage } from "./server/agent";
import { transcribe } from "./server/transcribe";
import { polishDoc } from "./server/polish";
import {
  PIN,
  READ_PIN,
  createSession,
  verifySession,
  revokeSession,
  type Role,
} from "./server/auth";

type AuthOk = { authorized: true; role: Role };
type AuthFail = { authorized: false; response: Response };

function requireAuth(req: Request): AuthOk | AuthFail {
  const sessionId = req.headers.get("x-session-id");
  const session = sessionId ? verifySession(sessionId) : null;
  if (!session) {
    return {
      authorized: false,
      response: Response.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  return { authorized: true, role: session.role };
}

function requireOwner(req: Request): AuthOk | AuthFail {
  const auth = requireAuth(req);
  if (!auth.authorized) return auth;
  if (auth.role !== "owner") {
    return {
      authorized: false,
      response: Response.json(
        { error: "Read-only session" },
        { status: 403 },
      ),
    };
  }
  return auth;
}

const server = serve({
  routes: {
    "/*": index,

    "/api/auth": {
      async POST(req) {
        const body = (await req.json()) as { pin: string };
        if (body.pin === PIN) {
          const sessionId = createSession("owner");
          return Response.json({ sessionId, role: "owner" });
        }
        if (body.pin === READ_PIN) {
          const sessionId = createSession("reader");
          return Response.json({ sessionId, role: "reader" });
        }
        return Response.json({ error: "Invalid PIN" }, { status: 401 });
      },
    },

    "/api/auth/logout": {
      async POST(req) {
        const sessionId = req.headers.get("x-session-id");
        if (sessionId) revokeSession(sessionId);
        return Response.json({ ok: true });
      },
    },

    "/api/docs": {
      async GET(req) {
        const auth = requireAuth(req);
        if (!auth.authorized) return auth.response;
        return Response.json(await listDocs());
      },
      async POST(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        const body = (await req.json()) as {
          title: string;
          kind?: "md" | "csv";
          content?: string;
        };
        if (!body?.title) {
          return Response.json({ error: "title required" }, { status: 400 });
        }
        const kind = body.kind === "csv" ? "csv" : "md";
        const doc = await createDoc(body.title, kind, body.content);
        return Response.json(doc, { status: 201 });
      },
    },

    "/api/docs/_order": {
      async PUT(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        const body = (await req.json()) as { slugs: string[] };
        if (!Array.isArray(body?.slugs)) {
          return Response.json({ error: "slugs required" }, { status: 400 });
        }
        await setOrder(body.slugs);
        return Response.json({ ok: true });
      },
    },

    "/api/docs/:slug": {
      async GET(req) {
        const auth = requireAuth(req);
        if (!auth.authorized) return auth.response;
        const doc = await readDoc(req.params.slug);
        if (!doc) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json(doc);
      },
      async PUT(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        const body = (await req.json()) as { content: string };
        if (typeof body?.content !== "string") {
          return Response.json({ error: "content required" }, { status: 400 });
        }
        const doc = await writeDoc(req.params.slug, body.content);
        return Response.json(doc);
      },
      async DELETE(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        const ok = await deleteDoc(req.params.slug);
        return Response.json({ ok });
      },
    },

    "/api/docs/:slug/polish": {
      async POST(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        try {
          const body = (await req.json()) as {
            apiKey: string;
            model: string;
            baseUrl?: string;
          };
          if (!body.apiKey || !body.model) {
            return Response.json(
              { error: "apiKey and model required (set in Settings)" },
              { status: 400 },
            );
          }
          const doc = await polishDoc({ slug: req.params.slug, ...body });
          return Response.json(doc);
        } catch (err: any) {
          return Response.json(
            { error: String(err?.message ?? err) },
            { status: 500 },
          );
        }
      },
    },

    "/api/agent/transcribe": {
      async POST(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        try {
          const form = await req.formData();
          const audio = form.get("file");
          const apiKey = String(form.get("apiKey") ?? "");
          const model = String(form.get("model") ?? "");
          const baseUrl = (form.get("baseUrl") as string | null) || undefined;
          if (!(audio instanceof Blob)) {
            return Response.json({ error: "file required" }, { status: 400 });
          }
          if (!apiKey || !model) {
            return Response.json(
              { error: "apiKey and model required (configure Mistral in Settings)" },
              { status: 400 },
            );
          }
          const text = await transcribe({ audio, apiKey, model, baseUrl });
          return Response.json({ text });
        } catch (err: any) {
          return Response.json(
            { error: String(err?.message ?? err) },
            { status: 500 },
          );
        }
      },
    },

    "/api/agent/compact": {
      async POST(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        try {
          const body = (await req.json()) as {
            messages: ChatMessage[];
            apiKey: string;
            model: string;
            baseUrl?: string;
          };
          if (!body.apiKey || !body.model) {
            return Response.json(
              { error: "apiKey and model are required (set in Settings)" },
              { status: 400 },
            );
          }
          const result = await compactHistory(body);
          return Response.json(result);
        } catch (err: any) {
          return Response.json(
            { error: String(err?.message ?? err) },
            { status: 500 },
          );
        }
      },
    },

    "/api/agent/chat": {
      async POST(req) {
        const auth = requireOwner(req);
        if (!auth.authorized) return auth.response;
        try {
          const body = (await req.json()) as {
            messages: ChatMessage[];
            apiKey: string;
            model: string;
            baseUrl?: string;
            mentions?: string[];
            tavilyApiKey?: string;
          };
          if (!body.apiKey || !body.model) {
            return Response.json(
              { error: "apiKey and model are required (set in Settings)" },
              { status: 400 },
            );
          }
          const result = await runAgent(body);
          return Response.json(result);
        } catch (err: any) {
          return Response.json(
            { error: String(err?.message ?? err) },
            { status: 500 },
          );
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`tinybook running at ${server.url}`);
