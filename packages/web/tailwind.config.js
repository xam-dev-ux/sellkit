/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0052FF',
        baseDark: '#003ACC',
        success: '#00C48C',
        warn: '#F59E0B',
        danger: '#EF4444',
        surface: '#F9FAFB',
        border: '#E5E7EB',
        ink: '#111827',
        muted: '#6B7280',
      },
      fontFamily: {
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        data: ['Space Grotesk', 'monospace'],
      },
      maxWidth: {
        miniapp: '390px',
      },
    },
  },
  plugins: [],
}
