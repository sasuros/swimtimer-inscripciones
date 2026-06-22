/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#e1f5ee', 600: '#0f6e56', 800: '#085041' },
        female: { 50: '#fbeaf0', 800: '#72243e' },
        male: { 50: '#e6f1fb', 800: '#0c447c' },
        danger: { 50: '#fcebeb', 700: '#a32d2d' },
        success: { 50: '#eaf3de', 800: '#27500a' }
      }
    }
  },
  plugins: []
}
