import React, { useState, useMemo } from 'react';

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: string;
  relatedTerms?: string[];
  legalSource?: string;
  examples?: string[];
}

const glossaryTerms: GlossaryTerm[] = [
  {
    id: 'amparo',
    term: 'Amparo',
    definition: 'Juicio constitucional que protege los derechos fundamentales de las personas contra actos de autoridad que los vulneren.',
    category: 'Constitucional',
    relatedTerms: ['Derechos Fundamentales', 'Suprema Corte'],
    legalSource: 'Ley de Amparo',
    examples: [
      'Amparo contra actos de autoridad administrativa',
      'Amparo contra leyes inconstitucionales'
    ]
  },
  {
    id: 'jurisprudencia',
    term: 'Jurisprudencia',
    definition: 'Interpretación de la ley que hacen los tribunales cuando se integra por cinco sentencias ejecutorias ininterrumpidas por otra en contrario.',
    category: 'Procesal',
    relatedTerms: ['Suprema Corte', 'Tesis'],
    legalSource: 'Ley de Amparo, Art. 217',
    examples: [
      'Jurisprudencia de la Suprema Corte',
      'Jurisprudencia de tribunales colegiados'
    ]
  },
  {
    id: 'persona-moral',
    term: 'Persona Moral',
    definition: 'Entidad jurídica distinta de las personas físicas, capaz de adquirir derechos y contraer obligaciones.',
    category: 'Civil',
    relatedTerms: ['Persona Física', 'Personalidad Jurídica'],
    legalSource: 'Código Civil Federal, Art. 25',
    examples: [
      'Sociedades mercantiles',
      'Asociaciones civiles',
      'Fundaciones'
    ]
  },
  {
    id: 'debido-proceso',
    term: 'Debido Proceso',
    definition: 'Derecho fundamental que garantiza que toda persona tenga acceso a un procedimiento justo, imparcial y con todas las garantías legales.',
    category: 'Constitucional',
    relatedTerms: ['Garantías Individuales', 'Defensa Adecuada'],
    legalSource: 'CPEUM, Art. 14 y 16',
    examples: [
      'Derecho a ser oído en juicio',
      'Derecho a defensa técnica',
      'Presunción de inocencia'
    ]
  },
  {
    id: 'contrato-trabajo',
    term: 'Contrato de Trabajo',
    definition: 'Acuerdo en virtud del cual una persona se obliga a prestar a otra un trabajo personal subordinado, mediante el pago de un salario.',
    category: 'Laboral',
    relatedTerms: ['Relación Laboral', 'Subordinación'],
    legalSource: 'Ley Federal del Trabajo, Art. 20',
    examples: [
      'Contrato por tiempo determinado',
      'Contrato por tiempo indeterminado',
      'Contrato por obra determinada'
    ]
  },
  {
    id: 'delito',
    term: 'Delito',
    definition: 'Acto u omisión que sancionan las leyes penales, que debe ser típico, antijurídico y culpable.',
    category: 'Penal',
    relatedTerms: ['Tipo Penal', 'Culpabilidad', 'Antijuridicidad'],
    legalSource: 'Código Penal Federal, Art. 7',
    examples: [
      'Delitos dolosos',
      'Delitos culposos',
      'Delitos de resultado'
    ]
  },
  {
    id: 'obligacion-tributaria',
    term: 'Obligación Tributaria',
    definition: 'Vínculo jurídico en virtud del cual el sujeto pasivo debe dar al Estado una suma de dinero en concepto de tributo.',
    category: 'Fiscal',
    relatedTerms: ['Contribuyente', 'Hecho Imponible'],
    legalSource: 'Código Fiscal de la Federación, Art. 1',
    examples: [
      'Impuestos directos',
      'Impuestos indirectos',
      'Contribuciones especiales'
    ]
  },
  {
    id: 'sociedad-mercantil',
    term: 'Sociedad Mercantil',
    definition: 'Persona moral constituida de acuerdo con la Ley General de Sociedades Mercantiles, con fin lucrativo.',
    category: 'Mercantil',
    relatedTerms: ['Persona Moral', 'Capital Social'],
    legalSource: 'Ley General de Sociedades Mercantiles',
    examples: [
      'Sociedad Anónima',
      'Sociedad de Responsabilidad Limitada',
      'Sociedad en Comandita Simple'
    ]
  }
];

const categories = [
  'Todos',
  'Constitucional',
  'Civil',
  'Penal',
  'Laboral',
  'Fiscal',
  'Mercantil',
  'Procesal'
];

export default function LegalGlossary() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);

  const filteredTerms = useMemo(() => {
    return glossaryTerms.filter(term => {
      const matchesSearch = term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           term.definition.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || term.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'Constitucional': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      'Civil': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
      'Penal': 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200',
      'Laboral': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      'Fiscal': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      'Mercantil': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
      'Procesal': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
    };
    return colorMap[category] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
  };

  return (
    <div className="legal-glossary">
      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar términos legales..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-10 pr-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Términos encontrados: {filteredTerms.length}
          </h3>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('Todos');
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid gap-4">
          {filteredTerms.map((term) => (
            <div
              key={term.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {term.term}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(term.category)}`}>
                    {term.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTerm(selectedTerm?.id === term.id ? null : term)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${
                      selectedTerm?.id === term.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-3">
                {term.definition}
              </p>

              {term.legalSource && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <strong>Fuente legal:</strong> {term.legalSource}
                </p>
              )}

              {selectedTerm?.id === term.id && (
                <div className="mt-4 space-y-4 animate-fadeIn border-t border-gray-200 dark:border-gray-600 pt-4">
                  {term.examples && term.examples.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Ejemplos:
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {term.examples.map((example, index) => (
                          <li key={index}>{example}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {term.relatedTerms && term.relatedTerms.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Términos relacionados:
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {term.relatedTerms.map((relatedTerm, index) => (
                          <button
                            key={index}
                            onClick={() => setSearchTerm(relatedTerm)}
                            className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            {relatedTerm}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTerms.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No se encontraron términos que coincidan con tu búsqueda.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('Todos');
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver todos los términos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}