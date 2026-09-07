import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './config/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        surface: 'var(--color-card)',
        border: 'var(--color-border)',
        muted: 'var(--color-muted-foreground)'
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-heading)']
      }
    }
  },
  plugins: []
};

export default config;
