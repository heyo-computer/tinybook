/**
 * PIN-based authentication module.
 * Generates a random 6-digit PIN on server startup and validates it for API access.
 */

// Generate a random 6-digit PIN (100000-999999)
export const PIN: string = Math.floor(100000 + Math.random() * 900000).toString();

// Store authenticated sessions (session ID -> expiry timestamp)
const sessions = new Map<string, number>();

// Session expiry time in milliseconds (24 hours)
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a new session ID and store it with expiry.
 */
export function createSession(): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, Date.now() + SESSION_DURATION_MS);
  return sessionId;
}

/**
 * Verify if a session ID is valid and not expired.
 */
export function verifySession(sessionId: string | null): boolean {
  if (!sessionId) return false;
  
  const expiry = sessions.get(sessionId);
  if (!expiry) return false;
  
  if (Date.now() > expiry) {
    sessions.delete(sessionId);
    return false;
  }
  
  return true;
}

/**
 * Invalidate a session.
 */
export function revokeSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * Clean up expired sessions periodically.
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, expiry] of sessions.entries()) {
    if (now > expiry) {
      sessions.delete(id);
    }
  }
}

// Log the PIN on startup so users can see it
console.log(`\n🔐 PIN Authentication Enabled`);
console.log(`   Your PIN is: ${PIN}\n`);