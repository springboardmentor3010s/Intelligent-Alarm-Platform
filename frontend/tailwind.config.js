const c = (n) => `rgb(var(--c-${n}) / <alpha-value>)`
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), surface2: c('surface2'), line: c('line'), ink: c('ink'), mute: c('mute'),
        brand: c('brand'), brandfg: c('brandfg'), accent: c('accent'), ok: c('ok'), bad: c('bad'), warn: c('warn'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--c-shadow) / 0.06), 0 8px 24px -12px rgb(var(--c-shadow) / 0.18)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.25), 0 12px 40px -12px rgb(var(--c-brand) / 0.55)',
      },
      keyframes: {
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-10px)' }, '40%,80%': { transform: 'translateX(10px)' } },
        ring: { '0%,100%': { transform: 'rotate(0)' }, '10%,30%,50%,70%': { transform: 'rotate(-14deg)' }, '20%,40%,60%,80%': { transform: 'rotate(14deg)' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        shake: 'shake .45s ease-in-out', ring: 'ring 1.2s ease-in-out infinite',
        pulseRing: 'pulseRing 1.8s ease-out infinite', floaty: 'floaty 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
