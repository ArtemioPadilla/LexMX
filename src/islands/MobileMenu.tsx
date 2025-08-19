import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS as _TEST_IDS } from '../utils/test-ids';
import { useTranslation } from '../i18n/index';
import { getUrl } from '../utils/urls';

interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

export default function MobileMenu() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    // Close menu when clicking outside
    if (isOpen && mounted) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.mobile-menu-container')) {
          setIsOpen(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };

      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, mounted]);

  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.MobileMenu />} 
        testId="mobile-menu"
      />
    );
  }

  if (!mounted) {
    return (
      <div data-testid="mobile-menu" className="lg:hidden">
        <button
          className="text-gray-600 hover:text-gray-900 focus:outline-none focus:text-gray-900 p-2"
          aria-label="Open main menu"
          disabled
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    );
  }

  const navItems: NavItem[] = [
    { href: getUrl('chat'), label: t('nav.chat'), icon: '💬' },
    { href: getUrl('casos'), label: t('nav.cases') || 'Mis Casos', icon: '📁' },
    { href: getUrl('wiki'), label: t('nav.wiki'), icon: '📚' },
    { href: getUrl('legal'), label: t('nav.codes'), icon: '⚖️' },
    { href: getUrl('requests'), label: t('nav.requests'), icon: '📋' },
    { href: getUrl('setup'), label: t('nav.setup'), icon: '⚙️' },
    { href: getUrl('about'), label: t('nav.about'), icon: 'ℹ️' },
  ];

  return (
    <>
      {/* Menu Button */}
      <div className="lg:hidden mobile-menu-container relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="relative flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
          aria-label={isOpen ? t('nav.closeMenu') || 'Cerrar menú' : t('nav.openMenu') || 'Abrir menú principal'}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay - Rendered via Portal */}
      {mounted && isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[99998] lg:hidden"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel with isolation */}
          <div className={`fixed inset-y-0 right-0 z-[99999] w-[280px] sm:w-[320px] isolate lg:hidden transform transition-transform duration-300 ease-in-out transform-gpu will-change-transform ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            {/* Solid Background Layer */}
            <div className="absolute inset-0 bg-white dark:bg-gray-900 opacity-100" />
            
            {/* Content Layer */}
            <div className="relative h-full bg-white dark:bg-gray-900 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('nav.menu') || 'Menú'}
              </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-legal-500 rounded-md"
                  aria-label={t('nav.closeMenu') || 'Cerrar menú'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Navigation */}
              <nav className="px-4 py-6 overflow-y-auto max-h-[calc(100vh-80px)] bg-white dark:bg-gray-900">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-legal-600 dark:hover:text-legal-400 rounded-lg transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.icon && <span className="text-xl">{item.icon}</span>}
                      <span className="font-medium">{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>

              {/* Additional Actions */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-4">
                      {t('nav.quickActions') || 'Acciones Rápidas'}
                    </h3>
                    <div className="space-y-2">
                      <a
                        href={getUrl('chat')}
                        className="flex items-center space-x-3 px-4 py-3 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                        </svg>
                        <span className="font-medium">{t('home.hero.cta') || 'Iniciar Consulta Gratis'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Resources */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-4">
                      {t('nav.resources') || 'Recursos'}
                    </h3>
                    <ul className="space-y-2">
                      <li>
                        <a
                          href={getUrl('privacy')}
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-legal-600 dark:hover:text-legal-400"
                          onClick={() => setIsOpen(false)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>{t('privacy.title') || 'Política de Privacidad'}</span>
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://github.com/ArtemioPadilla/LexMX"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-legal-600 dark:hover:text-legal-400"
                          onClick={() => setIsOpen(false)}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <span>GitHub</span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </nav>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}