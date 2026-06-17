/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        cockpit: {
          900: '#0A1018',
          800: '#0F1923',
          700: '#1A2735',
          600: '#1E3044',
          500: '#2A3F55',
          400: '#3A5570',
          300: '#5A7A95',
          200: '#8A9BB0',
          100: '#C0CEDB',
          50: '#E8ECF0',
        },
        amber: {
          DEFAULT: '#F59E0B',
          dark: '#D97706',
          light: '#FBBF24',
        },
        cyan: {
          DEFAULT: '#06B6D4',
          dark: '#0891B2',
          light: '#22D3EE',
        },
        risk: {
          critical: '#EF4444',
          warning: '#F97316',
          caution: '#EAB308',
          normal: '#22C55E',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
