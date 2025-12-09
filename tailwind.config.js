const colors = require('tailwindcss/colors');

module.exports = {
  // eslint-disable-next-line prettier/prettier
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,ejs}', './src/components/**/*.{js,jsx,ts,tsx,ejs}', './src/main/**/*.{js,jsx,ts,tsx,ejs}'],

  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        sky: colors.sky,
        cyan: colors.cyan,
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
