import { serve } from "bun";
import index from "./index.html";
import {
  createDoc,
  deleteDoc,
  listDocs,
  readDoc,
  writeDoc,
} from "./server/docs";
import { runAgent, type ChatMessage } from "./server/agent";
import { PIN, createSession, verifySession, revokeSession } from "./server/auth";

// Middleware to check authentication for protected routes
function requireAuth(req: Request): { authorized: true } | { authorized: false; response: Response } {
  const sessionId = req.headers.get("x-session-id");
  if (!sessionId || !verifySession(sessionId)) {
    return {
      authorized: false,
      response: Response.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return { authorized: true };
}

const server = serve({
  routes: {
    "/*": index,

    "/api/auth": {
      async POST(req) {
        const body = (await req.json()) as { pin: string };
        if (body.pin === PIN) {
          const sessionId = createSession();
          return Response.json({ sessionId });
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
        const auth = requireAuth(req);
        if (!auth.authorized) return auth.response;
        const body = (await req.json()) as { title: string; content?: string };
        if (!body?.title) {
          return Response.json({ error: "title required" }, { status: 400 });
        }
        const doc = await createDoc(body.title, body.content);
        return Response.json(doc, { status: 201 });
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
        const auth = requireAuth(req);
        if (!auth.authorized) return auth.response;
        const body = (await req.json()) as { content: string };
        if (typeof body?.content !== "string") {
          return Response.json({ error: "content required" }, { status: 400 });
        }
        const doc = await writeDoc(req.params.slug, body.content);
        return Response.json(doc);
      },
      async DELETE(req) {
        const auth = requireAuth(req);
        if (!auth.authorized) return auth.response;
        const ok = await deleteDoc(req.params.slug);
        return Response.json({ ok });
      },
    },

    "/api/agent/chat": {
      async POST(req) {
        const auth = requireAuth(req);
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
