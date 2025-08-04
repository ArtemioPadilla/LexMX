// This script runs immediately to prevent flash of unstyled content
(function() {
  const stored = localStorage.getItem('theme');
  const theme = stored ? JSON.parse(stored) : 'system';
  
  let actualTheme: 'light' | 'dark';
  
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    actualTheme = theme;
  }
  
  if (actualTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();