/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05060a', 900: '#0a0c14', 800: '#11141f', 700: '#1a1e2e' },
        glow: { DEFAULT: '#7c5cff', cyan: '#22d3ee', rose: '#fb7185', lime: '#a3e635' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
