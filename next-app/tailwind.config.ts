import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        saffron: { DEFAULT: '#F97316', deep: '#EA580C', dark: '#C2410C' },
        cream: '#FDF8F0',
      },
    },
  },
  plugins: [],
};

export default config;
