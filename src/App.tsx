import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
import { api, setSession, type Doc, type DocMeta, type Role } from "./lib/api";
import { downloadDoc } from "./lib/download";
import {
  applyTheme,
  loadUiSettings,
  type UiSettings,
} from "./lib/ui-settings";
import {
  CHAT_MAX,
  CHAT_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  loadLayout,
  saveLayout,
} from "./lib/layout";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { Chat } from "./components/Chat";
import { PinEntry } from "./components/PinEntry";
import {
  SettingsModal,
  loadSettings,
  type AgentSettings,
} from "./components/SettingsModal";

export function App() {
  const [role, setRole] = useState<Role | null>(null);
  const authenticated = role !== null;
  const readOnly = role === "reader";
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [uiSettings, setUiSettings] = useState<UiSettings>(() =>
    loadUiSettings(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layout, setLayout] = useState(() => loadLayout());
  const dragRef = useRef<{ which: "sidebar" | "chat"; startX: number; startW: number } | null>(null);

  useEffect(() => {
    applyTheme(uiSettings.theme);
    if (uiSettings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [uiSettings.theme]);

  const workspaceTitle = uiSettings.title?.trim() || "tinybook";

  useEffect(() => {
    document.title = workspaceTitle;
  }, [workspaceTitle]);

  const refreshDocs = useCallback(async () => {
    const list = await api.list();
    setDocs(list);
    return list;
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (authenticated) {
      refreshDocs();
    }
  }, [authenticated, refreshDocs]);

  useEffect(() => {
    if (!activeSlug) {
      setActiveDoc(null);
      return;
    }
    let cancelled = false;
    api.read(activeSlug).then((d) => {
      if (!cancelled) setActiveDoc(d);
    }).catch(() => {
      if (!cancelled) setActiveDoc(null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  const handleNew = useCallback(
    async (kind: "md" | "csv" | "kanban") => {
      const title = prompt("Title for the new document?");
      if (!title) return;
      const docKind = kind === "md" ? "md" : "csv";
      const content =
        kind === "kanban" ? "title,status,notes\n" : undefined;
      const doc = await api.create(title, docKind, content);
      await refreshDocs();
      setActiveSlug(doc.slug);
      setActiveDoc(doc);
    },
    [refreshDocs],
  );

  const handleImport = useCallback(
    async (files: File[]) => {
      const skipped: string[] = [];
      let lastSlug: string | null = null;
      for (const file of files) {
        const dot = file.name.lastIndexOf(".");
        const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
        let kind: "md" | "csv" | null = null;
        if (ext === "md" || ext === "markdown") kind = "md";
        else if (ext === "csv") kind = "csv";
        if (!kind) {
          skipped.push(file.name);
          continue;
        }
        const title = dot >= 0 ? file.name.slice(0, dot) : file.name;
        const content = await file.text();
        const doc = await api.create(title, kind, content);
        lastSlug = doc.slug;
      }
      await refreshDocs();
      if (lastSlug) setActiveSlug(lastSlug);
      return { skipped };
    },
    [refreshDocs],
  );

  const handleDownload = useCallback(async (slug: string) => {
    const doc = await api.read(slug);
    downloadDoc(doc);
  }, []);

  const handleDelete = useCallback(
    async (slug: string) => {
      await api.remove(slug);
      if (activeSlug === slug) {
        setActiveSlug(null);
        setActiveDoc(null);
      }
      await refreshDocs();
    },
    [activeSlug, refreshDocs],
  );

  const handleReorder = useCallback(
    async (slugs: string[]) => {
      setDocs((cur) => {
        const byslug = new Map(cur.map((d) => [d.slug, d]));
        const ordered = slugs
          .map((s) => byslug.get(s))
          .filter((d): d is DocMeta => !!d);
        const remaining = cur.filter((d) => !slugs.includes(d.slug));
        return [...ordered, ...remaining];
      });
      await api.reorder(slugs);
      await refreshDocs();
    },
    [refreshDocs],
  );

  const handleSave = useCallback(
    async (slug: string, content: string) => {
      const updated = await api.update(slug, content);
      setActiveDoc((cur) => (cur && cur.slug === slug ? updated : cur));
      await refreshDocs();
    },
    [refreshDocs],
  );

  const handleAgentChanged = useCallback(async () => {
    const list = await refreshDocs();
    if (activeSlug) {
      const stillThere = list.find((d) => d.slug === activeSlug);
      if (!stillThere) {
        setActiveSlug(null);
        setActiveDoc(null);
      } else {
        const fresh = await api.read(activeSlug);
        setActiveDoc(fresh);
      }
    }
  }, [activeSlug, refreshDocs]);

  const handlePinAuthenticated = (session: { sessionId: string; role: Role }) => {
    setSession({ id: session.sessionId, role: session.role });
    setRole(session.role);
  };

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function startResize(which: "sidebar" | "chat", e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      which,
      startX: e.clientX,
      startW: which === "sidebar" ? layout.sidebarW : layout.chatW,
    };
  }

  function onResizeMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = e.clientX - drag.startX;
    if (drag.which === "sidebar") {
      const next = clamp(drag.startW + delta, SIDEBAR_MIN, SIDEBAR_MAX);
      setLayout((cur) => ({ ...cur, sidebarW: next }));
    } else {
      const next = clamp(drag.startW - delta, CHAT_MIN, CHAT_MAX);
      setLayout((cur) => ({ ...cur, chatW: next }));
    }
  }

  function endResize(e: React.PointerEvent) {
    if (!dragRef.current) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setLayout((cur) => {
      saveLayout(cur);
      return cur;
    });
  }

  const handleLogout = async () => {
    await api.logout();
    setRole(null);
    setDocs([]);
    setActiveSlug(null);
    setActiveDoc(null);
  };

  if (!authenticated) {
    return <PinEntry onAuthenticated={handlePinAuthenticated} />;
  }

  return (
    <div
      className={`app${readOnly ? " readonly" : ""}`}
      style={
        {
          "--sidebar-w": `${layout.sidebarW}px`,
          "--chat-w": readOnly ? "0px" : `${layout.chatW}px`,
        } as React.CSSProperties
      }
    >
      <Sidebar
        docs={docs}
        activeSlug={activeSlug}
        title={workspaceTitle}
        readOnly={readOnly}
        onSelect={setActiveSlug}
        onNew={handleNew}
        onImport={handleImport}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onReorder={handleReorder}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />
      <div
        className="resizer"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={(e) => startResize("sidebar", e)}
        onPointerMove={onResizeMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <main className="main">
        <Editor
          doc={activeDoc}
          settings={settings}
          readOnly={readOnly}
          onSave={handleSave}
          onReplaced={(d) => {
            setActiveDoc(d);
            refreshDocs();
          }}
        />
      </main>
      {!readOnly && (
        <>
          <div
            className="resizer"
            role="separator"
            aria-orientation="vertical"
            onPointerDown={(e) => startResize("chat", e)}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
          <Chat
            settings={settings}
            docs={docs}
            onAgentChangedDocs={handleAgentChanged}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <SettingsModal
            open={settingsOpen}
            initial={settings}
            initialUi={uiSettings}
            onClose={() => setSettingsOpen(false)}
            onSave={(s, ui) => {
              setSettings(s);
              setUiSettings(ui);
              setSettingsOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

export default App;
