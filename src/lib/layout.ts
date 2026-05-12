export type Layout = {
  sidebarW: number;
  chatW: number;
};

const STORAGE_KEY = "tinybook.ui.layout";

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const CHAT_MIN = 240;
export const CHAT_MAX = 600;

const DEFAULT: Layout = { sidebarW: 260, chatW: 360 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Layout>;
    return {
      sidebarW: clamp(
        Number(parsed.sidebarW) || DEFAULT.sidebarW,
        SIDEBAR_MIN,
        SIDEBAR_MAX,
      ),
      chatW: clamp(
        Number(parsed.chatW) || DEFAULT.chatW,
        CHAT_MIN,
        CHAT_MAX,
      ),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveLayout(l: Layout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
}
