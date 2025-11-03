/* eslint-disable @typescript-eslint/no-var-requires */
const defaultTheme = require('tailwindcss/defaultTheme');

const cyberGray = {
  50: '#f8f9fb',
  100: '#eef1f8',
  200: '#cdd4e5',
  300: '#a2abc8',
  400: '#7d86a7',
  500: '#58607f',
  600: '#3d455f',
  700: '#2a3146',
  800: '#15182e',
  900: '#05060f',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../shared/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: cyberGray,
        teal: {
          300: '#ff7ad6',
          400: '#ff53c4',
          500: '#ff2daf',
          600: '#e2189b',
          700: '#b80e7c',
        },
        cyan: {
          300: '#7fe6ff',
          400: '#64dcff',
          500: '#4dd0ff',
          600: '#33bfff',
          700: '#1ba7ff',
        },
        'cyber-blue': '#4dd0ff',
        'cyber-pink': '#ff2d95',
        'cyber-surface': '#0f0f1a',
        'cyber-border': '#1d1d2f',
        primary: {
          50: '#ffe9f7',
          100: '#ffc6eb',
          200: '#ff9bde',
          300: '#ff6fd0',
          400: '#ff44c3',
          500: '#ff2daf',
          600: '#e2189b',
          700: '#b80e7c',
          800: '#8c0b5f',
          900: '#5e0440',
        },
      },
      boxShadow: {
        'glow-pink': '0 0 12px rgba(255, 45, 149, 0.45), 0 0 32px rgba(255, 45, 149, 0.25)',
        'glow-blue': '0 0 12px rgba(77, 208, 255, 0.45), 0 0 32px rgba(77, 208, 255, 0.25)',
      },
      dropShadow: {
        'glow-pink': ['0 0 12px rgba(255, 45, 149, 0.55)'],
        'glow-blue': ['0 0 12px rgba(77, 208, 255, 0.55)'],
      },
      fontFamily: {
        cyber: [
          '"Fira Code"',
          '"JetBrains Mono"',
          '"Cascadia Code"',
          ...defaultTheme.fontFamily.mono,
        ],
      },
    },
  },
  plugins: [],
};
