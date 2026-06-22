/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: { 50: '#162a4a', 100: '#162a4a', 200: '#1e3a5f', 300: '#5a6b82', 400: '#8b8a85', 500: '#8b8a85', 600: '#b9b8b2', 700: '#e8e6df', 800: '#f2f0e9', 900: '#f8f7f2', 950: '#0a1628' },
        brand: { 50: '#162a4a', 600: '#0f6e56', 800: '#c9a84c' },
        female: { 50: '#fbeaf0', 800: '#72243e' },
        male: { 50: '#e6f1fb', 800: '#0c447c' },
        danger: { 50: '#450a0a', 700: '#fca5a5' },
        success: { 50: '#052e16', 800: '#86efac' },
        warning: { 50: '#422006', 800: '#fde047' }
      }
    }
  },
  plugins: []
}
