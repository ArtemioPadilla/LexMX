/**
 * Expedientes shared across islands (CaseWorkspace, CaseChat, CaseTimeline).
 * Persistence goes through CaseStore (IndexedDB); this store is the in-memory
 * view every island reads with useStore.
 */
import { atom, computed } from 'nanostores';
import type { LegalCase } from '@/types/cases';
import { caseStore } from '@/lib/case-management/case-store';

export const $cases = atom<LegalCase[]>([]);
export const $selectedCaseId = atom<string | null>(null);
export const $casesReady = atom(false);
export const $selectedCase = computed([$cases, $selectedCaseId], (cases, id) => cases.find((c) => c.id === id) ?? null);

export function newId(prefix = 'c'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function loadCases(): Promise<void> {
  try {
    await caseStore.migrateFromLocalStorage();
    $cases.set(await caseStore.list());
  } catch (error) {
    console.warn('Cases: could not load from IndexedDB', error);
    $cases.set([]);
  } finally {
    $casesReady.set(true);
  }
}

export async function createCase(input: Pick<LegalCase, 'title' | 'description' | 'legalArea'> & Partial<Pick<LegalCase, 'client' | 'caseNumber' | 'jurisdiction'>>): Promise<LegalCase> {
  const now = new Date();
  const c: LegalCase = {
    id: newId(),
    title: input.title,
    description: input.description,
    client: input.client || undefined,
    caseNumber: input.caseNumber || undefined,
    legalArea: input.legalArea,
    jurisdiction: input.jurisdiction ?? 'mx',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    documents: [],
    notes: [],
    conversations: [],
    deadlines: [],
    parties: [],
    statusChanges: [],
  };
  await caseStore.put(c);
  $cases.set([c, ...$cases.get()]);
  $selectedCaseId.set(c.id);
  return c;
}

export async function updateCase(id: string, patch: Partial<LegalCase> | ((current: LegalCase) => Partial<LegalCase>)): Promise<LegalCase | null> {
  const current = $cases.get().find((c) => c.id === id);
  if (!current) return null;
  const changes = typeof patch === 'function' ? patch(current) : patch;
  const statusChanges =
    changes.status && changes.status !== current.status
      ? [...current.statusChanges, { date: new Date(), from: current.status, to: changes.status }]
      : current.statusChanges;
  const next: LegalCase = { ...current, ...changes, statusChanges, updatedAt: new Date() };
  await caseStore.put(next);
  $cases.set($cases.get().map((c) => (c.id === id ? next : c)));
  return next;
}

export async function removeCase(id: string): Promise<void> {
  await caseStore.delete(id);
  $cases.set($cases.get().filter((c) => c.id !== id));
  if ($selectedCaseId.get() === id) $selectedCaseId.set(null);
}
