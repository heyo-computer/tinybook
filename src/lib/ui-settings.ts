export type Theme = "system" | "light" | "dark";

export type UiSettings = {
  theme: Theme;
  title?: string;
};

const STORAGE_KEY = "tinybook.ui.settings";

const DEFAULT: UiSettings = { theme: "system" };

export function loadUiSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      theme:
        parsed.theme === "light" || parsed.theme === "dark"
          ? parsed.theme
          : "system",
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title
          : undefined,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveUiSettings(s: UiSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(theme);
}
