const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');
const clayNeutral = {
  50: '#f5f9fc',
  100: '#edf3f7',
  200: '#dce7ee',
  300: '#bdced8',
  400: '#929995',
  500: '#626975',
  600: '#525a66',
  700: '#434b58',
  800: '#343b49',
  900: '#252d39',
  950: '#171d26',
};

module.exports = {
  // eslint-disable-next-line prettier/prettier
  content: [
    './src/renderer/**/*.{js,jsx,ts,tsx,ejs}',
    './src/autouma/**/*.{js,jsx,ts,tsx,ejs}',
    './src/main/**/*.{js,jsx,ts,tsx,ejs}',
  ],
  safelist: [
    'text-ground-1',
    'text-ground-2',
    'text-ground-3',
    'text-ground-4',
  ],
  theme: {
    fontFamily: {
      sans: ['var(--uma-font-sans)'],
      mono: ['var(--uma-font-mono)'],
    },
    extend: {
      // Bridge existing bg-white panels to the shared material, including /opacity.
      // Text, icons and borders named white keep their original contrast color.
      backgroundColor: {
        white: 'rgb(var(--uma-clay-surface-rgb, 255 255 255) / <alpha-value>)',
      },
      borderRadius: { md: '10px', lg: '14px', xl: '20px', '2xl': '24px' },
      transitionProperty: {
        ui: 'color, background-color, border-color, box-shadow, opacity, transform',
      },
      transitionDuration: {
        DEFAULT: 'var(--uma-motion-fast, 160ms)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--uma-ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
      },
      fontSize: {
        caption: ['var(--uma-type-caption)', { lineHeight: '1.5' }],
        label: ['var(--uma-type-label)', { lineHeight: '1.5' }],
        data: ['var(--uma-type-data)', { lineHeight: '1.5' }],
        body: ['var(--uma-type-body)', { lineHeight: '1.65' }],
        section: ['var(--uma-type-section)', { lineHeight: '1.4' }],
        title: ['var(--uma-type-title)', { lineHeight: '1.35' }],
        display: ['var(--uma-type-display)', { lineHeight: '1.2' }],
      },
      colors: {
        slate: clayNeutral,
        gray: clayNeutral,
        indigo: {
          50: '#f1faed',
          100: '#e6f7df',
          200: '#bdebb1',
          300: '#93db89',
          400: '#64c864',
          500: '#348b43',
          600: '#24783d',
          700: '#1d6033',
          800: '#1b4c2e',
          900: '#193f28',
          950: '#0c2416',
        },
        sky: colors.sky,
        cyan: colors.cyan,
        surface: '#5DC714',
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
  plugins: [
    plugin(({ addVariant }) => {
      addVariant(
        'fine-hover',
        '@media (hover: hover) and (pointer: fine) { &:hover }',
      );
    }),
  ],
};
