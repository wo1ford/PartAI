import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/**
 * Кастомный preset PrimeVue — бренд-палитра (мятно-бирюзовая) из reference/*.png.
 * Подключается в main.ts.
 */
export const AppTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0faf7',
      100: '#dcf1ec',
      200: '#b9e4d9',
      300: '#7fd7c6',
      400: '#4fc9b0',
      500: '#2fbfa4',
      600: '#1fa98f',
      700: '#1a8c77',
      800: '#176f60',
      900: '#155b50',
      950: '#0a342e',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        highlight: {
          background: '{primary.100}',
          focusBackground: '{primary.200}',
          color: '{primary.700}',
          focusColor: '{primary.700}',
        },
      },
    },
  },
})
