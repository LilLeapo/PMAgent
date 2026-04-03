import type { ChatMessage, Session } from './types.js';

const sessions = new Map<string, Session>();
const MAX_HISTORY = 40; // Max messages per session
const SESSION_TTL = 30 * 60 * 1000; // 30 min inactive → clear

export function getSession(chatId: string): Session {
  let session = sessions.get(chatId);
  if (!session) {
    session = { chatId, messages: [], lastActive: Date.now() };
    sessions.set(chatId, session);
  }
  session.lastActive = Date.now();
  return session;
}

export function appendToSession(chatId: string, ...msgs: ChatMessage[]): void {
  const session = getSession(chatId);
  session.messages.push(...msgs);

  // Trim oldest messages if over limit (keep system prompt area)
  if (session.messages.length > MAX_HISTORY) {
    session.messages = session.messages.slice(-MAX_HISTORY);
  }
}

export function clearSession(chatId: string): void {
  sessions.delete(chatId);
}

/** Periodic cleanup of stale sessions */
export function cleanupSessions(): void {
  const now = Date.now();
  for (const [chatId, session] of sessions) {
    if (now - session.lastActive > SESSION_TTL) {
      sessions.delete(chatId);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000);
