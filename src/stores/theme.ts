import { computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';

export type Theme = 'light' | 'dark' | 'system';

// Store theme preference in localStorage
export const themePreference = persistentAtom<Theme>('theme', 'system', {
  encode: JSON.stringify,
  decode: JSON.parse,
});

// Get system theme
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Actual theme (resolved from preference)
export const actualTheme = computed(themePreference, (pref) => {
  if (pref === 'system') {
    return getSystemTheme();
  }
  return pref;
});

// Apply theme to document
export function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Initialize theme
export function initTheme() {
  const theme = actualTheme.get();
  applyTheme(theme);
  
  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (themePreference.get() === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
  
  // Listen for theme preference changes
  themePreference.subscribe((pref) => {
    const theme = pref === 'system' ? getSystemTheme() : pref;
    applyTheme(theme);
  });
}

// Change theme
export function changeTheme(theme: Theme) {
  themePreference.set(theme);
}

// Toggle between light and dark
export function toggleTheme() {
  const current = actualTheme.get();
  changeTheme(current === 'light' ? 'dark' : 'light');
}