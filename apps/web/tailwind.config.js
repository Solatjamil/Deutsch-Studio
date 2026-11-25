/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eef7f3',100:'#d7ebe1',200:'#b2d7c4',300:'#82bda1',400:'#529c7c',500:'#347e61',600:'#1f6f5c',700:'#19594b',800:'#16483e',900:'#123b34' },
        sand: { 50:'#fbf8f1',100:'#f5ecd9',200:'#ebd6a9',300:'#e0bd77',400:'#d69e44',500:'#c9872c' },
        ink: { 50:'#f6f7f6',100:'#eceeee',500:'#66736f',700:'#37443f',900:'#16221e' },
      },
      fontFamily: { sans: ['Inter','ui-sans-serif','system-ui','-apple-system','Segoe UI','sans-serif'] },
      boxShadow: { soft: '0 8px 30px -12px rgba(16,42,38,.18)' },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
