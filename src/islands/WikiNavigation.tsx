import React, { useState, useEffect } from 'react';

interface WikiSection {
  id: string;
  title: string;
  icon: string;
  description: string;
}

const wikiSections: WikiSection[] = [
  {
    id: 'gobierno',
    title: 'Estructura del Gobierno',
    icon: '🏛️',
    description: 'División de poderes y niveles de gobierno'
  },
  {
    id: 'sistema-legal',
    title: 'Sistema Legal',
    icon: '⚖️',
    description: 'Jerarquía de leyes y procesos'
  },
  {
    id: 'areas-derecho',
    title: 'Áreas del Derecho',
    icon: '📚',
    description: 'Principales ramas jurídicas'
  },
  {
    id: 'recursos',
    title: 'Recursos Educativos',
    icon: '🎓',
    description: 'Guías, glosarios y herramientas'
  }
];

export default function WikiNavigation() {
  const [activeSection, setActiveSection] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

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

  return (
    <div className="wiki-navigation">
      {/* Mobile Menu Button */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-full flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md"
        >
          <span className="font-medium text-gray-900 dark:text-white">
            Navegación de Secciones
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

      {/* Navigation Cards */}
      <div className={`grid md:grid-cols-2 lg:grid-cols-4 gap-4 ${isMenuOpen ? 'block' : 'hidden lg:grid'}`}>
        {wikiSections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`wiki-nav-card ${
              activeSection === section.id
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 shadow-lg'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
            } p-4 rounded-lg border-2 transition-all duration-200 text-left`}
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{section.icon}</span>
              <div>
                <h3 className={`font-semibold text-sm mb-1 ${
                  activeSection === section.id
                    ? 'text-blue-800 dark:text-blue-200'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {section.title}
                </h3>
                <p className={`text-xs ${
                  activeSection === section.id
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
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
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {activeSection ? `Sección ${wikiSections.findIndex(s => s.id === activeSection) + 1} de ${wikiSections.length}` : 'Navegación de secciones'}
        </span>
      </div>
    </div>
  );
}