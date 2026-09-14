/**
 * Community document requests without a server (plan Fase 5 / línea G):
 * the queue published in `public/document-requests.json` plus the requests,
 * votes and comments the user creates locally (`lexmx_document_requests`).
 * Submitting a request opens a pre-filled GitHub issue so maintainers see
 * it; the local copy keeps the list useful offline. When LexMX Servidor is
 * configured this store is the place to swap in Supabase.
 */
import type { DocumentRequest, RequestComment, RequestStatus, LegalArea, DocumentType, LegalHierarchy, RequestPriority } from '@/types/legal';

export const REQUESTS_KEY = 'lexmx_document_requests';
export const VOTER_KEY = 'lexmx_request_voter_id';

interface QueueEntry {
  id: string;
  title: string;
  url?: string;
  type?: DocumentType;
  primaryArea?: LegalArea;
  hierarchy?: LegalHierarchy;
  priority?: RequestPriority;
  status?: RequestStatus;
  description?: string;
}

interface LocalState {
  requests: DocumentRequest[];
  votes: Record<string, { voters: string[]; count: number }>;
  comments: Record<string, RequestComment[]>;
}

const EMPTY: LocalState = { requests: [], votes: {}, comments: {} };

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLocal(): LocalState {
  const raw = storage()?.getItem(REQUESTS_KEY);
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return { requests: parsed.requests ?? [], votes: parsed.votes ?? {}, comments: parsed.comments ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

export function writeLocal(state: LocalState): void {
  storage()?.setItem(REQUESTS_KEY, JSON.stringify(state));
}

/** Random, device-local id used only to prevent double votes. Never sent anywhere. */
export function voterId(): string {
  const s = storage();
  const existing = s?.getItem(VOTER_KEY);
  if (existing) return existing;
  const id = `anon-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  s?.setItem(VOTER_KEY, id);
  return id;
}

export function queueEntryToRequest(entry: QueueEntry): DocumentRequest {
  const now = new Date().toISOString();
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description ?? (entry.url ? `Fuente oficial: ${entry.url}` : ''),
    requestedBy: 'lexmx',
    type: entry.type ?? 'law',
    hierarchy: entry.hierarchy ?? 3,
    primaryArea: entry.primaryArea ?? 'administrative',
    secondaryAreas: [],
    territorialScope: 'federal',
    sources: entry.url ? [{ id: `${entry.id}-src`, type: 'url', url: entry.url, isOfficial: true, verified: true }] : [],
    votes: 0,
    voters: [],
    comments: [],
    priority: entry.priority ?? 'medium',
    status: entry.status ?? 'pending',
    createdAt: now,
    updatedAt: now,
    verified: true,
  } as DocumentRequest;
}

/** Merges the published queue with local requests, votes and comments. */
export function mergeRequests(queue: QueueEntry[], local: LocalState): DocumentRequest[] {
  const base = [...queue.map(queueEntryToRequest), ...local.requests];
  return base.map((r) => {
    const v = local.votes[r.id];
    const c = local.comments[r.id] ?? [];
    return { ...r, votes: r.votes + (v?.count ?? 0), voters: [...r.voters, ...(v?.voters ?? [])], comments: [...r.comments, ...c] };
  });
}

export function applyVote(state: LocalState, requestId: string, voter: string, vote: 'up' | 'down'): LocalState {
  const entry = state.votes[requestId] ?? { voters: [], count: 0 };
  if (entry.voters.includes(voter)) return state;
  return { ...state, votes: { ...state.votes, [requestId]: { voters: [...entry.voters, voter], count: entry.count + (vote === 'up' ? 1 : -1) } } };
}

export function addComment(state: LocalState, requestId: string, author: string, content: string): LocalState {
  const comment: RequestComment = { id: `c-${Date.now().toString(36)}`, authorId: author, content: content.trim(), createdAt: new Date().toISOString(), isModeratorComment: false, votes: 0, flagged: false };
  return { ...state, comments: { ...state.comments, [requestId]: [...(state.comments[requestId] ?? []), comment] } };
}

export function addLocalRequest(state: LocalState, request: DocumentRequest): LocalState {
  return { ...state, requests: [request, ...state.requests.filter((r) => r.id !== request.id)] };
}

export async function fetchQueue(url: string): Promise<QueueEntry[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { documents?: QueueEntry[] };
    return data.documents ?? [];
  } catch {
    return [];
  }
}

/** Body of the GitHub issue a new request opens (plan: every request is reviewable in public). */
export function requestIssueBody(r: Partial<DocumentRequest>): string {
  const sources = (r.sources ?? []).map((s) => `- ${s.url ?? s.filename ?? s.type}${s.isOfficial ? ' (oficial)' : ''}`).join('\n');
  return [
    `**Documento**: ${r.title ?? ''}`,
    `**Tipo**: ${r.type ?? ''} · **Jerarquía**: ${r.hierarchy ?? ''} · **Área**: ${r.primaryArea ?? ''} · **Ámbito**: ${r.territorialScope ?? ''}`,
    r.authority ? `**Autoridad**: ${r.authority}` : '',
    '',
    r.description ?? '',
    '',
    sources ? `**Fuentes**\n${sources}` : '',
    '',
    '_Solicitud creada desde /requests/new. Los datos personales no se incluyen._',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}
