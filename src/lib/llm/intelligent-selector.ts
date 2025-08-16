import type { LLMProvider as _LLMProvider, LLMModel as _LLMModel } from '../../types/llm';
import type { LegalArea, QueryType } from '../../types/legal';
import { providerManager } from './provider-manager';

export interface SelectionCriteria {
  queryComplexity: 'simple' | 'moderate' | 'complex';
  legalArea?: LegalArea;
  queryType?: QueryType;
  maxCost?: number;
  requiresReasoning?: boolean;
  requiresCitations?: boolean;
  responseLength?: 'short' | 'medium' | 'long';
  language?: 'es' | 'en';
  priority?: 'speed' | 'quality' | 'cost';
}

export interface ProviderScore {
  providerId: string;
  model: string;
  score: number;
  estimatedCost: number;
  estimatedLatency: number;
  reasoning: string[];
}

interface ModelCapabilities {
  providerId: string;
  model: string;
  contextWindow: number;
  costPer1kTokens: number;
  avgLatencyMs: number;
  strengths: string[];
  weaknesses: string[];
  bestFor: QueryType[];
  languages: string[];
}

// Model capability database
const MODEL_CAPABILITIES: ModelCapabilities[] = [
  {
    providerId: 'openai',
    model: 'gpt-4-turbo-preview',
    contextWindow: 128000,
    costPer1kTokens: 0.01,
    avgLatencyMs: 2000,
    strengths: ['complex reasoning', 'legal analysis', 'citations', 'multilingual'],
    weaknesses: ['cost', 'latency'],
    bestFor: ['interpretation', 'analysis', 'advice'],
    languages: ['es', 'en']
  },
  {
    providerId: 'openai',
    model: 'gpt-4',
    contextWindow: 8192,
    costPer1kTokens: 0.03,
    avgLatencyMs: 3000,
    strengths: ['accuracy', 'legal reasoning', 'complex cases'],
    weaknesses: ['cost', 'context window'],
    bestFor: ['interpretation', 'analysis'],
    languages: ['es', 'en']
  },
  {
    providerId: 'openai',
    model: 'gpt-3.5-turbo',
    contextWindow: 16385,
    costPer1kTokens: 0.001,
    avgLatencyMs: 800,
    strengths: ['speed', 'cost', 'general queries'],
    weaknesses: ['complex reasoning', 'accuracy'],
    bestFor: ['definition', 'procedure', 'general'],
    languages: ['es', 'en']
  },
  {
    providerId: 'claude',
    model: 'claude-3-opus',
    contextWindow: 200000,
    costPer1kTokens: 0.015,
    avgLatencyMs: 2500,
    strengths: ['legal reasoning', 'ethics', 'long context', 'accuracy'],
    weaknesses: ['availability', 'cost'],
    bestFor: ['analysis', 'interpretation', 'advice'],
    languages: ['es', 'en']
  },
  {
    providerId: 'claude',
    model: 'claude-3-sonnet',
    contextWindow: 200000,
    costPer1kTokens: 0.003,
    avgLatencyMs: 1500,
    strengths: ['balance', 'reasoning', 'long context'],
    weaknesses: ['availability'],
    bestFor: ['analysis', 'procedure', 'interpretation'],
    languages: ['es', 'en']
  },
  {
    providerId: 'claude',
    model: 'claude-3-haiku',
    contextWindow: 200000,
    costPer1kTokens: 0.00025,
    avgLatencyMs: 500,
    strengths: ['speed', 'cost', 'long context'],
    weaknesses: ['complex reasoning'],
    bestFor: ['definition', 'general', 'procedure'],
    languages: ['es', 'en']
  },
  {
    providerId: 'gemini',
    model: 'gemini-1.5-pro',
    contextWindow: 1000000,
    costPer1kTokens: 0.0035,
    avgLatencyMs: 1200,
    strengths: ['huge context', 'multimodal', 'cost-effective'],
    weaknesses: ['consistency', 'legal expertise'],
    bestFor: ['document analysis', 'general', 'procedure'],
    languages: ['es', 'en']
  },
  {
    providerId: 'gemini',
    model: 'gemini-pro',
    contextWindow: 32000,
    costPer1kTokens: 0.001,
    avgLatencyMs: 1000,
    strengths: ['cost', 'speed', 'general knowledge'],
    weaknesses: ['legal expertise', 'consistency'],
    bestFor: ['definition', 'general'],
    languages: ['es', 'en']
  },
  {
    providerId: 'ollama',
    model: 'llama3',
    contextWindow: 8192,
    costPer1kTokens: 0,
    avgLatencyMs: 2000,
    strengths: ['privacy', 'free', 'offline'],
    weaknesses: ['accuracy', 'legal knowledge', 'speed'],
    bestFor: ['general', 'definition'],
    languages: ['es', 'en']
  },
  {
    providerId: 'ollama',
    model: 'mixtral',
    contextWindow: 32000,
    costPer1kTokens: 0,
    avgLatencyMs: 3000,
    strengths: ['privacy', 'free', 'multilingual', 'larger context'],
    weaknesses: ['speed', 'legal expertise'],
    bestFor: ['general', 'procedure'],
    languages: ['es', 'en']
  }
];

