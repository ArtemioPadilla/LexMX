// Legal Prompt Builder with i18n support
import { i18n } from '@/i18n';
import type { Language } from '@/i18n';
import type { LegalArea, QueryType } from '@/types/legal';
import type { LLMProviderType } from '@/types/llm';

export interface PromptBuilderOptions {
  language?: Language;
  legalArea?: LegalArea;
  provider?: LLMProviderType | string;
  includeSpecialization?: boolean;
}

export interface QueryPromptOptions {
  query: string;
  context?: string;
  language?: Language;
  template?: 'default' | 'analysis' | 'search' | 'precedent' | 'contextWithQuery' | 'caseSummary';
  queryType?: QueryType;
  legalArea?: LegalArea;
}

export class LegalPromptBuilder {
  constructor() {}

  /**
   * Build a system prompt for the LLM
   */
  buildSystemPrompt(options: PromptBuilderOptions = {}): string {
    const {
      language = i18n.language,
      legalArea,
      includeSpecialization = true
    } = options;

    // Build base prompt
    const basePrompt = this.buildBasePrompt(language);
    
    // Add specialization if needed
    let specialization = '';
    if (includeSpecialization && legalArea) {
      specialization = this.getSpecialization(legalArea, language);
    }

    return specialization ? `${basePrompt}\n\n${specialization}` : basePrompt;
  }

  /**
   * Build the base system prompt
   */
  private buildBasePrompt(language: Language): string {
    const role = i18n.t('systemPrompts.base.role', {}, language);
    const responseLanguage = i18n.t('systemPrompts.base.responseLanguage', {}, language);
    
    // Get sources
    const sources = [
      i18n.t('systemPrompts.base.sources.constitution', {}, language),
      i18n.t('systemPrompts.base.sources.federal', {}, language),
      i18n.t('systemPrompts.base.sources.jurisprudence', {}, language),
      i18n.t('systemPrompts.base.sources.legislation', {}, language)
    ];

    // Get instructions
    const instructions = [
      i18n.t('systemPrompts.base.instructions.citation', {}, language),
      i18n.t('systemPrompts.base.instructions.references', {}, language),
      i18n.t('systemPrompts.base.instructions.disclaimer', {}, language),
      i18n.t('systemPrompts.base.instructions.verification', {}, language),
      i18n.t('systemPrompts.base.instructions.clarity', {}, language)
    ];

    // Get format requirements
    const format = [
      i18n.t('systemPrompts.base.format.response', {}, language),
      i18n.t('systemPrompts.base.format.legalBasis', {}, language),
      i18n.t('systemPrompts.base.format.procedures', {}, language),
      i18n.t('systemPrompts.base.format.warnings', {}, language)
    ];

    // Build the complete prompt with language instruction first
    if (language === 'es') {
      return `${responseLanguage}

${role}

FUENTES LEGALES:
${sources.map((s, i) => `${i + 1}. ${s}`).join('\n')}

INSTRUCCIONES CRÍTICAS:
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

FORMATO DE RESPUESTA:
${format.map(f => `- ${f}`).join('\n')}`;
    } else {
      return `${responseLanguage}

${role}

LEGAL SOURCES:
${sources.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CRITICAL INSTRUCTIONS:
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

RESPONSE FORMAT:
${format.map(f => `- ${f}`).join('\n')}`;
    }
  }

  /**
   * Get specialization text for a legal area
   */
  private getSpecialization(legalArea: LegalArea, language: Language): string {
    const key = `systemPrompts.specializations.${legalArea}`;
    return i18n.t(key, {}, language);
  }

  /**
   * Build a query prompt
   */
  buildQueryPrompt(options: QueryPromptOptions): string {
    const {
      query,
      context,
      language = i18n.language,
      template = 'default',
      queryType,
      legalArea
    } = options;

    switch (template) {
      case 'contextWithQuery':
        return i18n.t('systemPrompts.queryTemplates.contextWithQuery', {
          context: context || '',
          query,
          queryType: queryType || 'information',
          legalArea: legalArea || 'general'
        }, language);

      case 'analysis':
        return i18n.t('systemPrompts.queryTemplates.analysisRequest', { query }, language);

      case 'search':
        return i18n.t('systemPrompts.queryTemplates.documentSearch', { query }, language);

      case 'precedent':
        return i18n.t('systemPrompts.queryTemplates.precedentLookup', { query }, language);

      case 'caseSummary':
        return i18n.t('systemPrompts.queryTemplates.caseSummary', { query }, language);

      default:
        return i18n.t('systemPrompts.queryTemplates.userQuery', { query }, language);
    }
  }

  /**
   * Get provider-optimized prompt (for future provider-specific optimizations)
   */
  getProviderOptimizedPrompt(provider: string, language: Language): string {
    // For now, return the standard prompt
    // In the future, we can add provider-specific optimizations here
    return this.buildSystemPrompt({ language, provider });
  }

  /**
   * Get legal warning text
   */
  getLegalWarning(language?: Language): string {
    return i18n.t('systemPrompts.legalWarning', {}, language || i18n.language);
  }

  /**
   * Get recommended actions for a query type
   */
  getRecommendedActions(queryType: QueryType, language?: Language): string[] {
    const lang = language || i18n.language;
    const key = `systemPrompts.recommendedActions.${queryType}`;
    const actions = i18n.getSection(key, lang);
    
    if (Array.isArray(actions)) {
      return actions;
    }

    // Fallback to default actions
    const defaultActions = i18n.getSection('systemPrompts.recommendedActions.default', lang);
    return Array.isArray(defaultActions) ? defaultActions : [];
  }

  /**
   * Helper method to get raw translations for a given language
   */
  getRawTranslations(section: string, language?: Language): any {
    return i18n.getSection(section, language || i18n.language);
  }
}

// Export singleton instance
export const promptBuilder = new LegalPromptBuilder();