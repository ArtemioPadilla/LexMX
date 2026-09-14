/**
 * Expedientes (case management), plan Fase 5 / línea C. In memory dates are
 * `Date`; the store serializes them to ISO strings. Nothing here leaves the
 * device unless the user opts into LexMX Servidor.
 */
import type { LegalArea } from './legal';

export type CaseStatus = 'active' | 'pending' | 'resolved' | 'archived';
export type DeadlineType = 'court' | 'filing' | 'meeting' | 'other';
export type PartyRole = 'plaintiff' | 'defendant' | 'witness' | 'expert' | 'other';

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content?: string;
  tags: string[];
}

export interface CaseNote {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface Deadline {
  id: string;
  title: string;
  date: Date;
  type: DeadlineType;
  completed: boolean;
  notes?: string;
}

export interface Party {
  id: string;
  name: string;
  role: PartyRole;
  contact?: string;
  notes?: string;
}

export interface StatusChange {
  date: Date;
  from: CaseStatus;
  to: CaseStatus;
}

export interface LegalCase {
  id: string;
  title: string;
  description: string;
  client?: string;
  caseNumber?: string;
  legalArea: LegalArea;
  /** Jurisdiction code from src/jurisdictions (defaults to 'mx'). */
  jurisdiction: string;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
  documents: CaseDocument[];
  notes: CaseNote[];
  conversations: string[];
  deadlines: Deadline[];
  parties: Party[];
  summary?: string;
  statusChanges: StatusChange[];
}