export class IntelligentProviderSelector {
  
  /**
   * Selects the best provider and model based on the given criteria
   */
  async selectProvider(criteria: SelectionCriteria): Promise<ProviderScore | null> {
    const availableProviders = await providerManager.getAvailableProviders();
    if (availableProviders.length === 0) {
      return null;
    }

    const scores: ProviderScore[] = [];

    for (const provider of availableProviders) {
      const models = await this.getProviderModels(provider.id);
      
      for (const model of models) {
        const capability = MODEL_CAPABILITIES.find(
          c => c.providerId === provider.id && c.model === model
        );
        
        if (!capability) continue;

        const score = this.scoreModel(capability, criteria);
        scores.push(score);
      }
    }

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Filter by max cost if specified
    if (criteria.maxCost !== undefined) {
      const filtered = scores.filter(s => s.estimatedCost <= criteria.maxCost);
      return filtered[0] || null;
    }

    return scores[0] || null;
  }

  /**
   * Scores a model based on how well it matches the criteria
   */
  private scoreModel(capability: ModelCapabilities, criteria: SelectionCriteria): ProviderScore {
    let score = 100; // Start with perfect score
    const reasoning: string[] = [];

    // Query complexity scoring
    switch (criteria.queryComplexity) {
      case 'complex':
        if (capability.strengths.includes('complex reasoning')) {
          score += 20;
          reasoning.push('Excellent for complex reasoning');
        } else if (capability.weaknesses.includes('complex reasoning')) {
          score -= 30;
          reasoning.push('Not ideal for complex queries');
        }
        break;
      case 'simple':
        if (capability.strengths.includes('speed')) {
          score += 10;
          reasoning.push('Fast for simple queries');
        }
        if (capability.costPer1kTokens > 0.01) {
          score -= 20;
          reasoning.push('Expensive for simple queries');
        }
        break;
    }

    // Legal area and query type matching
    if (criteria.queryType && capability.bestFor.includes(criteria.queryType)) {
      score += 15;
      reasoning.push(`Optimized for ${criteria.queryType} queries`);
    }

    // Reasoning requirements
    if (criteria.requiresReasoning) {
      if (capability.strengths.includes('legal reasoning') || capability.strengths.includes('reasoning')) {
        score += 20;
        reasoning.push('Strong legal reasoning capabilities');
      } else {
        score -= 25;
        reasoning.push('Limited reasoning capabilities');
      }
    }

    // Citation requirements
    if (criteria.requiresCitations) {
      if (capability.strengths.includes('citations') || capability.strengths.includes('accuracy')) {
        score += 15;
        reasoning.push('Good citation support');
      }
    }

    // Language support
    if (criteria.language && !capability.languages.includes(criteria.language)) {
      score -= 50;
      reasoning.push(`Limited support for ${criteria.language}`);
    }

    // Priority-based adjustments
    switch (criteria.priority) {
      case 'speed':
        if (capability.avgLatencyMs < 1000) {
          score += 20;
          reasoning.push('Very fast response time');
        } else if (capability.avgLatencyMs > 2000) {
          score -= 20;
          reasoning.push('Slower response time');
        }
        break;
      case 'cost':
        if (capability.costPer1kTokens === 0) {
          score += 30;
          reasoning.push('Free to use');
        } else if (capability.costPer1kTokens < 0.002) {
          score += 20;
          reasoning.push('Very cost-effective');
        } else if (capability.costPer1kTokens > 0.01) {
          score -= 20;
          reasoning.push('Higher cost');
        }
        break;
      case 'quality':
        if (capability.strengths.includes('accuracy') || capability.strengths.includes('legal expertise')) {
          score += 25;
          reasoning.push('High quality responses');
        }
        break;
    }

    // Response length considerations
    if (criteria.responseLength === 'long' && capability.contextWindow < 16000) {
      score -= 15;
      reasoning.push('Limited context for long responses');
    } else if (criteria.responseLength === 'long' && capability.contextWindow > 100000) {
      score += 10;
      reasoning.push('Excellent for long documents');
    }

    // Estimate cost (tokens = query + response, rough estimate)
    const estimatedTokens = this.estimateTokens(criteria);
    const estimatedCost = (estimatedTokens / 1000) * capability.costPer1kTokens;

    return {
      providerId: capability.providerId,
      model: capability.model,
      score: Math.max(0, Math.min(100, score)),
      estimatedCost,
      estimatedLatency: capability.avgLatencyMs,
      reasoning
    };
  }

