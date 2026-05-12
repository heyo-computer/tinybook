/**
 * PIN-based authentication module.
 * Generates a random 6-digit owner PIN and a separate reader PIN on startup.
 * Owners have full access; readers may only read documents.
 */

export type Role = "owner" | "reader";

function rand6(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const PIN: string = rand6();
export const READ_PIN: string = (() => {
  let p = rand6();
  while (p === PIN) p = rand6();
  return p;
})();

type SessionInfo = { expiry: number; role: Role };

const sessions = new Map<string, SessionInfo>();

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function createSession(role: Role): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    expiry: Date.now() + SESSION_DURATION_MS,
    role,
  });
  return sessionId;
}

export function verifySession(
  sessionId: string | null,
): { role: Role } | null {
  if (!sessionId) return null;
  const info = sessions.get(sessionId);
  if (!info) return null;
  if (Date.now() > info.expiry) {
    sessions.delete(sessionId);
    return null;
  }
  return { role: info.role };
}

export function revokeSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, info] of sessions.entries()) {
    if (now > info.expiry) sessions.delete(id);
  }
}

console.log(`\n🔐 PIN Authentication Enabled`);
console.log(`   Owner PIN:  ${PIN}`);
console.log(`   Reader PIN: ${READ_PIN}\n`);
