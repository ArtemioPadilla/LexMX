// Chat and messaging types for LexMX

import type { JsonValue, StorageMetadata } from './common';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  role?: 'user' | 'assistant' | 'system';
  metadata?: {
    citations?: string[];
    confidence?: number;
    provider?: string;
    model?: string;
    cost?: number;
    tokens?: number;
    processingTime?: number;
    [key: string]: JsonValue;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created: number;
  updated: number;
  metadata?: StorageMetadata;
}

export interface CaseData {
  id: string;
  title: string;
  description: string;
  created: number;
  updated: number;
  status: 'active' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  participants: string[];
  documents: string[];
  deadlines: Deadline[];
  notes: string[];
  timeline: TimelineEvent[];
  metadata?: StorageMetadata;
}

export interface Deadline {
  id: string;
  title: string;
  description?: string;
  date: Date;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  type: 'hearing' | 'filing' | 'response' | 'other';
  metadata?: StorageMetadata;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  type: 'created' | 'updated' | 'deadline' | 'document' | 'note' | 'other';
  metadata?: StorageMetadata;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'url' | 'number' | 'date' | 'select' | 'textarea';
  label: string;
  value: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  error?: string;
  metadata?: StorageMetadata;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: string;
  relatedTerms?: string[];
  examples?: string[];
  legalReferences?: string[];
  metadata?: StorageMetadata;
}

export interface GlossaryCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
  termCount?: number;
}

// Chat-related storage types
export interface StoredChatSession {
  id: string;
  messages: StoredChatMessage[];
  metadata: StorageMetadata;
}

export interface StoredChatMessage {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, JsonValue>;
}

export interface StoredCaseData {
  id: string;
  title: string;
  description: string;
  created: number;
  updated: number;
  status: string;
  priority: string;
  tags: string[];
  participants: string[];
  documents: string[];
  deadlines?: Array<{
    id: string;
    title: string;
    description?: string;
    date: string; // ISO string
    completed: boolean;
    priority: string;
    type: string;
  }>;
  notes: string[];
  timeline: Array<{
    id: string;
    title: string;
    description?: string;
    date: string; // ISO string
    type: string;
  }>;
  metadata?: StorageMetadata;
}