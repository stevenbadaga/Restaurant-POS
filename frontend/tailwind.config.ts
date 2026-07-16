import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf2f0',
          100: '#f9e0da',
          200: '#f2c0b6',
          300: '#e9988a',
          400: '#df6f5b',
          500: '#c94a32',
          600: '#a83c28',
          700: '#8a2f1f',
          800: '#73271a',
          900: '#602219',
        },
        gold: {
          50: '#fef9e7',
          100: '#fdf0c4',
          200: '#fce08d',
          300: '#f9cb4e',
          400: '#f5b722',
          500: '#d4941a',
          600: '#b07515',
          700: '#8c5712',
          800: '#744612',
          900: '#633b14',
        },
        surface: {
          50: '#faf8f6',
          100: '#f5f2ee',
          200: '#ebe5de',
          300: '#dcd3c8',
          400: '#c9bcaa',
          500: '#b8a690',
          600: '#a89178',
          700: '#917b65',
          800: '#786555',
          900: '#635349',
        },
        charcoal: {
          50: '#f5f5f5',
          100: '#e6e6e6',
          200: '#cccccc',
          300: '#a3a3a3',
          400: '#808080',
          500: '#666666',
          600: '#4d4d4d',
          700: '#333333',
          800: '#1f1f1f',
          900: '#141414',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
