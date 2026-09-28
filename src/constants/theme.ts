/**
 * Steadiifit theme constants (backward compatibility layer)
 */

import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#15140F',
    background: '#FFFFFF',
    backgroundElement: '#FAFAF6',
    backgroundSelected: '#F4EDE3',
    textSecondary: '#6E6D63',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const SteadiifitColors = {
  background: '#FFFFFF',
  ink: '#15140F',
  muted: '#6E6D63',
  line: '#E7E4DA',
  accent: '#8A5A2E',
  wash: '#F4EDE3',
  surface: '#FAFAF6',
  green: '#3F7A4E',
  greenWash: '#EAF3EC',
  success: '#3F7A4E',
  warning: '#D49863',
  error: '#C4423B',
} as const;

export type BrandColorKey =
  | 'background'
  | 'ink'
  | 'muted'
  | 'line'
  | 'accent'
  | 'wash'
  | 'surface'
  | 'green'
  | 'greenWash'
  | 'success'
  | 'warning'
  | 'error';

export const BrandColors = SteadiifitColors;
export const ThemeColors = SteadiifitColors;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
