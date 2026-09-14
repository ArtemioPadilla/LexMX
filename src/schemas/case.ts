import { z } from 'zod';
import type { LegalArea } from '@/types/legal';

export const CaseFormSchema = z.object({
  title: z.string().trim().min(3, 'cases.titleRequired').max(160),
  description: z.string().trim().max(4000),
  client: z.string().trim().max(160).optional(),
  caseNumber: z.string().trim().max(60).optional(),
  legalArea: z.custom<LegalArea>((v) => typeof v === 'string' && v.length > 0, 'setup.validation.required'),
  status: z.enum(['active', 'pending', 'resolved', 'archived']),
});
export type CaseFormValues = z.infer<typeof CaseFormSchema>;

export const PartySchema = z.object({
  name: z.string().trim().min(1, 'setup.validation.required').max(160),
  role: z.enum(['plaintiff', 'defendant', 'witness', 'expert', 'other']),
  contact: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type PartyValues = z.infer<typeof PartySchema>;

export const DeadlineSchema = z.object({
  title: z.string().trim().min(1, 'setup.validation.required').max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'setup.validation.required'),
  type: z.enum(['court', 'filing', 'meeting', 'other']),
  notes: z.string().trim().max(1000).optional(),
});
export type DeadlineValues = z.infer<typeof DeadlineSchema>;
