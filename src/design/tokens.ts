/**
 * Shared Steadiifit design tokens.
 *
 * These tokens establish the visual foundation for V1 without changing product logic.
 * The app continues to use the existing theme system, while this file exposes a
 * semantic token layer that can evolve without scattering raw hex values.
 */

export const colors = {
  background: '#F7F6F3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#F2EFEA',
  border: '#E5E0D6',
  borderStrong: '#CABFA5',
  textPrimary: '#171611',
  textSecondary: '#584F48',
  textMuted: '#8B8279',
  textInverse: '#FFFFFF',
  accent: '#687B5F',
  accentSubtle: '#EEF3EC',
  success: '#2F6C4B',
  warning: '#B76A2C',
  error: '#B84745',
  info: '#45698F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  3: 32,
  4: 40,
  5: 48,
  6: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  full: 999,
} as const;

export const borders = {
  subtle: { borderWidth: 1, borderColor: colors.border },
  default: { borderWidth: 1, borderColor: colors.borderStrong },
  strong: { borderWidth: 1.5, borderColor: colors.borderStrong },
  focus: { borderWidth: 1.5, borderColor: colors.accent },
  error: { borderWidth: 1.5, borderColor: colors.error },
} as const;

export const shadows = {
  none: {},
  subtle: {
    shadowColor: '#171611',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  elevated: {
    shadowColor: '#171611',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modal: {
    shadowColor: '#171611',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

export const typography = {
  display: {
    fontFamily: 'BricolageExtraBold',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontWeight: '700',
  },
  largeMetric: {
    fontFamily: 'InterBold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.9,
    fontWeight: '700',
  },
  screenTitle: {
    fontFamily: 'BricolageExtraBold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontWeight: '700',
  },
  sectionTitle: {
    fontFamily: 'InterBold',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.12,
    fontWeight: '700',
  },
  cardTitle: {
    fontFamily: 'InterSemiBold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    fontWeight: '600',
  },
  bodyLarge: {
    fontFamily: 'InterRegular',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  body: {
    fontFamily: 'InterRegular',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  bodySmall: {
    fontFamily: 'InterRegular',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
  },
  caption: {
    fontFamily: 'InterMedium',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  label: {
    fontFamily: 'InterSemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    fontWeight: '600',
  },
} as const;

export const motion = {
  instant: 120,
  fast: 180,
  normal: 240,
  slow: 320,
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
} as const;

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;
