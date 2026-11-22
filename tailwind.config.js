/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1024',
        panel: '#121a35',
        electric: '#7c9cff',
        lime: '#b9ef70',
        ember: '#ffb672',
      },
      boxShadow: {
        glow: '0 0 40px rgba(124,156,255,.18)',
      },
    },
  },
  plugins: [],
}
