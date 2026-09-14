import { describe, it, expect } from 'vitest';
import { promptBuilder } from '../prompt-builder';
import { i18n } from '@/i18n';

// These tests exercise the real i18n singleton (reading from
// src/i18n/locales/{es,en}.json) rather than mocking it, per the module's
// testing contract: prompt assembly correctness depends on the actual
// translation content staying in sync with the prompt builder's keys.
describe('prompt-builder', () => {
  describe('buildSystemPrompt', () => {
    it('assembles a Spanish base prompt containing the legal sources and disclaimer instructions', () => {
      const prompt = promptBuilder.buildSystemPrompt({ language: 'es' });

      expect(prompt).toContain(i18n.t('systemPrompts.base.role', {}, 'es'));
      expect(prompt).toContain('FUENTES LEGALES');
      expect(prompt).toContain(i18n.t('systemPrompts.base.instructions.disclaimer', {}, 'es'));
    });

    it('assembles an English base prompt containing the legal sources and disclaimer instructions', () => {
      const prompt = promptBuilder.buildSystemPrompt({ language: 'en' });

      expect(prompt).toContain(i18n.t('systemPrompts.base.role', {}, 'en'));
      expect(prompt).toContain('LEGAL SOURCES');
      expect(prompt).toContain(i18n.t('systemPrompts.base.instructions.disclaimer', {}, 'en'));
    });

    it('appends the constitutional specialization when legalArea is "constitutional" (es)', () => {
      const withArea = promptBuilder.buildSystemPrompt({ language: 'es', legalArea: 'constitutional' });
      const withoutArea = promptBuilder.buildSystemPrompt({ language: 'es' });

      const specialization = i18n.t('systemPrompts.specializations.constitutional', {}, 'es');
      expect(withArea).toContain(specialization);
      expect(withArea).not.toBe(withoutArea);
      expect(withArea.startsWith(withoutArea)).toBe(true);
    });

    it('appends the labor specialization when legalArea is "labor" (en), distinct from constitutional', () => {
      const labor = promptBuilder.buildSystemPrompt({ language: 'en', legalArea: 'labor' });
      const constitutional = promptBuilder.buildSystemPrompt({ language: 'en', legalArea: 'constitutional' });

      expect(labor).toContain(i18n.t('systemPrompts.specializations.labor', {}, 'en'));
      expect(labor).not.toBe(constitutional);
    });

    it('omits the specialization block when includeSpecialization is false', () => {
      const prompt = promptBuilder.buildSystemPrompt({
        language: 'es',
        legalArea: 'labor',
        includeSpecialization: false
      });

      expect(prompt).not.toContain(i18n.t('systemPrompts.specializations.labor', {}, 'es'));
    });
  });

  describe('buildQueryPrompt', () => {
    it('renders the analysis template with the query interpolated', () => {
      const prompt = promptBuilder.buildQueryPrompt({
        query: '¿Qué dice el artículo 123?',
        template: 'analysis',
        language: 'es'
      });

      expect(prompt).toContain('¿Qué dice el artículo 123?');
    });

    it('falls back to the default userQuery template when none is specified', () => {
      const prompt = promptBuilder.buildQueryPrompt({ query: 'test query', language: 'en' });
      expect(prompt).toContain('test query');
    });
  });

  describe('getRecommendedActions', () => {
    it('returns a non-empty list of actions for a known query type', () => {
      const actions = promptBuilder.getRecommendedActions('procedure', 'es');
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });
  });
});
