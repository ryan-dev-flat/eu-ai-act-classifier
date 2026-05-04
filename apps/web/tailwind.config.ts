import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        risk: {
          prohibited: '#7f1d1d',
          high: '#b91c1c',
          limited: '#b45309',
          minimal: '#15803d',
          gpai: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
