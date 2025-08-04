#!/usr/bin/env node

/**
 * Embeddings generation script for Mexican legal corpus
 * 
 * This script processes the legal corpus and generates embeddings
 * using various embedding models, optimized for legal content.
 * 
 * Usage: npm run build:embeddings
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  corpusDir: path.join(__dirname, '../public/legal-corpus'),
  embeddingsDir: path.join(__dirname, '../public/embeddings'),
  metadataFile: path.join(__dirname, '../public/legal-corpus/metadata.json'),
  embeddingsMetaFile: path.join(__dirname, '../public/embeddings/embeddings-metadata.json'),
  chunkSize: 512,
  chunkOverlap: 50,
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000
};

// Embedding providers configuration
const EMBEDDING_PROVIDERS = {
  openai: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    maxTokens: 8192,
    apiUrl: 'https://api.openai.com/v1/embeddings',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    })
  },
  local: {
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 512,
    // This would use a local sentence-transformers model
    // For now, we'll simulate embeddings
    apiUrl: null
  }
};

class EmbeddingsGenerator {
  constructor() {
    this.chunks = [];
    this.embeddings = [];
    this.stats = {
      totalDocuments: 0,
      totalChunks: 0,
      processedChunks: 0,
      skippedChunks: 0,
      totalTokens: 0,
      errors: []
    };
    this.provider = null;
    this.apiKey = null;
  }

  async generate() {
    console.log('🚀 Iniciando generación de embeddings para corpus legal...\n');

    try {
      // Setup
      await this.setup();

      // Load corpus
      await this.loadCorpus();

      // Process documents into chunks
      await this.processDocuments();

      // Generate embeddings
      await this.generateEmbeddings();

      // Save embeddings
      await this.saveEmbeddings();

      // Generate metadata
      await this.generateMetadata();

      // Show results
      this.showResults();

    } catch (error) {
      console.error('❌ Error durante la generación de embeddings:', error);
      process.exit(1);
    }
  }

  async setup() {
    console.log('⚙️  Configurando generador de embeddings...');

    // Create embeddings directory
    await fs.mkdir(CONFIG.embeddingsDir, { recursive: true });

    // Detect available embedding provider
    this.apiKey = process.env.OPENAI_API_KEY;
    
    if (this.apiKey) {
      this.provider = EMBEDDING_PROVIDERS.openai;
      console.log('   ✓ Usando OpenAI para embeddings');
    } else {
      this.provider = EMBEDDING_PROVIDERS.local;
      console.log('   ✓ Usando embeddings simulados (sin API key)');
      console.log('   ℹ️  Para usar OpenAI, configura OPENAI_API_KEY en tu entorno');
    }

    console.log(`   📏 Dimensiones: ${this.provider.dimensions}`);
    console.log(`   📦 Tamaño de chunk: ${CONFIG.chunkSize} caracteres`);
    console.log('');
  }

  async loadCorpus() {
    console.log('📚 Cargando corpus legal...');

    try {
      const metadataContent = await fs.readFile(CONFIG.metadataFile, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      this.stats.totalDocuments = metadata.totalDocuments;
      console.log(`   📄 Documentos encontrados: ${metadata.totalDocuments}`);
      
      return metadata;
    } catch (error) {
      throw new Error(`No se pudo cargar metadata del corpus: ${error.message}`);
    }
  }

  async processDocuments() {
    console.log('✂️  Procesando documentos en chunks...');

    const files = await fs.readdir(CONFIG.corpusDir);
    const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'metadata.json' && file !== 'index.json');

    for (const filename of jsonFiles) {
      try {
        await this.processDocument(filename);
        console.log(`   ✓ Procesado: ${filename}`);
      } catch (error) {
        this.stats.errors.push({ file: filename, error: error.message });
        console.log(`   ❌ Error procesando ${filename}: ${error.message}`);
      }
    }

    this.stats.totalChunks = this.chunks.length;
    console.log(`   📦 Total de chunks generados: ${this.stats.totalChunks}\n`);
  }

  async processDocument(filename) {
    const filePath = path.join(CONFIG.corpusDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const document = JSON.parse(content);

    // Since we can't directly import TypeScript modules from Node.js,
    // we'll implement a simple chunking strategy here
    const documentChunks = this.simpleChunkDocument(document);

    // Add chunks to collection
    for (const chunk of documentChunks) {
      this.chunks.push({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        tokens: this.estimateTokens(chunk.content)
      });
    }
  }

  simpleChunkDocument(document) {
    const chunks = [];
    
    for (const content of document.content) {
      const text = content.content;
      const sentences = this.splitIntoSentences(text);
      
      let currentChunk = '';
      let chunkIndex = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

        if (potentialChunk.length > CONFIG.chunkSize && currentChunk) {
          // Create chunk from current content
          chunks.push({
            id: `${document.id}_chunk_${chunkIndex}`,
            content: currentChunk.trim(),
            metadata: {
              documentId: document.id,
              documentTitle: document.title,
              type: document.type,
              hierarchy: document.hierarchy,
              legalArea: document.primaryArea,
              keywords: this.extractSimpleKeywords(currentChunk),
              citations: []
            }
          });
          
          chunkIndex++;

          // Start new chunk with overlap
          if (CONFIG.chunkOverlap > 0) {
            const overlapText = this.getLastWords(currentChunk, CONFIG.chunkOverlap);
            currentChunk = overlapText + ' ' + sentence;
          } else {
            currentChunk = sentence;
          }
        } else {
          currentChunk = potentialChunk;
        }
      }

      // Add final chunk if there's remaining content
      if (currentChunk.trim()) {
        chunks.push({
          id: `${document.id}_chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            documentId: document.id,
            documentTitle: document.title,
            type: document.type,
            hierarchy: document.hierarchy,
            legalArea: document.primaryArea,
            keywords: this.extractSimpleKeywords(currentChunk),
            citations: []
          }
        });
      }
    }

    return chunks;
  }

  splitIntoSentences(text) {
    return text
      .split(/(?<!Art|Artículo|Inc|Frac|Núm)\.(?=\s+[A-ZÁÉÍÓÚÑ]|$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  extractSimpleKeywords(text) {
    const legalTerms = [
      'artículo', 'fracción', 'inciso', 'párrafo', 'constitución', 'código', 'ley',
      'derecho', 'obligación', 'responsabilidad', 'procedimiento', 'amparo'
    ];
    
    const keywords = [];
    const lowerText = text.toLowerCase();
    
    for (const term of legalTerms) {
      if (lowerText.includes(term)) {
        keywords.push(term);
      }
    }
    
    return keywords;
  }

  getLastWords(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    const words = text.split(' ');
    let result = '';
    
    for (let i = words.length - 1; i >= 0; i--) {
      const candidate = words[i] + (result ? ' ' + result : '');
      if (candidate.length > maxLength) break;
      result = candidate;
    }
    
    return result || text.slice(-maxLength);
  }

  estimateTokens(text) {
    // Rough token estimation (1 token ≈ 4 characters for English/Spanish)
    return Math.ceil(text.length / 4);
  }

  async generateEmbeddings() {
    console.log('🧮 Generando embeddings...');

    const batches = this.createBatches(this.chunks, CONFIG.batchSize);
    console.log(`   📦 Procesando ${batches.length} lotes de ${CONFIG.batchSize} chunks\n`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`   🔄 Procesando lote ${i + 1}/${batches.length} (${batch.length} chunks)...`);

      try {
        const batchEmbeddings = await this.generateBatchEmbeddings(batch);
        this.embeddings.push(...batchEmbeddings);
        this.stats.processedChunks += batch.length;

        // Progress indicator
        const progress = Math.round((this.stats.processedChunks / this.stats.totalChunks) * 100);
        console.log(`   ✓ Lote completado. Progreso: ${progress}% (${this.stats.processedChunks}/${this.stats.totalChunks})`);

        // Small delay to be respectful to APIs
        if (this.provider.apiUrl && i < batches.length - 1) {
          await this.delay(500);
        }

      } catch (error) {
        console.log(`   ❌ Error en lote ${i + 1}: ${error.message}`);
        this.stats.errors.push({ batch: i + 1, error: error.message });
        
        // Skip this batch but continue with others
        this.stats.skippedChunks += batch.length;
      }
    }

    console.log('');
  }

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  async generateBatchEmbeddings(chunks) {
    if (this.provider.apiUrl) {
      // Use API provider (OpenAI)
      return await this.generateAPIEmbeddings(chunks);
    } else {
      // Use simulated embeddings for development
      return await this.generateSimulatedEmbeddings(chunks);
    }
  }

  async generateAPIEmbeddings(chunks) {
    const texts = chunks.map(chunk => chunk.content);
    
    const response = await this.makeAPIRequest({
      model: this.provider.model,
      input: texts,
      encoding_format: 'float'
    });

    return chunks.map((chunk, index) => ({
      id: chunk.id,
      embedding: response.data[index].embedding,
      metadata: chunk.metadata,
      tokens: chunk.tokens
    }));
  }

  async generateSimulatedEmbeddings(chunks) {
    // Generate random embeddings for development/testing
    // In production, this would use a local model like sentence-transformers
    
    return chunks.map(chunk => ({
      id: chunk.id,
      embedding: this.generateRandomEmbedding(this.provider.dimensions),
      metadata: chunk.metadata,
      tokens: chunk.tokens
    }));
  }

  generateRandomEmbedding(dimensions) {
    // Generate a normalized random vector
    const vector = [];
    let magnitude = 0;
    
    for (let i = 0; i < dimensions; i++) {
      const value = (Math.random() - 0.5) * 2; // Random between -1 and 1
      vector.push(value);
      magnitude += value * value;
    }
    
    // Normalize the vector
    magnitude = Math.sqrt(magnitude);
    return vector.map(value => value / magnitude);
  }

  async makeAPIRequest(payload) {
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const response = await fetch(this.provider.apiUrl, {
          method: 'POST',
          headers: this.provider.headers(this.apiKey),
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Track token usage
        if (data.usage) {
          this.stats.totalTokens += data.usage.total_tokens;
        }

        return data;

      } catch (error) {
        console.log(`     ❌ Intento ${attempt}/${CONFIG.maxRetries} falló: ${error.message}`);
        
        if (attempt === CONFIG.maxRetries) {
          throw error;
        }
        
        await this.delay(CONFIG.retryDelay * attempt);
      }
    }
  }

  async saveEmbeddings() {
    console.log('💾 Guardando embeddings...');

    // Save embeddings in chunks to avoid memory issues
    const batches = this.createBatches(this.embeddings, 1000);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const filename = `embeddings-${i.toString().padStart(3, '0')}.json`;
      const filePath = path.join(CONFIG.embeddingsDir, filename);
      
      await fs.writeFile(filePath, JSON.stringify(batch, null, 2), 'utf-8');
      console.log(`   ✓ Guardado: ${filename} (${batch.length} embeddings)`);
    }

    // Save embedding index
    const index = {
      version: '1.0.0',
      provider: this.provider.model,
      dimensions: this.provider.dimensions,
      totalEmbeddings: this.embeddings.length,
      batchFiles: batches.length,
      buildDate: new Date().toISOString()
    };

    const indexPath = path.join(CONFIG.embeddingsDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`   ✓ Índice guardado: index.json\n`);
  }

  async generateMetadata() {
    console.log('📋 Generando metadata de embeddings...');

    const metadata = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      provider: {
        model: this.provider.model,
        dimensions: this.provider.dimensions,
        maxTokens: this.provider.maxTokens
      },
      corpus: {
        totalDocuments: this.stats.totalDocuments,
        totalChunks: this.stats.totalChunks,
        processedChunks: this.stats.processedChunks,
        skippedChunks: this.stats.skippedChunks
      },
      processing: {
        chunkSize: CONFIG.chunkSize,
        chunkOverlap: CONFIG.chunkOverlap,
        batchSize: CONFIG.batchSize
      },
      usage: {
        totalTokens: this.stats.totalTokens,
        estimatedCost: this.estimateCost()
      },
      quality: {
        successRate: Math.round((this.stats.processedChunks / this.stats.totalChunks) * 100),
        errors: this.stats.errors.length
      }
    };

    await fs.writeFile(CONFIG.embeddingsMetaFile, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log('   ✓ Metadata de embeddings guardada\n');
  }

  estimateCost() {
    if (!this.provider.apiUrl || !this.stats.totalTokens) {
      return 0;
    }

    // OpenAI text-embedding-3-small pricing: $0.00002 per 1K tokens
    const costPer1K = 0.00002;
    return (this.stats.totalTokens / 1000) * costPer1K;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showResults() {
    console.log('✅ Generación de embeddings completada!\n');
    console.log('📊 Estadísticas:');
    console.log(`   📄 Documentos procesados: ${this.stats.totalDocuments}`);
    console.log(`   📦 Chunks generados: ${this.stats.totalChunks}`);
    console.log(`   🧮 Embeddings creados: ${this.stats.processedChunks}`);
    console.log(`   ❌ Chunks omitidos: ${this.stats.skippedChunks}`);
    console.log(`   📏 Dimensiones: ${this.provider.dimensions}`);
    console.log(`   🔤 Tokens procesados: ${this.stats.totalTokens.toLocaleString()}`);
    
    if (this.stats.totalTokens > 0) {
      console.log(`   💰 Costo estimado: $${this.estimateCost().toFixed(4)}`);
    }
    
    console.log(`   📁 Salida: ${CONFIG.embeddingsDir}`);

    if (this.stats.errors.length > 0) {
      console.log('\n⚠️  Errores encontrados:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.file || `Lote ${error.batch}`}: ${error.error}`);
      });
    }

    const successRate = Math.round((this.stats.processedChunks / this.stats.totalChunks) * 100);
    console.log(`\n📈 Tasa de éxito: ${successRate}%`);

    console.log('\n📝 Próximos pasos:');
    console.log('   1. Iniciar la aplicación: npm run dev');
    console.log('   2. Visitar: http://localhost:4321/chat');
    console.log('   3. ¡Comenzar a hacer consultas legales!\n');
  }
}

// Run the generator
const generator = new EmbeddingsGenerator();
generator.generate().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});