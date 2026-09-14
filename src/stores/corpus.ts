/**
 * Cross-island state for the corpus install (plan Fase 6). The RAG engine
 * writes it while installing shards; the chat, the Biblioteca and the admin
 * pages read it with `useStore`. Nano Stores, never React Context.
 */
import { atom } from 'nanostores';
import type { CorpusInstallProgress } from '@/lib/corpus/corpus-installer';

export const $corpusInstall = atom<CorpusInstallProgress>({ phase: 'idle', installed: 0, total: 0, chunks: 0 });

export function reportCorpusInstall(progress: CorpusInstallProgress): void {
  $corpusInstall.set(progress);
}

export type JurisdictionCorpusState = 'unknown' | 'installing' | 'ready' | 'unavailable';

/** Secondary corpora (plan § 11.4 B): code → install state. Mexico is the root corpus and is not listed here. */
export const $corpusJurisdictions = atom<Record<string, JurisdictionCorpusState>>({});

export function setJurisdictionCorpusState(code: string, state: JurisdictionCorpusState): void {
  $corpusJurisdictions.set({ ...$corpusJurisdictions.get(), [code]: state });
}
