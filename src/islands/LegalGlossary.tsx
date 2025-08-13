import React, { useState, useMemo, useEffect } from 'react';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS } from '../utils/test-ids';
import { useTranslation } from '../i18n/index';

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: string;
  relatedTerms?: string[];
  legalSource?: string;
  examples?: string[];
}

const glossaryTerms = (t: any): GlossaryTerm[] => [
  {
    id: 'amparo',
    term: t('wiki.glossary.terms.amparo.term'),
    definition: t('wiki.glossary.terms.amparo.definition'),
    category: t('wiki.glossary.categories.constitutional'),
    relatedTerms: ['Derechos Fundamentales', 'Suprema Corte'],
    legalSource: 'Ley de Amparo',
    examples: [
      'Amparo contra actos de autoridad administrativa',
      'Amparo contra leyes inconstitucionales'
    ]
  },
  {
    id: 'jurisprudencia',
    term: t('wiki.glossary.terms.jurisprudencia.term'),
    definition: t('wiki.glossary.terms.jurisprudencia.definition'),
    category: t('wiki.glossary.categories.procedural'),
    relatedTerms: ['Suprema Corte', 'Tesis'],
    legalSource: 'Ley de Amparo, Art. 217',
    examples: [
      'Jurisprudencia de la Suprema Corte',
      'Jurisprudencia de tribunales colegiados'
    ]
  },
  {
    id: 'persona-moral',
    term: t('wiki.glossary.terms.personaMoral.term'),
    definition: t('wiki.glossary.terms.personaMoral.definition'),
    category: t('wiki.glossary.categories.civil'),
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
    term: t('wiki.glossary.terms.debidoProceso.term'),
    definition: t('wiki.glossary.terms.debidoProceso.definition'),
    category: t('wiki.glossary.categories.constitutional'),
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
    term: t('wiki.glossary.terms.contratoTrabajo.term'),
    definition: t('wiki.glossary.terms.contratoTrabajo.definition'),
    category: t('wiki.glossary.categories.labor'),
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
    term: t('wiki.glossary.terms.delito.term'),
    definition: t('wiki.glossary.terms.delito.definition'),
    category: t('wiki.glossary.categories.criminal'),
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
    term: t('wiki.glossary.terms.obligacionTributaria.term'),
    definition: t('wiki.glossary.terms.obligacionTributaria.definition'),
    category: t('wiki.glossary.categories.tax'),
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
    term: t('wiki.glossary.terms.sociedadMercantil.term'),
    definition: t('wiki.glossary.terms.sociedadMercantil.definition'),
    category: t('wiki.glossary.categories.commercial'),
    relatedTerms: ['Persona Moral', 'Capital Social'],
    legalSource: 'Ley General de Sociedades Mercantiles',
    examples: [
      'Sociedad Anónima',
      'Sociedad de Responsabilidad Limitada',
      'Sociedad en Comandita Simple'
    ]
  }
];

const categories = (t: any) => [
  t('wiki.glossary.categories.all'),
  t('wiki.glossary.categories.constitutional'),
  t('wiki.glossary.categories.civil'),
  t('wiki.glossary.categories.criminal'),
  t('wiki.glossary.categories.labor'),
  t('wiki.glossary.categories.tax'),
  t('wiki.glossary.categories.commercial'),
  t('wiki.glossary.categories.procedural')
];

export default function LegalGlossary() {
  const { t } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);

  const terms = useMemo(() => glossaryTerms(t), [t]);
  const categoryList = useMemo(() => categories(t), [t]);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
    setSelectedCategory(categoryList[0]); // Set to "All" after hydration
  }, [categoryList]);

  const filteredTerms = useMemo(() => {
    return terms.filter(term => {
      const matchesSearch = term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           term.definition.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === categoryList[0] || term.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, terms, categoryList]);

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
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.LegalGlossary />} 
        testId="legal-glossary"
      />
    );
  }

  return (
    <div
      data-testid="legal-glossary" className="legal-glossary">
      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder={t('wiki.glossary.searchPlaceholder')}
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
          {categoryList.map((category) => (
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
            {t('wiki.glossary.termsFound')}: {filteredTerms.length}
          </h3>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory(categoryList[0]);
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('wiki.glossary.clearFilters')}
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
                  <strong>{t('wiki.glossary.legalSource')}:</strong> {term.legalSource}
                </p>
              )}

              {selectedTerm?.id === term.id && (
                <div className="mt-4 space-y-4 animate-fadeIn border-t border-gray-200 dark:border-gray-600 pt-4">
                  {term.examples && term.examples.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {t('wiki.glossary.examples')}:
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
                        {t('wiki.glossary.relatedTerms')}:
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
              {t('wiki.glossary.noTermsFound')}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory(categoryList[0]);
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('wiki.glossary.viewAllTerms')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}