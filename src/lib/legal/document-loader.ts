// Legal document loader
import type { LegalDocument } from '../../types/legal';

// Mock legal documents for now
const MOCK_DOCUMENTS: Record<string, LegalDocument> = {
  'cpeum': {
    id: 'cpeum',
    title: 'Constitución Política de los Estados Unidos Mexicanos',
    shortTitle: 'CPEUM',
    type: 'constitution',
    jurisdiction: 'federal',
    status: 'vigente',
    hierarchy: 1,
    lastReform: '2024-01-15',
    publicationDate: '1917-02-05',
    effectiveDate: '1917-05-01',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
    metadata: {
      source: 'Cámara de Diputados',
      lastUpdated: '2024-01-15',
      version: '2024.1',
      reforms: 256
    },
    content: [
      {
        id: 'cpeum-title-1',
        type: 'title',
        number: 'I',
        title: 'De los Derechos Humanos y sus Garantías',
        content: '',
        parent: null
      },
      {
        id: 'cpeum-chapter-1',
        type: 'chapter',
        number: 'I',
        title: 'De los Derechos Humanos y sus Garantías',
        content: '',
        parent: 'cpeum-title-1'
      },
      {
        id: 'cpeum-art-1',
        type: 'article',
        number: '1',
        title: '',
        content: 'En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos reconocidos en esta Constitución y en los tratados internacionales de los que el Estado Mexicano sea parte, así como de las garantías para su protección, cuyo ejercicio no podrá restringirse ni suspenderse, salvo en los casos y bajo las condiciones que esta Constitución establece.',
        parent: 'cpeum-chapter-1'
      },
      {
        id: 'cpeum-art-1-p2',
        type: 'paragraph',
        number: null,
        title: '',
        content: 'Las normas relativas a los derechos humanos se interpretarán de conformidad con esta Constitución y con los tratados internacionales de la materia favoreciendo en todo tiempo a las personas la protección más amplia.',
        parent: 'cpeum-art-1'
      },
      {
        id: 'cpeum-art-1-p3',
        type: 'paragraph',
        number: null,
        title: '',
        content: 'Todas las autoridades, en el ámbito de sus competencias, tienen la obligación de promover, respetar, proteger y garantizar los derechos humanos de conformidad con los principios de universalidad, interdependencia, indivisibilidad y progresividad. En consecuencia, el Estado deberá prevenir, investigar, sancionar y reparar las violaciones a los derechos humanos, en los términos que establezca la ley.',
        parent: 'cpeum-art-1'
      },
      {
        id: 'cpeum-art-2',
        type: 'article',
        number: '2',
        title: '',
        content: 'La Nación Mexicana es única e indivisible.',
        parent: 'cpeum-chapter-1'
      },
      {
        id: 'cpeum-art-3',
        type: 'article',
        number: '3',
        title: '',
        content: 'Toda persona tiene derecho a la educación. El Estado —Federación, Estados, Ciudad de México y Municipios— impartirá y garantizará la educación inicial, preescolar, primaria, secundaria, media superior y superior.',
        parent: 'cpeum-chapter-1'
      },
      {
        id: 'cpeum-art-4',
        type: 'article',
        number: '4',
        title: '',
        content: 'La mujer y el hombre son iguales ante la ley. Ésta protegerá la organización y el desarrollo de la familia.',
        parent: 'cpeum-chapter-1'
      },
      {
        id: 'cpeum-art-5',
        type: 'article',
        number: '5',
        title: '',
        content: 'A ninguna persona podrá impedirse que se dedique a la profesión, industria, comercio o trabajo que le acomode, siendo lícitos. El ejercicio de esta libertad sólo podrá vedarse por determinación judicial, cuando se ataquen los derechos de tercero, o por resolución gubernativa, dictada en los términos que marque la ley, cuando se ofendan los derechos de la sociedad.',
        parent: 'cpeum-chapter-1'
      }
    ]
  },
  'lft': {
    id: 'lft',
    title: 'Ley Federal del Trabajo',
    shortTitle: 'LFT',
    type: 'law',
    jurisdiction: 'federal',
    status: 'vigente',
    hierarchy: 3,
    lastReform: '2023-12-29',
    publicationDate: '1970-04-01',
    effectiveDate: '1970-05-01',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
    metadata: {
      source: 'Cámara de Diputados',
      lastUpdated: '2023-12-29',
      version: '2023.12',
      reforms: 48
    },
    content: [
      {
        id: 'lft-title-1',
        type: 'title',
        number: 'Primero',
        title: 'Principios Generales',
        content: '',
        parent: null
      },
      {
        id: 'lft-art-1',
        type: 'article',
        number: '1',
        title: '',
        content: 'La presente Ley es de observancia general en toda la República y rige las relaciones de trabajo comprendidas en el artículo 123, Apartado A, de la Constitución.',
        parent: 'lft-title-1'
      },
      {
        id: 'lft-art-2',
        type: 'article',
        number: '2',
        title: '',
        content: 'Las normas del trabajo tienden a conseguir el equilibrio entre los factores de la producción y la justicia social, así como propiciar el trabajo digno o decente en todas las relaciones laborales.',
        parent: 'lft-title-1'
      },
      {
        id: 'lft-art-3',
        type: 'article',
        number: '3',
        title: '',
        content: 'El trabajo es un derecho y un deber social. No es artículo de comercio, y exige respeto para las libertades y dignidad de quien lo presta, así como el reconocimiento a las diferencias entre hombres y mujeres para obtener su igualdad ante la ley.',
        parent: 'lft-title-1'
      }
    ]
  },
  'codigo-civil-federal': {
    id: 'codigo-civil-federal',
    title: 'Código Civil Federal',
    shortTitle: 'CCF',
    type: 'code',
    jurisdiction: 'federal',
    status: 'vigente',
    hierarchy: 3,
    lastReform: '2024-01-11',
    publicationDate: '1928-08-30',
    effectiveDate: '1932-09-01',
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf',
    metadata: {
      source: 'Cámara de Diputados',
      lastUpdated: '2024-01-11',
      version: '2024.1',
      reforms: 89
    },
    content: [
      {
        id: 'ccf-preliminary',
        type: 'title',
        number: 'Preliminar',
        title: 'Disposiciones Preliminares',
        content: '',
        parent: null
      },
      {
        id: 'ccf-art-1',
        type: 'article',
        number: '1',
        title: '',
        content: 'Las disposiciones de este Código regirán en toda la República en asuntos del orden federal.',
        parent: 'ccf-preliminary'
      },
      {
        id: 'ccf-art-2',
        type: 'article',
        number: '2',
        title: '',
        content: 'La capacidad jurídica es igual para el hombre y la mujer; en consecuencia, la mujer no queda sometida, por razón de su sexo, a restricción alguna en la adquisición y ejercicio de sus derechos civiles.',
        parent: 'ccf-preliminary'
      }
    ]
  }
};

export class DocumentLoader {
  static async loadDocument(documentId: string): Promise<LegalDocument | null> {
    // In a real implementation, this would load from a database or API
    // For now, return mock data
    return MOCK_DOCUMENTS[documentId] || null;
  }

  static async searchDocuments(query: string): Promise<LegalDocument[]> {
    // Simple search implementation
    const results: LegalDocument[] = [];
    const queryLower = query.toLowerCase();

    for (const doc of Object.values(MOCK_DOCUMENTS)) {
      if (doc.title.toLowerCase().includes(queryLower) ||
          doc.shortTitle?.toLowerCase().includes(queryLower)) {
        results.push(doc);
      }
    }

    return results;
  }

  static async getDocumentsByType(type: string): Promise<LegalDocument[]> {
    return Object.values(MOCK_DOCUMENTS).filter(doc => doc.type === type);
  }

  static async getDocumentsByJurisdiction(jurisdiction: string): Promise<LegalDocument[]> {
    return Object.values(MOCK_DOCUMENTS).filter(doc => doc.jurisdiction === jurisdiction);
  }

  static async getAllDocuments(): Promise<LegalDocument[]> {
    return Object.values(MOCK_DOCUMENTS);
  }
}

export default DocumentLoader;