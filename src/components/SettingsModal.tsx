import { useEffect, useState } from "react";

export type AgentSettings = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

const STORAGE_KEY = "tinybook.agent.settings";

const MERCURY_MODELS = [
  "mercury",
  "mercury-coder",
];

export function loadSettings(): AgentSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentSettings;
    if (!parsed.apiKey || !parsed.model) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSettings(s: AgentSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

type Props = {
  open: boolean;
  initial: AgentSettings | null;
  onClose: () => void;
  onSave: (s: AgentSettings) => void;
};

export function SettingsModal({ open, initial, onClose, onSave }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MERCURY_MODELS[0]!);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (open) {
      setApiKey(initial?.apiKey ?? "");
      setModel(initial?.model ?? MERCURY_MODELS[0]!);
      setBaseUrl(initial?.baseUrl ?? "");
    }
  }, [open, initial]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s: AgentSettings = {
      apiKey: apiKey.trim(),
      model: model.trim(),
      baseUrl: baseUrl.trim() || undefined,
    };
    saveSettings(s);
    onSave(s);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>Agent settings</h2>
        <p className="muted small">
          tinybook uses Mercury models from Inception Labs (OpenAI-compatible
          API). Your key is stored in your browser and sent to the local server
          per-request.
        </p>
        <label>
          Inception API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoFocus
          />
        </label>
        <label>
          Model
          <input
            list="mercury-models"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="mercury-models">
            {MERCURY_MODELS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label>
          Base URL <span className="muted small">(optional)</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.inceptionlabs.ai/v1"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
