import { isWeb } from '@tamagui/core';
import { defaultConfig } from '@tamagui/config/v5';
import { animations } from '@tamagui/config/v5-reanimated';
import { createInterFont } from '@tamagui/font-inter';
import { createTamagui } from 'tamagui';

/** PostScript / `useFonts` key — must match `app/_layout.tsx`. */
const instrumentFamily = 'InstrumentSans';

const instrumentFace = {
  100: { normal: instrumentFamily },
  200: { normal: instrumentFamily },
  300: { normal: instrumentFamily },
  400: { normal: instrumentFamily },
  500: { normal: instrumentFamily },
  600: { normal: instrumentFamily },
  700: { normal: instrumentFamily },
  800: { normal: instrumentFamily },
  900: { normal: instrumentFamily },
} as const;

const instrumentFamilyStack = isWeb
  ? `${instrumentFamily}, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  : instrumentFamily;

const bodyFont = createInterFont(
  {
    family: instrumentFamilyStack,
    face: instrumentFace,
    weight: {
      1: '400',
    },
  },
  {
    sizeSize: (size) => Math.round(size),
    sizeLineHeight: (size) => Math.round(size * 1.1 + (size >= 12 ? 8 : 4)),
  },
);

const headingFont = createInterFont(
  {
    family: instrumentFamilyStack,
    face: instrumentFace,
    weight: {
      0: '600',
      6: '700',
      9: '800',
    },
  },
  {
    sizeSize: (size) => Math.round(size),
    sizeLineHeight: (size) => Math.round(size * 1.2),
  },
);

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    body: bodyFont,
    heading: headingFont,
  },
  animations,
});

export default tamaguiConfig;

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation
  interface TamaguiCustomConfig extends Conf {}
}
