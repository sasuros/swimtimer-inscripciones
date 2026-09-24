/** @type {import('tailwindcss').Config} */
export default {
  // Solo por atributo, nunca por la preferencia del sistema: lo pone index.html en /admin.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: { 50: '#F8F9FA', 100: '#F0F2F5', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#2C3E50', 900: '#1F2937', 950: '#111827' },
        brand: { 50: '#ECFDF5', 600: '#047857', 800: '#2C3E50', bg: 'rgb(var(--brand-bg) / <alpha-value>)', fg: 'rgb(var(--brand-fg) / <alpha-value>)' },
        female: { 50: '#fbeaf0', 800: '#72243e' },
        male: { 50: '#e6f1fb', 800: '#0c447c' },
        danger: { 50: '#FEF2F2', 700: '#DC2626', bg: 'rgb(var(--danger-bg) / <alpha-value>)', fg: 'rgb(var(--danger-fg) / <alpha-value>)', solid: 'rgb(var(--danger-solid) / <alpha-value>)' },
        success: { 50: '#ECFDF5', 800: '#16A34A', bg: 'rgb(var(--success-bg) / <alpha-value>)', fg: 'rgb(var(--success-fg) / <alpha-value>)', solid: 'rgb(var(--success-solid) / <alpha-value>)' },
        warning: { 50: '#FFF7ED', 800: '#D97706', bg: 'rgb(var(--warning-bg) / <alpha-value>)', fg: 'rgb(var(--warning-fg) / <alpha-value>)', solid: 'rgb(var(--warning-solid) / <alpha-value>)' },
        caution: { 50: '#FFF7ED', 700: '#B45309' },
        manage: { 50: '#EFF6FF', 700: '#1D4ED8' },
        // Tokens semánticos (v1.15.0): claro = valores de antes; oscuro solo en /admin.
        app: 'rgb(var(--app) / <alpha-value>)',
        surface: { DEFAULT: 'rgb(var(--surface) / <alpha-value>)', muted: 'rgb(var(--surface-muted) / <alpha-value>)', alt: 'rgb(var(--surface-alt) / <alpha-value>)', strong: 'rgb(var(--surface-strong) / <alpha-value>)' },
        ink: { DEFAULT: 'rgb(var(--ink) / <alpha-value>)', strong: 'rgb(var(--ink-strong) / <alpha-value>)', soft: 'rgb(var(--ink-soft) / <alpha-value>)', muted: 'rgb(var(--ink-muted) / <alpha-value>)', subtle: 'rgb(var(--ink-subtle) / <alpha-value>)' },
        line: { DEFAULT: 'rgb(var(--line) / <alpha-value>)', soft: 'rgb(var(--line-soft) / <alpha-value>)', strong: 'rgb(var(--line-strong) / <alpha-value>)' },
        overlay: 'rgb(var(--overlay) / <alpha-value>)',
        control: { DEFAULT: 'rgb(var(--control) / <alpha-value>)', hover: 'rgb(var(--control-hover) / <alpha-value>)' },
        info: { solid: 'rgb(var(--info-solid) / <alpha-value>)' }
      }
    }
  },
  plugins: []
}
