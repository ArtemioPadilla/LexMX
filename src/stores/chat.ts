/**
 * Chat thread shared across islands (plan Fase 4: "estado en Nano Stores").
 * The thread survives island remounts and can be read by other islands
 * (case chat, export) without React Context.
 */
import { atom } from 'nanostores';
import type { GroundedLegalResponse } from '@/lib/rag/engine';

export type ChatMode = 'ask' | 'research';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  legalResponse?: GroundedLegalResponse;
  isStreaming?: boolean;
  mode?: ChatMode;
  /** Provider / model that produced an assistant turn. */
  source?: string;
}

export const $chatMessages = atom<ChatMessage[]>([]);
export const $chatMode = atom<ChatMode>('ask');

let counter = 0;
export function nextMessageId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export function appendMessage(message: ChatMessage): void {
  $chatMessages.set([...$chatMessages.get(), message]);
}

export function updateMessage(id: string, patch: Partial<ChatMessage>): void {
  $chatMessages.set($chatMessages.get().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function resetThread(welcome?: string): void {
  $chatMessages.set(welcome ? [{ id: nextMessageId(), type: 'system', content: welcome, timestamp: Date.now() }] : []);
}

/**
 * Prompt prepared by another page (e.g. /comparar → "explain changes"). The
 * chat island consumes it once on mount and clears it. Kept in
 * sessionStorage so it survives the navigation to /chat.
 */
const PENDING_KEY = 'lexmx_pending_prompt';
export function setPendingPrompt(text: string): void {
  try { sessionStorage.setItem(PENDING_KEY, text); } catch { /* storage unavailable */ }
}
export function takePendingPrompt(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    if (v !== null) sessionStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}
