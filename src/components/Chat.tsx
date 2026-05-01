import { useState } from "react";
import { api } from "../lib/api";
import type { ChatMessage } from "../server/agent";
import type { AgentSettings } from "./SettingsModal";

type Props = {
  settings: AgentSettings | null;
  onAgentChangedDocs: () => void;
  onOpenSettings: () => void;
};

export function Chat({ settings, onAgentChangedDocs, onOpenSettings }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (!settings?.apiKey || !settings?.model) {
      setError("Configure your Inception API key and model in Settings first.");
      return;
    }
    setError(null);
    setBusy(true);
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...history, userMsg];
    setHistory(next);
    setInput("");
    try {
      const res = await api.chat({
        messages: next,
        apiKey: settings.apiKey,
        model: settings.model,
        baseUrl: settings.baseUrl,
      });
      setHistory(res.messages);
      if (res.changedDocs) onAgentChangedDocs();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  const visible = history.filter(
    (m) => m.role === "user" || (m.role === "assistant" && m.content),
  );

  return (
    <section className="chat">
      <div className="chat-header">
        <h3>Agent</h3>
        {!settings?.apiKey && (
          <button className="link-btn" onClick={onOpenSettings}>
            Configure
          </button>
        )}
      </div>
      <div className="chat-log">
        {visible.length === 0 && (
          <p className="muted small">
            Ask the agent to draft, edit, or organize your markdown.
          </p>
        )}
        {visible.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-role">{m.role}</div>
            <div className="chat-content">{m.content}</div>
          </div>
        ))}
        {busy && <div className="chat-msg assistant"><div className="chat-role">assistant</div><div className="chat-content muted">thinking…</div></div>}
        {error && <div className="chat-error">{error}</div>}
      </div>
      <div className="chat-input">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="Ask the agent... (Ctrl/Cmd+Enter to send)"
          disabled={busy}
        />
        <button className="primary-btn" onClick={send} disabled={busy}>
          Send
        </button>
      </div>
    </section>
  );
}
