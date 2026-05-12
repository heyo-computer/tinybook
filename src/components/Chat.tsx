import { useEffect, useMemo, useRef, useState } from "react";
import { api, type DocMeta } from "../lib/api";
import type { ChatMessage } from "../server/agent";
import {
  activeProvider,
  tavilyKey,
  type AgentSettings,
} from "./SettingsModal";
import { PaperBackdrop } from "./PaperBackdrop";

type Props = {
  settings: AgentSettings | null;
  docs: DocMeta[];
  onAgentChangedDocs: () => void;
  onOpenSettings: () => void;
};

const MENTION_RE = /(?:^|\s)@([\w-]*)$/;

export function Chat({ settings, docs, onAgentChangedDocs, onOpenSettings }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const provider = activeProvider(settings);

  const slugSet = useMemo(() => new Set(docs.map((d) => d.slug)), [docs]);

  const matches = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    const filtered = docs.filter(
      (d) =>
        d.slug.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q),
    );
    return filtered.slice(0, 8);
  }, [mentionQuery, docs]);

  useEffect(() => {
    setMentionIdx(0);
  }, [mentionQuery]);

  function updateMentionState(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(MENTION_RE);
    if (m) setMentionQuery(m[1] ?? "");
    else setMentionQuery(null);
  }

  function applyMention(slug: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? input.length;
    const before = input.slice(0, caret);
    const after = input.slice(caret);
    const m = before.match(MENTION_RE);
    if (!m) return;
    const tokenStart = before.length - (m[0].length - (m[0].startsWith("@") ? 0 : 1));
    const head = before.slice(0, tokenStart);
    const replaced = `${head}@${slug} `;
    const next = replaced + after;
    setInput(next);
    setMentionQuery(null);
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = replaced.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function collectMentions(text: string): string[] {
    const re = /(?:^|\s)@([\w-]+)/g;
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const slug = m[1]!;
      if (slugSet.has(slug)) out.add(slug);
    }
    return [...out];
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (!provider) {
      setError("Configure a provider API key and model in Settings first.");
      return;
    }
    setError(null);
    setBusy(true);
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...history, userMsg];
    setHistory(next);
    setInput("");
    try {
      const mentions = collectMentions(text);
      const tavily = tavilyKey(settings);
      const res = await api.chat({
        messages: next,
        apiKey: provider.apiKey,
        model: provider.model,
        baseUrl: provider.baseUrl,
        mentions: mentions.length ? mentions : undefined,
        tavilyApiKey: tavily ?? undefined,
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

  const estTokens = Math.ceil(
    history.reduce((sum, m) => sum + (m.content?.length ?? 0), 0) / 4,
  );

  function formatTokens(n: number): string {
    if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`;
    return `~${n}`;
  }

  function clearContext() {
    if (history.length === 0) return;
    if (!confirm("Clear chat history?")) return;
    setHistory([]);
    setError(null);
  }

  async function compactContext() {
    if (history.length === 0 || busy) return;
    if (!provider) {
      setError("Configure a provider API key and model in Settings first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { summary } = await api.compact({
        messages: history,
        apiKey: provider.apiKey,
        model: provider.model,
        baseUrl: provider.baseUrl,
      });
      if (summary) {
        setHistory([
          {
            role: "user",
            content: `Prior conversation summary:\n${summary}`,
          },
          {
            role: "assistant",
            content: "(history compacted)",
          },
        ]);
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat">
      <PaperBackdrop />
      <div className="chat-header">
        <h3>Agent</h3>
        <div className="chat-actions">
          {!provider && (
            <button className="link-btn" onClick={onOpenSettings}>
              Configure
            </button>
          )}
          <span
            className="ctx-meter"
            title={`Estimated context: ${estTokens} tokens`}
          >
            {formatTokens(estTokens)}
          </span>
          <button
            className="icon-btn"
            onClick={compactContext}
            disabled={busy || history.length === 0}
            title="Compact context"
          >
            ⤓
          </button>
          <button
            className="icon-btn"
            onClick={clearContext}
            disabled={busy || history.length === 0}
            title="Clear context"
          >
            ⌫
          </button>
        </div>
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
        {mentionQuery != null && matches.length > 0 && (
          <ul className="mention-popover" role="listbox">
            {matches.map((d, i) => (
              <li
                key={d.slug}
                role="option"
                aria-selected={i === mentionIdx}
                className={i === mentionIdx ? "active" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyMention(d.slug);
                }}
              >
                <span className="mention-title">{d.title}</span>
                <span className="mention-slug">@{d.slug}</span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);
            updateMentionState(v, e.target.selectionStart ?? v.length);
          }}
          onKeyUp={(e) => {
            const ta = e.currentTarget;
            updateMentionState(ta.value, ta.selectionStart ?? ta.value.length);
          }}
          onClick={(e) => {
            const ta = e.currentTarget;
            updateMentionState(ta.value, ta.selectionStart ?? ta.value.length);
          }}
          onBlur={() => setMentionQuery(null)}
          onKeyDown={(e) => {
            if (mentionQuery != null && matches.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIdx((i) => (i + 1) % matches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIdx((i) => (i - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyMention(matches[mentionIdx]!.slug);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="Ask the agent... (Ctrl/Cmd+Enter to send, @ to mention)"
          disabled={busy}
        />
        <button className="primary-btn" onClick={send} disabled={busy}>
          Send
        </button>
      </div>
    </section>
  );
}