  /**
   * Estimates token usage based on criteria
   */
  private estimateTokens(criteria: SelectionCriteria): number {
    let baseTokens = 500; // Average query

    switch (criteria.queryComplexity) {
      case 'simple':
        baseTokens = 300;
        break;
      case 'complex':
        baseTokens = 800;
        break;
    }

    switch (criteria.responseLength) {
      case 'short':
        baseTokens += 200;
        break;
      case 'medium':
        baseTokens += 500;
        break;
      case 'long':
        baseTokens += 1500;
        break;
      default:
        baseTokens += 500;
    }

    if (criteria.requiresCitations) {
      baseTokens += 300;
    }

    return baseTokens;
  }

  /**
   * Gets available models for a provider
   */
  private async getProviderModels(providerId: string): Promise<string[]> {
    const provider = await providerManager.getProvider(providerId);
    if (!provider) return [];

    // Get models from capabilities that match this provider
    return MODEL_CAPABILITIES
      .filter(c => c.providerId === providerId)
      .map(c => c.model);
  }

  /**
   * Analyzes a query to determine selection criteria
   */
  analyzeQuery(query: string): SelectionCriteria {
    const criteria: SelectionCriteria = {
      queryComplexity: 'moderate',
      language: 'es',
      priority: 'quality'
    };

    // Detect language
    const englishWords = query.match(/\b(what|how|when|where|the|is|are|law|legal)\b/gi);
    if (englishWords && englishWords.length > 3) {
      criteria.language = 'en';
    }

    // Detect complexity
    const complexIndicators = [
      'interpretación', 'análisis', 'constitucionalidad', 'jurisprudencia',
      'contradicción', 'conflicto', 'interpretation', 'analysis', 'precedent'
    ];
    const simpleIndicators = [
      'qué es', 'definición', 'cuánto', 'dónde', 'what is', 'definition', 'how much'
    ];

    if (complexIndicators.some(indicator => query.toLowerCase().includes(indicator))) {
      criteria.queryComplexity = 'complex';
      criteria.requiresReasoning = true;
    } else if (simpleIndicators.some(indicator => query.toLowerCase().includes(indicator))) {
      criteria.queryComplexity = 'simple';
    }

    // Detect if citations are needed
    if (query.match(/\b(artículo|ley|código|norma|reglamento|article|law|code)\b/i)) {
      criteria.requiresCitations = true;
    }

    // Detect query type
    if (query.match(/\b(procedimiento|trámite|cómo|pasos|procedure|how to|steps)\b/i)) {
      criteria.queryType = 'procedure';
    } else if (query.match(/\b(qué significa|definición|what means|definition)\b/i)) {
      criteria.queryType = 'definition';
    } else if (query.match(/\b(interpretación|análisis|interpretation|analysis)\b/i)) {
      criteria.queryType = 'interpretation';
    } else if (query.match(/\b(consejo|recomendación|debo|advice|should|recommend)\b/i)) {
      criteria.queryType = 'advice';
    }

    // Estimate response length
    if (query.match(/\b(resumen|breve|corto|summary|brief|short)\b/i)) {
      criteria.responseLength = 'short';
    } else if (query.match(/\b(detallado|completo|exhaustivo|detailed|complete|comprehensive)\b/i)) {
      criteria.responseLength = 'long';
    }

    return criteria;
  }

  /**
   * Gets provider recommendations for a query
   */
  async getRecommendations(query: string, maxResults: number = 3): Promise<ProviderScore[]> {
    const criteria = this.analyzeQuery(query);
    const availableProviders = await providerManager.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      return [];
    }

    const scores: ProviderScore[] = [];

    for (const provider of availableProviders) {
      const models = await this.getProviderModels(provider.id);
      
      for (const model of models) {
        const capability = MODEL_CAPABILITIES.find(
          c => c.providerId === provider.id && c.model === model
        );
        
        if (!capability) continue;

        const score = this.scoreModel(capability, criteria);
        scores.push(score);
      }
    }

    // Sort by score and return top results
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, maxResults);
  }
}

// Export singleton instance
export const intelligentSelector = new IntelligentProviderSelector();