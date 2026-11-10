/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed', // Primary brand purple
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        secondary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa', // Secondary soft blue
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Clean white SaaS surfaces & text hierarchy mapped to existing utility classes
        dark: {
          50: '#0f172a',  // Deepest text contrast
          100: '#111827', // Primary heading & text (Gray-900)
          200: '#1f2937', // Subheadings (Gray-800)
          300: '#374151', // Secondary text (Gray-700)
          400: '#64748b', // Muted text & icons (Slate-500)
          500: '#94a3b8', // Subtle muted / placeholders (Slate-400)
          600: '#cbd5e1', // Strong borders (Slate-300)
          700: '#e2e8f0', // Borders & dividers (Slate-200)
          800: '#f8fafc', // Soft light surface / card headers / zebra rows (Slate-50)
          900: '#ffffff', // Card & panel backgrounds (Pure White)
          950: '#ffffff', // Canvas background (Pure White)
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        danger: {
          50: '#fff1f2',
          100: '#ffe4e6',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        'glow-purple': '0 0 20px -3px rgba(124, 58, 237, 0.15)',
      },
    },
  },
  plugins: [],
};
