const colors = require('tailwindcss/colors');

module.exports = {
  // eslint-disable-next-line prettier/prettier
  content: [
    './src/renderer/**/*.{js,jsx,ts,tsx,ejs}',
    './src/components/**/*.{js,jsx,ts,tsx,ejs}',
    './src/main/**/*.{js,jsx,ts,tsx,ejs}',
  ],
  safelist: [
    'text-ground-1',
    'text-ground-2',
    'text-ground-3',
    'text-ground-4',
  ],
  theme: {
    extend: {
      colors: {
        sky: colors.sky,
        cyan: colors.cyan,
        ground: {
          1: '#EF8334',
          2: '#9A8BA6',
          3: '#798AED',
          4: '#8EDFE8',
        },
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
