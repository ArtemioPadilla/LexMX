import React, { useState, useEffect } from 'react';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
// import { TEST_IDS } from '../utils/test-ids';
import { useTranslation } from '../i18n/index';

interface WikiSection {
  id: string;
  title: string;
  icon: string;
  description: string;
}

export default function WikiNavigation() {
  const { t } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Define sections with translations - organized for citizen understanding
  const wikiSections: WikiSection[] = [
    {
      id: 'introduccion',
      title: t('wiki.navigation.sections.introduction.title'),
      icon: '📖',
      description: t('wiki.navigation.sections.introduction.description')
    },
    {
      id: 'estructura-gobierno',
      title: t('wiki.navigation.sections.government.title'),
      icon: '🏛️',
      description: t('wiki.navigation.sections.government.description')
    },
    {
      id: 'sistema-legal',
      title: t('wiki.navigation.sections.legal.title'),
      icon: '⚖️',
      description: t('wiki.navigation.sections.legal.description')
    },
    {
      id: 'proceso-legislativo',
      title: t('wiki.navigation.sections.legislative.title'),
      icon: '📜',
      description: t('wiki.navigation.sections.legislative.description')
    },
    {
      id: 'areas-derecho',
      title: t('wiki.navigation.sections.areas.title'),
      icon: '📚',
      description: t('wiki.navigation.sections.areas.description')
    },
    {
      id: 'glosario',
      title: t('wiki.navigation.sections.glossary.title'),
      icon: '📝',
      description: t('wiki.navigation.sections.glossary.description')
    },
    {
      id: 'recursos',
      title: t('wiki.navigation.sections.resources.title'),
      icon: '🎓',
      description: t('wiki.navigation.sections.resources.description')
    },
    {
      id: 'faq',
      title: t('wiki.navigation.sections.faq.title'),
      icon: '❓',
      description: t('wiki.navigation.sections.faq.description')
    }
  ];

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Small delay to ensure proper initial state
    const initTimer = setTimeout(() => {
      setHasInitialized(true);
    }, 100);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasInitialized) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '-80px 0px -80px 0px'
      }
    );

    wikiSections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      clearTimeout(initTimer);
      observer.disconnect();
    };
  }, [hasInitialized]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.WikiNavigation />} 
        testId="wiki-navigation"
      />
    );
  }

  return (
    <div
      data-testid="wiki-navigation" className="wiki-navigation">
      {/* Mobile Menu Button */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-full flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md"
        >
          <span className="font-medium text-gray-900 dark:text-white">
            {t('wiki.navigation.mobileMenuTitle')}
          </span>
          <svg
            className={`w-5 h-5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation Cards - Changed to single column for sidebar */}
      <div className={`grid grid-cols-1 gap-2 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
        {wikiSections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`wiki-nav-card ${
              activeSection === section.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                : 'bg-white dark:bg-gray-800 border-l-4 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
            } px-3 py-2 rounded-r-lg transition-all duration-200 text-left w-full`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg flex-shrink-0">{section.icon}</span>
              <div className="min-w-0 flex-1">
                <h3 className={`font-medium text-sm leading-tight ${
                  activeSection === section.id
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {section.title}
                </h3>
                <p className={`text-xs leading-tight mt-0.5 ${
                  activeSection === section.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                } break-words`}>
                  {section.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Progress Indicator */}
      <div className="mt-6 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
          style={{
            width: activeSection ? `${((wikiSections.findIndex(s => s.id === activeSection) + 1) / wikiSections.length) * 100}%` : '0%'
          }}
        />
      </div>

      {/* Section Counter */}
      <div className="mt-2 text-center">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {activeSection 
            ? t('wiki.navigation.sectionCounter', { 
                current: wikiSections.findIndex(s => s.id === activeSection) + 1, 
                total: wikiSections.length 
              })
            : t('wiki.navigation.defaultText')}
        </span>
      </div>
    </div>
  );
}