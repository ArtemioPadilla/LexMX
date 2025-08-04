import React, { useEffect, useState, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

type Theme = 'light' | 'dark' | 'system';

function ThemeToggleInner() {
  const [theme, setTheme] = useState<Theme>('system');
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Apply theme to document
  const applyTheme = useCallback((themeValue: Theme) => {
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
  }, []);
  
  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    
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
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const currentTheme = localStorage.getItem('theme');
      if (currentTheme && JSON.parse(currentTheme) === 'system') {
        applyTheme('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [applyTheme]);
  
  // Handle theme change
  const handleThemeChange = useCallback((newTheme: Theme) => {
    try {
      setTheme(newTheme);
      setIsOpen(false);
      
      // Save to localStorage
      localStorage.setItem('theme', JSON.stringify(newTheme));
      
      // Apply theme
      applyTheme(newTheme);
    } catch (error) {
      console.error('Error changing theme:', error);
    }
  }, [applyTheme]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.theme-toggle')) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);
  
  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Claro', icon: '☀️' },
    { value: 'dark', label: 'Oscuro', icon: '🌙' },
    { value: 'system', label: 'Sistema', icon: '💻' },
  ];
  
  const currentTheme = themes.find(t => t.value === theme) || themes[2];
  
  if (!mounted) {
    return (
      <div className="relative theme-toggle">
        <button 
          className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600" 
          aria-label="Cambiar tema"
          disabled
        >
          <span className="text-xl">💻</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="relative theme-toggle">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
        aria-label="Cambiar tema"
        aria-expanded={isOpen}
      >
        <span className="text-xl">{currentTheme.icon}</span>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
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

export function ThemeToggle() {
  return (
    <ErrorBoundary componentName="ThemeToggle">
      <ThemeToggleInner />
    </ErrorBoundary>
  );
}