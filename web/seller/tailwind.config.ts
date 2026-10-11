import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './config/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  // Dark mode is an explicit Seller state, never the OS preference: the shell
  // writes data-theme on <html> (see SellerShell) and :root[data-theme='dark']
  // in app/styles/globals.css. Binding the `dark:` variants to that attribute
  // keeps every surface following Seller's selected theme.
  darkMode: ['selector', '[data-theme="dark"]'],
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
