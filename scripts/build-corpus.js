#!/usr/bin/env node

/**
 * Build script for Mexican legal corpus processing
 * 
 * This script processes raw legal documents and converts them into
 * a structured format suitable for RAG ingestion.
 * 
 * Usage: npm run build:corpus
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../data/raw-legal-docs'),
  outputDir: path.join(__dirname, '../public/legal-corpus'),
  tempDir: path.join(__dirname, '../temp'),
  metadataFile: path.join(__dirname, '../public/legal-corpus/metadata.json'),
  maxFileSize: 10 * 1024 * 1024, // 10MB limit per file
  supportedFormats: ['.txt', '.md', '.json', '.xml']
};

// Legal document hierarchy mapping
const HIERARCHY_MAP = {
  'constitucion': 1,
  'ley-organica': 2,
  'codigo': 3,
  'ley': 4,
  'reglamento': 5,
  'decreto': 6,
  'nom': 7,
  'acuerdo': 7
};

// Legal areas mapping
const LEGAL_AREAS = {
  'constitucional': 'constitutional',
  'civil': 'civil',
  'penal': 'criminal',
  'laboral': 'labor',
  'fiscal': 'tax',
  'mercantil': 'commercial',
  'administrativo': 'administrative',
  'familiar': 'family',
  'propiedad': 'property'
};

class CorpusBuilder {
  constructor() {
    this.processedDocuments = [];
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      totalSize: 0,
      errors: []
    };
  }

  async build() {
    console.log('🏗️  Iniciando construcción del corpus legal mexicano...\n');

    try {
      // Create necessary directories
      await this.createDirectories();

      // Process legal documents
      await this.processLegalDocuments();

      // Generate metadata
      await this.generateMetadata();

      // Generate index
      await this.generateIndex();

      // Cleanup
      await this.cleanup();

      // Show results
      this.showResults();

    } catch (error) {
      console.error('❌ Error durante la construcción del corpus:', error);
      process.exit(1);
    }
  }

  async createDirectories() {
    console.log('📁 Creando directorios...');
    
    const dirs = [CONFIG.outputDir, CONFIG.tempDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`   ✓ ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
    console.log('');
  }

  async processLegalDocuments() {
    console.log('📚 Procesando documentos legales...');

    // Check if source directory exists
    try {
      await fs.access(CONFIG.sourceDir);
    } catch (error) {
      console.log('   ⚠️  Directorio fuente no encontrado, creando documentos de ejemplo...');
      await this.createSampleDocuments();
    }

    const files = await this.getAllFiles(CONFIG.sourceDir);
    this.stats.totalFiles = files.length;

    console.log(`   📄 Encontrados ${files.length} archivos\n`);

    for (const filePath of files) {
      try {
        await this.processFile(filePath);
        this.stats.processedFiles++;
      } catch (error) {
        this.stats.skippedFiles++;
        this.stats.errors.push({ file: filePath, error: error.message });
        console.log(`   ❌ Error procesando ${path.basename(filePath)}: ${error.message}`);
      }
    }
  }

  async getAllFiles(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.getAllFiles(fullPath));
        } else if (this.isSupportedFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  No se pudo leer directorio ${dir}: ${error.message}`);
    }
    
    return files;
  }

  isSupportedFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return CONFIG.supportedFormats.includes(ext);
  }

  async processFile(filePath) {
    const fileName = path.basename(filePath);
    const stats = await fs.stat(filePath);
    
    // Check file size
    if (stats.size > CONFIG.maxFileSize) {
      throw new Error(`Archivo demasiado grande (${this.formatBytes(stats.size)})`);
    }

    console.log(`   📖 Procesando: ${fileName}`);

    const content = await fs.readFile(filePath, 'utf-8');
    const metadata = this.extractMetadata(filePath, content);
    
    const document = {
      id: this.generateDocumentId(filePath),
      title: metadata.title || fileName,
      type: metadata.type || 'documento',
      primaryArea: metadata.primaryArea || 'general',
      hierarchy: metadata.hierarchy || 7,
      source: fileName,
      lastUpdated: new Date().toISOString(),
      content: [{
        id: `${this.generateDocumentId(filePath)}_content`,
        type: 'text',
        title: metadata.title || fileName,
        content: this.cleanContent(content)
      }]
    };

    // Save processed document
    const outputPath = path.join(CONFIG.outputDir, `${document.id}.json`);
    await fs.writeFile(outputPath, JSON.stringify(document, null, 2), 'utf-8');
    
    this.processedDocuments.push({
      id: document.id,
      title: document.title,
      type: document.type,
      primaryArea: document.primaryArea,
      hierarchy: document.hierarchy,
      source: fileName,
      size: stats.size,
      lastUpdated: document.lastUpdated
    });

    this.stats.totalSize += stats.size;
  }

  extractMetadata(filePath, content) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const metadata = {};

    // Extract title from first line or filename
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 200 && !firstLine.includes('.')) {
        metadata.title = firstLine;
      }
    }

    if (!metadata.title) {
      metadata.title = fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Detect document type from filename or content
    const lowerFileName = fileName.toLowerCase();
    const lowerContent = content.toLowerCase();

    // Detect hierarchy
    for (const [type, hierarchy] of Object.entries(HIERARCHY_MAP)) {
      if (lowerFileName.includes(type) || lowerContent.includes(type)) {
        metadata.type = type;
        metadata.hierarchy = hierarchy;
        break;
      }
    }

    // Detect legal area
    for (const [area, areaCode] of Object.entries(LEGAL_AREAS)) {
      if (lowerFileName.includes(area) || lowerContent.includes(area)) {
        metadata.primaryArea = areaCode;
        break;
      }
    }

    return metadata;
  }

  cleanContent(content) {
    // Remove excessive whitespace and normalize
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  generateDocumentId(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async generateMetadata() {
    console.log('\n📋 Generando metadata del corpus...');

    const metadata = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      totalDocuments: this.processedDocuments.length,
      totalSize: this.stats.totalSize,
      legalAreas: this.getLegalAreaStats(),
      documentTypes: this.getDocumentTypeStats(),
      hierarchyDistribution: this.getHierarchyStats(),
      documents: this.processedDocuments
    };

    await fs.writeFile(CONFIG.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`   ✓ Metadata guardada en ${CONFIG.metadataFile}`);
  }

  getLegalAreaStats() {
    const stats = {};
    for (const doc of this.processedDocuments) {
      stats[doc.primaryArea] = (stats[doc.primaryArea] || 0) + 1;
    }
    return stats;
  }

  getDocumentTypeStats() {
    const stats = {};
    for (const doc of this.processedDocuments) {
      stats[doc.type] = (stats[doc.type] || 0) + 1;
    }
    return stats;
  }

  getHierarchyStats() {
    const stats = {};
    for (const doc of this.processedDocuments) {
      stats[doc.hierarchy] = (stats[doc.hierarchy] || 0) + 1;
    }
    return stats;
  }

  async generateIndex() {
    console.log('📇 Generando índice de documentos...');

    const index = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      documents: this.processedDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        primaryArea: doc.primaryArea,
        hierarchy: doc.hierarchy,
        url: `/legal-corpus/${doc.id}.json`
      }))
    };

    const indexPath = path.join(CONFIG.outputDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`   ✓ Índice guardado en ${indexPath}`);
  }

  async createSampleDocuments() {
    console.log('   📄 Creando documentos de ejemplo...');
    
    await fs.mkdir(CONFIG.sourceDir, { recursive: true });

    const sampleDocs = [
      {
        filename: 'constitucion-politica-mexico.txt',
        content: `CONSTITUCIÓN POLÍTICA DE LOS ESTADOS UNIDOS MEXICANOS

TÍTULO PRIMERO
CAPÍTULO I
DE LOS DERECHOS HUMANOS Y SUS GARANTÍAS

Artículo 1o. En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos reconocidos en esta Constitución y en los tratados internacionales de los que el Estado Mexicano sea parte, así como de las garantías para su protección, cuyo ejercicio no podrá restringirse ni suspenderse, salvo en los casos y bajo las condiciones que esta Constitución establece.

Las normas relativas a los derechos humanos se interpretarán de conformidad con esta Constitución y con los tratados internacionales de la materia favoreciendo en todo tiempo a las personas la protección más amplia.

Todas las autoridades, en el ámbito de sus competencias, tienen la obligación de promover, respetar, proteger y garantizar los derechos humanos de conformidad con los principios de universalidad, interdependencia, indivisibilidad y progresividad.

Artículo 2o. La Nación Mexicana es única e indivisible. La Nación tiene una composición pluricultural sustentada originalmente en sus pueblos indígenas que son aquellos que descienden de poblaciones que habitaban en el territorio actual del país al iniciarse la colonización y que conservan sus propias instituciones sociales, económicas, culturales y políticas, o parte de ellas.

Artículo 3o. Toda persona tiene derecho a la educación. El Estado -Federación, Estados, Ciudad de México y Municipios- impartirá y garantizará la educación inicial, preescolar, primaria, secundaria, media superior y superior.`
      },
      {
        filename: 'codigo-civil-federal.txt',
        content: `CÓDIGO CIVIL FEDERAL

LIBRO PRIMERO
DE LAS PERSONAS

TÍTULO PRIMERO
DE LAS PERSONAS FÍSICAS

CAPÍTULO I
DE LA PERSONALIDAD Y CAPACIDAD

Artículo 22. La capacidad jurídica de las personas físicas se adquiere por el nacimiento y se pierde por la muerte; pero desde el momento en que un individuo es concebido, entra bajo la protección de la ley y se le tiene por nacido para los efectos declarados en el presente Código.

Artículo 23. La minoría de edad, el estado de interdicción y demás incapacidades establecidas por la ley, son restricciones a la personalidad jurídica que no deben menoscabar la dignidad de la persona ni atentar contra la integridad de la familia; pero los incapaces pueden ejercitar sus derechos o contraer obligaciones por medio de sus representantes.

CAPÍTULO II
DEL NOMBRE

Artículo 58. El acta de nacimiento se levantará con asistencia de dos testigos. Contendrá el día, la hora y el lugar del nacimiento, el sexo del presentado, el nombre y apellidos que le correspondan.

TÍTULO SEGUNDO
DE LAS PERSONAS MORALES

Artículo 25. Son personas morales:
I. La Nación, los Estados, los Municipios, las Demarcaciones Territoriales de la Ciudad de México y los demás organismos que específicamente reconozcan otras leyes;
II. Las asociaciones religiosas organizadas con arreglo a la ley de la materia;
III. Las instituciones de asistencia privada, con arreglo a la ley de la materia;
IV. Las sociedades civiles o mercantiles;
V. Los sindicatos, las asociaciones profesionales y las demás a que se refiere la fracción XVI del artículo 123 de la Constitución Federal;
VI. Las sociedades cooperativas y mutualistas, y
VII. Las asociaciones distintas de las enumeradas que se propongan fines políticos, científicos, artísticos, de recreo o cualquiera otro fin lícito, siempre que no fueren desconocidas por la ley.`
      },
      {
        filename: 'ley-federal-trabajo.txt',
        content: `LEY FEDERAL DEL TRABAJO

TÍTULO PRIMERO
PRINCIPIOS GENERALES

Artículo 1o. La presente Ley es de observancia general en toda la República y rige las relaciones de trabajo comprendidas en el artículo 123, Apartado A, de la Constitución.

Artículo 2o. Las normas del trabajo tienden a conseguir el equilibrio entre los factores de la producción y la justicia social, así como propiciar el trabajo digno o decente en todas las relaciones laborales.

Se entiende por trabajo digno o decente aquel en el que se respeta plenamente la dignidad humana del trabajador; no existe discriminación por origen étnico o nacional, género, edad, discapacidad, condición social, condiciones de salud, religión, condición migratoria, opiniones, preferencias sexuales o estado civil; se tiene acceso a la seguridad social y se percibe un salario remunerador; se recibe capacitación continua para el incremento de la productividad con beneficios compartidos, y se cuenta con condiciones óptimas de seguridad e higiene para prevenir riesgos de trabajo.

Artículo 3o. El trabajo es un derecho y un deber social. No es artículo de comercio, exige respeto para las libertades y dignidad de quien lo presta y debe efectuarse en condiciones que aseguren la vida, la salud y un nivel económico decoroso para el trabajador y su familia.

No podrán establecerse distinciones entre los trabajadores por motivo de raza, sexo, edad, credo religioso, doctrina política o condición social.

TÍTULO SEGUNDO
RELACIONES INDIVIDUALES DE TRABAJO

CAPÍTULO I
DISPOSICIONES GENERALES

Artículo 20. Se entiende por relación de trabajo, cualquiera que sea el acto que le dé origen, la prestación de un trabajo personal subordinado a una persona, mediante el pago de un salario.

Contrato individual de trabajo, cualquiera que sea su forma o denominación, es aquel por virtud del cual una persona se obliga a prestar a otra un trabajo personal subordinado, mediante el pago de un salario.`
      }
    ];

    for (const doc of sampleDocs) {
      const filePath = path.join(CONFIG.sourceDir, doc.filename);
      await fs.writeFile(filePath, doc.content, 'utf-8');
      console.log(`     ✓ ${doc.filename}`);
    }
  }

  async cleanup() {
    console.log('\n🧹 Limpiando archivos temporales...');
    try {
      await fs.rm(CONFIG.tempDir, { recursive: true, force: true });
      console.log('   ✓ Archivos temporales eliminados');
    } catch (error) {
      console.log('   ⚠️  No se pudieron eliminar todos los archivos temporales');
    }
  }

  showResults() {
    console.log('\n✅ Construcción del corpus completada!\n');
    console.log('📊 Estadísticas:');
    console.log(`   📄 Archivos procesados: ${this.stats.processedFiles}/${this.stats.totalFiles}`);
    console.log(`   📄 Archivos omitidos: ${this.stats.skippedFiles}`);
    console.log(`   💾 Tamaño total: ${this.formatBytes(this.stats.totalSize)}`);
    console.log(`   📁 Salida: ${CONFIG.outputDir}`);

    if (this.stats.errors.length > 0) {
      console.log('\n⚠️  Errores encontrados:');
      this.stats.errors.forEach(error => {
        console.log(`   • ${path.basename(error.file)}: ${error.error}`);
      });
    }

    console.log('\n📝 Próximos pasos:');
    console.log('   1. Ejecutar: npm run build:embeddings');
    console.log('   2. Iniciar la aplicación: npm run dev');
    console.log('   3. Visitar: http://localhost:4321/chat\n');
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Run the builder
const builder = new CorpusBuilder();
builder.build().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});