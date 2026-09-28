/**
 * Canonical design tokens for Steadiifit V1
 */

export const colors = {
  // Primary brand colors
  background: '#F4EDE3',
  backgroundElement: '#FAFAF6',
  surface: '#FFFFFF',
  surfaceSubtle: '#F2EFEA',
  surfaceElevated: '#FFFFFF',

  // Semantic colors
  ink: '#15140F',
  textPrimary: '#15140F',
  textSecondary: '#6E6D63',
  textMuted: '#8B8279',
  textInverse: '#FFFFFF',

  // Borders
  line: '#E7E4DA',
  border: '#E7E4DA',
  borderStrong: '#CABFA5',

  // Accents
  accent: '#8A5A2E',
  accentSubtle: '#F4EDE3',

  // Success
  success: '#3F7A4E',
  successSubtle: '#EAF3EC',

  // Warning
  warning: '#D49863',
  warningSubtle: '#FCE8D8',

  // Error
  error: '#C4423B',
  errorSubtle: '#FBEAE8',

  // Info
  info: '#45698F',
  infoSubtle: '#E3EEFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  base: 12,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  three: 32,
  four: 40,
  five: 48,
  six: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  bg: 14,
  base: 16,
  lg: 20,
  xl: 24,
  pill: 999,
  full: 999,
} as const;

export const borders = {
  subtle: { borderWidth: 1, borderColor: colors.border },
  default: { borderWidth: 1.5, borderColor: colors.borderStrong },
  strong: { borderWidth: 2, borderColor: colors.borderStrong },
  focus: { borderWidth: 1.5, borderColor: colors.accent },
  error: { borderWidth: 1.5, borderColor: colors.error },
} as const;

export const shadows = {
  none: {},
  subtle: {
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  elevated: {
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modal: {
    shadowColor: colors.ink,
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
    fontWeight: '700' as const,
  },
  largeMetric: {
    fontFamily: 'InterBold',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
  },
  screenTitle: {
    fontFamily: 'BricolageExtraBold',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
  },
  sectionTitle: {
    fontFamily: 'InterBold',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700' as const,
  },
  cardTitle: {
    fontFamily: 'InterSemiBold',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: 'InterRegular',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400' as const,
  },
  bodyLarge: {
    fontFamily: 'InterRegular',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontFamily: 'InterRegular',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  label: {
    fontFamily: 'InterSemiBold',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
  },
  caption: {
    fontFamily: 'InterRegular',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500' as const,
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
