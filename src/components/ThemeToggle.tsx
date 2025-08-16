import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { HydrationBoundary, LoadingStates } from './HydrationBoundary';
// import { TEST_IDS } from '../utils/test-ids';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>('system');
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Apply theme to document
  const applyTheme = useCallback((themeValue: Theme) => {
    // Only access browser APIs on client
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const root = document.documentElement;
      let actualTheme = themeValue;
      
      if (themeValue === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      if (actualTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);
  
  // Initialize theme on mount
  useEffect(() => {
    try {
      setIsHydrated(true);
      
      // Only access browser APIs on client
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // Get theme from localStorage
        const stored = localStorage.getItem('theme');
        if (stored) {
          try {
            const savedTheme = JSON.parse(stored) as Theme;
            setTheme(savedTheme);
            applyTheme(savedTheme);
          } catch (e) {
            console.error('Error parsing theme:', e);
            localStorage.setItem('theme', JSON.stringify('system'));
            applyTheme('system');
          }
        } else {
          localStorage.setItem('theme', JSON.stringify('system'));
          applyTheme('system');
        }
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = (_e: MediaQueryListEvent) => {
          const currentTheme = localStorage.getItem('theme');
          if (currentTheme && JSON.parse(currentTheme) === 'system') {
            applyTheme('system');
          }
        };
        
        mediaQuery.addEventListener('change', handleSystemThemeChange);
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
      }
    } catch (err) {
      console.error('Error initializing theme:', err);
      setError('Failed to initialize theme');
    }
  }, [applyTheme]);
  
  // Handle theme change
  const handleThemeChange = useCallback((newTheme: Theme) => {
    try {
      setTheme(newTheme);
      setIsOpen(false);
      
      // Only access browser APIs on client
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // Save to localStorage
        localStorage.setItem('theme', JSON.stringify(newTheme));
      }
      
      // Apply theme
      applyTheme(newTheme);
    } catch (error) {
      console.error('Error changing theme:', error);
    }
  }, [applyTheme]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.theme-toggle')) {
          setIsOpen(false);
        }
      };
      
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);
  
  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('theme.light'), icon: '☀️' },
    { value: 'dark', label: t('theme.dark'), icon: '🌙' },
    { value: 'system', label: t('theme.system'), icon: '💻' },
  ];
  
  const currentTheme = themes.find(t => t.value === theme) || themes[2];
  
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.ThemeToggle />}
        testId="theme-toggle"
      />
    );
  }
  
  if (error) {
    return (
      <div className="relative theme-toggle">
        <button 
          className="p-2 rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700" 
          aria-label={t('theme.error')}
          disabled
        >
          <span className="text-xl">⚠️</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="relative theme-toggle">
      <button
        data-testid="theme-toggle"
        onClick={(_e) => {
          _e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
        aria-label={t('theme.changeTheme')}
        aria-expanded={isOpen}
      >
        <span className="text-xl">{currentTheme.icon}</span>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {themes.map((t) => (
            <button
              key={t.value}
              data-testid={`theme-option-${t.value}`}
              onClick={(_e) => {
                _e.stopPropagation();
                handleThemeChange(t.value);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2 ${
                theme === t.value ? 'text-legal-600 dark:text-legal-400' : 'text-gray-700 dark:text-gray-300'
              } ${t.value === 'light' ? 'rounded-t-lg' : t.value === 'system' ? 'rounded-b-lg' : ''}`}
            >
              <span>{t.icon}</span>
              <span className="text-sm">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}