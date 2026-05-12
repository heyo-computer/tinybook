import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Doc } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import { downloadDoc } from "../lib/download";
import { CsvEditor } from "./CsvEditor";
import {
  activeProvider,
  mistralProvider,
  type AgentSettings,
} from "./SettingsModal";

type Props = {
  doc: Doc | null;
  settings: AgentSettings | null;
  readOnly?: boolean;
  onSave: (slug: string, content: string) => Promise<void>;
  onReplaced: (doc: Doc) => void;
};

export function Editor({ doc, settings, readOnly = false, onSave, onReplaced }: Props) {
  if (!doc) {
    return (
      <div className="editor empty">
        <p className="muted">
          {readOnly
            ? "Select a document to view."
            : "Select a document or create a new one to get started."}
        </p>
      </div>
    );
  }
  if (doc.kind === "csv") {
    return <CsvEditor doc={doc} readOnly={readOnly} onSave={onSave} />;
  }
  return (
    <MarkdownEditor
      doc={doc}
      settings={settings}
      readOnly={readOnly}
      onSave={onSave}
      onReplaced={onReplaced}
    />
  );
}

function MarkdownEditor({
  doc,
  settings,
  readOnly,
  onSave,
  onReplaced,
}: {
  doc: Doc;
  settings: AgentSettings | null;
  readOnly: boolean;
  onSave: Props["onSave"];
  onReplaced: Props["onReplaced"];
}) {
  const [draft, setDraft] = useState(doc.content);
  const [savedAt, setSavedAt] = useState<number | null>(doc.updatedAt);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSlug = useRef<string>(doc.slug);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (doc.slug !== lastSlug.current) {
      setDraft(doc.content);
      lastSlug.current = doc.slug;
      setSavedAt(doc.updatedAt);
    }
  }, [doc]);

  useEffect(() => {
    if (readOnly) return;
    if (draft === doc.content) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onSave(doc.slug, draft);
      setSavedAt(Date.now());
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, doc, onSave, readOnly]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setTranscribeError(null);
    const mistral = mistralProvider(settings);
    if (!mistral) {
      setTranscribeError(
        "Configure Mistral provider in Settings to use transcribe.",
      );
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      setTranscribeError(`Microphone access denied: ${err?.message ?? err}`);
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      if (blob.size === 0) return;
      setTranscribing(true);
      try {
        const transcribeModel =
          settings?.providers.mistral.model || "voxtral-mini-latest";
        const { text } = await api.transcribe(blob, {
          apiKey: mistral.apiKey,
          model: transcribeModel.startsWith("voxtral")
            ? transcribeModel
            : "voxtral-mini-latest",
          baseUrl: mistral.baseUrl,
        });
        if (text) {
          setDraft((cur) =>
            cur && !cur.endsWith("\n") ? `${cur}\n\n${text}` : `${cur}${text}`,
          );
        }
      } catch (err: any) {
        setTranscribeError(String(err?.message ?? err));
      } finally {
        setTranscribing(false);
      }
    };
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function polish() {
    setPolishError(null);
    const provider = activeProvider(settings);
    if (!provider) {
      setPolishError("Configure a provider in Settings to polish.");
      return;
    }
    if (!draft.trim()) return;
    setPolishing(true);
    try {
      const updated = await api.polish(doc.slug, {
        apiKey: provider.apiKey,
        model: provider.model,
        baseUrl: provider.baseUrl,
      });
      onReplaced(updated);
      setDraft(updated.content);
      setSavedAt(updated.updatedAt);
    } catch (err: any) {
      setPolishError(String(err?.message ?? err));
    } finally {
      setPolishing(false);
    }
  }

  const html = useMemo(() => renderMarkdown(draft), [draft]);
  const transcribeDisabled = transcribing;

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <span className="doc-slug-label">{doc.slug}.md</span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {!readOnly && (
            <>
              <button
                className={`ghost-btn small-btn ${recording ? "recording" : ""}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribeDisabled}
                title={recording ? "Stop recording" : "Transcribe speech"}
              >
                {recording ? "■ Stop" : transcribing ? "… Transcribing" : "● Transcribe"}
              </button>
              <button
                className="ghost-btn small-btn"
                onClick={polish}
                disabled={polishing || !draft.trim()}
                title="Polish document with the agent"
              >
                {polishing ? "… Polishing" : "✨ Polish"}
              </button>
            </>
          )}
          <button
            className="ghost-btn small-btn"
            onClick={() => downloadDoc({ ...doc, content: draft })}
            title="Download"
          >
            ↓ Download
          </button>
          {!readOnly && (
            <span className="muted small">
              {savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : "unsaved"}
            </span>
          )}
        </div>
      </div>
      {transcribeError && (
        <div className="editor-error">{transcribeError}</div>
      )}
      {polishError && <div className="editor-error">{polishError}</div>}
      <div className={`editor-panes${readOnly ? " readonly" : ""}`}>
        {readOnly ? (
          <div
            className="editor-preview full"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <>
            <textarea
              className="editor-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck
              placeholder="# Title&#10;&#10;Write markdown here..."
            />
            <div
              className="editor-preview"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </>
        )}
      </div>
    </div>
  );
}
