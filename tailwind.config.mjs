/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mexican flag colors adapted for legal theme
        legal: {
          50: '#f0fdf4',   // Light green
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',  // Main green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        },
        document: {
          50: '#fefefe',
          100: '#fdfdfd',
          200: '#f9f9f9',
          300: '#f5f5f5',
          400: '#f0f0f0',
          500: '#e5e5e5',  // Document background
          600: '#d4d4d4',
          700: '#a3a3a3',
          800: '#525252',
          900: '#404040',
          950: '#262626'
        },
        hierarchy: {
          1: '#dc2626',  // Red - Constitutional
          2: '#ea580c',  // Orange - Treaties
          3: '#d97706',  // Amber - Laws/Codes
          4: '#65a30d',  // Lime - Regulations
          5: '#0891b2',  // Cyan - Norms
          6: '#7c3aed',  // Purple - State Laws
          7: '#be185d'   // Pink - Administrative
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        legal: ['Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' }
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' }
        }
      }
    },
  },
  plugins: [
    // Note: These plugins would need to be installed separately
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography')
  ],
}