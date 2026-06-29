/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: { 50: '#F8F9FA', 100: '#F0F2F5', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#2C3E50', 900: '#1F2937', 950: '#111827' },
        brand: { 50: '#ECFDF5', 600: '#047857', 800: '#2C3E50' },
        female: { 50: '#fbeaf0', 800: '#72243e' },
        male: { 50: '#e6f1fb', 800: '#0c447c' },
        danger: { 50: '#FEF2F2', 700: '#DC2626' },
        success: { 50: '#ECFDF5', 800: '#16A34A' },
        warning: { 50: '#FFF7ED', 800: '#D97706' }
      }
    }
  },
  plugins: []
}
