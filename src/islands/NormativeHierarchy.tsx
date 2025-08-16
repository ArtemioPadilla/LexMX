import React, { useState, useEffect } from 'react';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
import { useTranslation } from '../i18n/index';

interface HierarchyLevel {
  id: string;
  level: number;
  title: string;
  description: string;
  examples: string[];
  icon: string;
  color: string;
}

export default function NormativeHierarchy() {
  const { t } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const hierarchyLevels: HierarchyLevel[] = [
    {
      id: 'constitution',
      level: 1,
      title: t('wiki.legalSystem.hierarchy.item1'),
      description: t('wiki.normativeHierarchy.constitution.description'),
      examples: [
        t('wiki.normativeHierarchy.constitution.example1'),
        t('wiki.normativeHierarchy.constitution.example2')
      ],
      icon: '🏛️',
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'treaties',
      level: 2,
      title: t('wiki.legalSystem.hierarchy.item2'),
      description: t('wiki.normativeHierarchy.treaties.description'),
      examples: [
        t('wiki.normativeHierarchy.treaties.example1'),
        t('wiki.normativeHierarchy.treaties.example2')
      ],
      icon: '🌍',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'federal-laws',
      level: 3,
      title: t('wiki.legalSystem.hierarchy.item3'),
      description: t('wiki.normativeHierarchy.federalLaws.description'),
      examples: [
        t('wiki.normativeHierarchy.federalLaws.example1'),
        t('wiki.normativeHierarchy.federalLaws.example2')
      ],
      icon: '📚',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'state-constitutions',
      level: 4,
      title: t('wiki.legalSystem.hierarchy.item4'),
      description: t('wiki.normativeHierarchy.stateConstitutions.description'),
      examples: [
        t('wiki.normativeHierarchy.stateConstitutions.example1'),
        t('wiki.normativeHierarchy.stateConstitutions.example2')
      ],
      icon: '🏛️',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'state-laws',
      level: 5,
      title: t('wiki.legalSystem.hierarchy.item5'),
      description: t('wiki.normativeHierarchy.stateLaws.description'),
      examples: [
        t('wiki.normativeHierarchy.stateLaws.example1'),
        t('wiki.normativeHierarchy.stateLaws.example2')
      ],
      icon: '📖',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'regulations',
      level: 6,
      title: t('wiki.legalSystem.hierarchy.item6'),
      description: t('wiki.normativeHierarchy.regulations.description'),
      examples: [
        t('wiki.normativeHierarchy.regulations.example1'),
        t('wiki.normativeHierarchy.regulations.example2')
      ],
      icon: '📋',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      id: 'norms',
      level: 7,
      title: t('wiki.legalSystem.hierarchy.item7'),
      description: t('wiki.normativeHierarchy.norms.description'),
      examples: [
        t('wiki.normativeHierarchy.norms.example1'),
        t('wiki.normativeHierarchy.norms.example2')
      ],
      icon: '📏',
      color: 'from-gray-500 to-gray-600'
    }
  ];

  const toggleExpand = (levelId: string) => {
    setExpandedLevel(expandedLevel === levelId ? null : levelId);
  };

  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={
          <div className="space-y-4">
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg h-20 animate-pulse" />
            ))}
          </div>
        } 
        testId="normative-hierarchy"
      />
    );
  }

  return (
    <div className="normative-hierarchy space-y-4" data-testid="normative-hierarchy">
      {/* Visual Pyramid */}
      <div className="mb-8 hidden lg:block">
        <div className="relative mx-auto" style={{ maxWidth: '600px' }}>
          {hierarchyLevels.map((level, index) => {
            const width = 100 - (index * 12); // Pyramid shape
            return (
              <div
                key={level.id}
                className={`relative h-12 mb-1 rounded-lg bg-gradient-to-r ${level.color} flex items-center justify-center text-white font-medium text-sm cursor-pointer transform transition-all duration-200 hover:scale-105`}
                style={{ width: `${width}%`, margin: '0 auto' }}
                onMouseEnter={() => setHoveredLevel(level.id)}
                onMouseLeave={() => setHoveredLevel(null)}
                onClick={() => toggleExpand(level.id)}
              >
                <span className="mr-2">{level.icon}</span>
                <span className="hidden sm:inline">{level.title}</span>
                <span className="sm:hidden">{level.level}</span>
              </div>
            );
          })}
        </div>
        {hoveredLevel && (
          <div className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t('wiki.normativeHierarchy.clickToExpand')}
          </div>
        )}
      </div>

      {/* Interactive Cards */}
      <div className="space-y-4">
        {hierarchyLevels.map((level) => (
          <div
            key={level.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 ${
              expandedLevel === level.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <button
              onClick={() => toggleExpand(level.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${level.color} flex items-center justify-center text-white mr-4`}>
                  <span className="text-xl">{level.icon}</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t('wiki.normativeHierarchy.level')} {level.level}: {level.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {level.description}
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transform transition-transform ${
                  expandedLevel === level.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedLevel === level.id && (
              <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-700 animate-fadeIn">
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {t('wiki.normativeHierarchy.characteristics')}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                    {t(`wiki.normativeHierarchy.${level.id.replace('-', '')}.characteristics`)}
                  </p>
                  
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {t('wiki.normativeHierarchy.examples')}
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {level.examples.map((example, idx) => (
                      <li key={idx} className="text-gray-600 dark:text-gray-300 text-sm">
                        {example}
                      </li>
                    ))}
                  </ul>

                  {level.level > 1 && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>{t('wiki.normativeHierarchy.subordinationNote')}:</strong>{' '}
                        {t('wiki.normativeHierarchy.subordinationExplanation', { level: level.level - 1 })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
          {t('wiki.normativeHierarchy.principleTitle')}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('wiki.normativeHierarchy.principleDescription')}
        </p>
      </div>
    </div>
  );
}