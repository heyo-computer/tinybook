import { useCallback, useEffect, useState } from "react";
import "./index.css";
import { api, setSessionId, type Doc, type DocMeta } from "./lib/api";
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
  const [authenticated, setAuthenticated] = useState(false);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const handleNew = useCallback(async () => {
    const title = prompt("Title for the new document?");
    if (!title) return;
    const doc = await api.create(title);
    await refreshDocs();
    setActiveSlug(doc.slug);
    setActiveDoc(doc);
  }, [refreshDocs]);

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

  const handlePinAuthenticated = (sessionId: string) => {
    setSessionId(sessionId);
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    setDocs([]);
    setActiveSlug(null);
    setActiveDoc(null);
  };

  if (!authenticated) {
    return <PinEntry onAuthenticated={handlePinAuthenticated} />;
  }

  return (
    <div className="app">
      <Sidebar
        docs={docs}
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        onNew={handleNew}
        onDelete={handleDelete}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />
      <main className="main">
        <Editor doc={activeDoc} onSave={handleSave} />
      </main>
      <Chat
        settings={settings}
        onAgentChangedDocs={handleAgentChanged}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsModal
        open={settingsOpen}
        initial={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => {
          setSettings(s);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

export default App;
