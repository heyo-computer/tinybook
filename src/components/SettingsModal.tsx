import { useEffect, useState } from "react";
import {
  saveUiSettings,
  type Theme,
  type UiSettings,
} from "../lib/ui-settings";

export type Provider = "inception" | "mistral";

export type ProviderSettings = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export type AgentSettings = {
  active: Provider;
  providers: {
    inception: ProviderSettings;
    mistral: ProviderSettings;
  };
  tools?: {
    tavily?: { apiKey: string };
  };
};

const STORAGE_KEY = "tinybook.agent.settings";

const PROVIDER_DEFAULTS: Record<Provider, ProviderSettings> = {
  inception: { apiKey: "", model: "mercury" },
  mistral: { apiKey: "", model: "mistral-large-latest" },
};

const PROVIDER_LABEL: Record<Provider, string> = {
  inception: "Inception (Mercury)",
  mistral: "Mistral",
};

const PROVIDER_BASE_URL: Record<Provider, string> = {
  inception: "https://api.inceptionlabs.ai/v1",
  mistral: "https://api.mistral.ai/v1",
};

const PROVIDER_MODELS: Record<Provider, string[]> = {
  inception: ["mercury", "mercury-coder"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "voxtral-mini-latest"],
};

function emptySettings(): AgentSettings {
  return {
    active: "inception",
    providers: {
      inception: { ...PROVIDER_DEFAULTS.inception },
      mistral: { ...PROVIDER_DEFAULTS.mistral },
    },
  };
}

export function loadSettings(): AgentSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (parsed && parsed.providers && parsed.active) {
      const inception: ProviderSettings = {
        apiKey: String(parsed.providers.inception?.apiKey ?? ""),
        model: String(parsed.providers.inception?.model ?? PROVIDER_DEFAULTS.inception.model),
        baseUrl: parsed.providers.inception?.baseUrl || undefined,
      };
      const mistral: ProviderSettings = {
        apiKey: String(parsed.providers.mistral?.apiKey ?? ""),
        model: String(parsed.providers.mistral?.model ?? PROVIDER_DEFAULTS.mistral.model),
        baseUrl: parsed.providers.mistral?.baseUrl || undefined,
      };
      const active: Provider = parsed.active === "mistral" ? "mistral" : "inception";
      const tavilyKey = String(parsed.tools?.tavily?.apiKey ?? "").trim();
      const result: AgentSettings = {
        active,
        providers: { inception, mistral },
        tools: tavilyKey ? { tavily: { apiKey: tavilyKey } } : undefined,
      };
      const activeP = result.providers[active];
      if (!activeP.apiKey || !activeP.model) return null;
      return result;
    }
    if (parsed && typeof parsed.apiKey === "string") {
      const result = emptySettings();
      result.providers.inception = {
        apiKey: String(parsed.apiKey),
        model: String(parsed.model ?? PROVIDER_DEFAULTS.inception.model),
        baseUrl: parsed.baseUrl || undefined,
      };
      if (!result.providers.inception.apiKey) return null;
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSettings(s: AgentSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function activeProvider(s: AgentSettings | null): ProviderSettings | null {
  if (!s) return null;
  const p = s.providers[s.active];
  if (!p?.apiKey || !p?.model) return null;
  const baseUrl = p.baseUrl?.trim() || PROVIDER_BASE_URL[s.active];
  return { ...p, baseUrl };
}

export function tavilyKey(s: AgentSettings | null): string | null {
  const k = s?.tools?.tavily?.apiKey?.trim();
  return k ? k : null;
}

export function mistralProvider(s: AgentSettings | null): ProviderSettings | null {
  if (!s) return null;
  const p = s.providers.mistral;
  if (!p?.apiKey) return null;
  const baseUrl = p.baseUrl?.trim() || PROVIDER_BASE_URL.mistral;
  return { ...p, baseUrl };
}

type Props = {
  open: boolean;
  initial: AgentSettings | null;
  initialUi: UiSettings;
  onClose: () => void;
  onSave: (s: AgentSettings, ui: UiSettings) => void;
};

export function SettingsModal({
  open,
  initial,
  initialUi,
  onClose,
  onSave,
}: Props) {
  const [active, setActive] = useState<Provider>("inception");
  const [providers, setProviders] = useState(() => emptySettings().providers);
  const [tavily, setTavily] = useState("");
  const [theme, setTheme] = useState<Theme>("system");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) {
      const seed = initial ?? emptySettings();
      setActive(seed.active);
      setProviders({
        inception: { ...seed.providers.inception },
        mistral: { ...seed.providers.mistral },
      });
      setTavily(seed.tools?.tavily?.apiKey ?? "");
      setTheme(initialUi.theme);
      setTitle(initialUi.title ?? "");
    }
  }, [open, initial, initialUi]);

  if (!open) return null;

  function patchProvider(p: Provider, patch: Partial<ProviderSettings>) {
    setProviders((cur) => ({ ...cur, [p]: { ...cur[p], ...patch } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned: AgentSettings["providers"] = {
      inception: {
        apiKey: providers.inception.apiKey.trim(),
        model: providers.inception.model.trim() || PROVIDER_DEFAULTS.inception.model,
        baseUrl: providers.inception.baseUrl?.trim() || undefined,
      },
      mistral: {
        apiKey: providers.mistral.apiKey.trim(),
        model: providers.mistral.model.trim() || PROVIDER_DEFAULTS.mistral.model,
        baseUrl: providers.mistral.baseUrl?.trim() || undefined,
      },
    };
    const tavilyTrimmed = tavily.trim();
    const s: AgentSettings = {
      active,
      providers: cleaned,
      tools: tavilyTrimmed ? { tavily: { apiKey: tavilyTrimmed } } : undefined,
    };
    const trimmedTitle = title.trim();
    const ui: UiSettings = {
      ...initialUi,
      theme,
      title: trimmedTitle || undefined,
    };
    saveSettings(s);
    saveUiSettings(ui);
    onSave(s, ui);
  }

  const cur = providers[active];
  const datalistId = `${active}-models`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>Settings</h2>
        <label>
          Workspace title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="tinybook"
          />
        </label>
        <label>
          Theme
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Provider
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as Provider)}
          >
            {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small" style={{ margin: 0 }}>
          Your API key is stored in your browser and sent to the local server
          per-request. Both providers are stored independently — the active one
          handles chat.
        </p>
        <label>
          API key
          <input
            type="password"
            value={cur.apiKey}
            onChange={(e) => patchProvider(active, { apiKey: e.target.value })}
            placeholder="sk-..."
          />
        </label>
        <label>
          Model
          <input
            list={datalistId}
            value={cur.model}
            onChange={(e) => patchProvider(active, { model: e.target.value })}
          />
          <datalist id={datalistId}>
            {PROVIDER_MODELS[active].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label>
          Base URL <span className="muted small">(optional)</span>
          <input
            type="text"
            value={cur.baseUrl ?? ""}
            onChange={(e) =>
              patchProvider(active, { baseUrl: e.target.value })
            }
            placeholder={PROVIDER_BASE_URL[active]}
          />
        </label>
        <fieldset className="settings-fieldset">
          <legend>Web search (Tavily)</legend>
          <p className="muted small" style={{ margin: 0 }}>
            Optional. When set, the agent gets a <code>web_search</code> tool
            backed by Tavily.
          </p>
          <label>
            API key
            <input
              type="password"
              value={tavily}
              onChange={(e) => setTavily(e.target.value)}
              placeholder="tvly-..."
            />
          </label>
        </fieldset>
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
