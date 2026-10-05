/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          50: '#eef4ff',
          100: '#dbe6fd',
          200: '#bfd3fc',
          300: '#93b4fa',
          400: '#608df7',
          500: '#3b66f0',
          600: '#1d4ed8',
          700: '#173fae',
          800: '#18378c',
          900: '#18315b',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.06)',
        lift: '0 2px 4px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
