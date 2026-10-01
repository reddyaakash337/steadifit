import React, { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../tokens';

export type Variant = 'default' | 'muted' | 'accent' | 'danger';

// Layout
export function Screen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Stack({ children, style, gap = 0 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; gap?: number }>) {
  return <View style={[styles.stack, { gap }, style]}>{children}</View>;
}

export function Row({ children, style, align = 'center', justify = 'flex-start', gap = 0 }: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  align?: 'flex-start' | 'center' | 'flex-end';
  justify?: 'flex-start' | 'center' | 'space-between' | 'space-around' | 'flex-end';
  gap?: number;
}>) {
  return <View style={[styles.row, { alignItems: align, justifyContent: justify, gap }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

// Typography
export function DisplayText({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[typography.display, styles.textPrimary, style]}>{children}</Text>;
}

export function ScreenTitle({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[typography.screenTitle, styles.textPrimary, style]}>{children}</Text>;
}

export function SectionTitle({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[typography.sectionTitle, styles.textPrimary, style]}>{children}</Text>;
}

export function BodyText({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[typography.body, styles.textSecondary, style]}>{children}</Text>;
}

export function Caption({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[typography.caption, styles.textMuted, style]}>{children}</Text>;
}

export function MetricText({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[typography.largeMetric, styles.textPrimary, style]}>{children}</Text>;
}

// Surfaces
export function Surface({ children, style, elevated = false }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; elevated?: boolean }>) {
  return <View style={[styles.surface, elevated && styles.surfaceElevated, style]}>{children}</View>;
}

export function Card({ children, style, elevated = false, onPress }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; elevated?: boolean; onPress?: () => void }>) {
  const body = <View style={[styles.card, elevated && styles.surfaceElevated, style]}>{children}</View>;

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

// Buttons
export function PrimaryButton({ children, onPress, disabled = false, loading = false, accessibilityLabel }: PropsWithChildren<{ onPress?: () => void; disabled?: boolean; loading?: boolean; accessibilityLabel?: string }>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.primaryButton, (disabled || loading) && styles.buttonDisabled, pressed && !disabled && !loading && styles.buttonPressed]}
    >
      <Text style={[styles.buttonText, styles.primaryButtonText]}>{loading ? 'Loading…' : children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ children, onPress, disabled = false, loading = false, accessibilityLabel }: PropsWithChildren<{ onPress?: () => void; disabled?: boolean; loading?: boolean; accessibilityLabel?: string }>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.secondaryButton, (disabled || loading) && styles.buttonDisabled, pressed && !disabled && !loading && styles.buttonPressed]}
    >
      <Text style={[styles.buttonText, styles.secondaryButtonText]}>{loading ? 'Loading…' : children}</Text>
    </Pressable>
  );
}

export function GhostButton({ children, onPress, disabled = false, accessibilityLabel }: PropsWithChildren<{ onPress?: () => void; disabled?: boolean; accessibilityLabel?: string }>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.ghostButton, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
    >
      <Text style={[styles.buttonText, styles.ghostButtonText]}>{children}</Text>
    </Pressable>
  );
}

export function IconButton({ children, onPress, accessibilityLabel, disabled = false }: PropsWithChildren<{ onPress?: () => void; accessibilityLabel: string; disabled?: boolean }>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
    >
      <Text style={styles.iconButtonText}>{children}</Text>
    </Pressable>
  );
}

export function DestructiveButton({ children, onPress, disabled = false }: PropsWithChildren<{ onPress?: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.destructiveButton, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
    >
      <Text style={[styles.buttonText, styles.destructiveButtonText]}>{children}</Text>
    </Pressable>
  );
}

// Metrics
export function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: Variant }) {
  return (
    <View style={[styles.metric, tone === 'accent' && styles.metricAccent, tone === 'danger' && styles.metricDanger]}>
      <Text style={[typography.bodySmall, styles.textMuted]}>{label}</Text>
      <Text style={[typography.largeMetric, styles.textPrimary]}>{value}</Text>
    </View>
  );
}

export function ProgressBar({ value, max = 100, color = colors.accent }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min(100, (value / max) * 100);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
    </View>
  );
}

export function ProgressRing({ value, max = 100, size = 56, color = colors.accent }: { value: number; max?: number; size?: number; color?: string }) {
  const percentage = Math.min(1, value / max);
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.ringProgress, { width: size, height: size, borderRadius: size / 2, borderColor: color, borderTopWidth: 3, borderRightWidth: 3, transform: [{ rotate: `${(1 - percentage) * 360}deg` }] }]} />
      <View style={[styles.ringCenter, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]}>
        <Text style={[typography.label, styles.textPrimary]}>{Math.round(percentage * 100)}%</Text>
      </View>
    </View>
  );
}

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={[typography.body, styles.textSecondary]}>{label}</Text>
      <Text style={[typography.cardTitle, styles.textPrimary]}>{value}</Text>
    </View>
  );
}

export function Badge({ children, tone = 'default' }: PropsWithChildren<{ tone?: Variant }>) {
  return (
    <View style={[styles.badge, tone === 'accent' && styles.badgeAccent, tone === 'danger' && styles.badgeDanger, tone === 'muted' && styles.badgeMuted]}>
      <Text style={[typography.label, styles.badgeText]}>{children}</Text>
    </View>
  );
}

export function StatusIndicator({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <Row style={styles.statusRow} gap={spacing.xs}>
      <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotInactive]} />
      <Text style={[typography.bodySmall, styles.textSecondary]}>{label}</Text>
    </Row>
  );
}

// Inputs
export function TextInputField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  accessibilityLabel,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'numeric' | 'email-address';
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      secureTextEntry={secureTextEntry}
      style={[styles.input, style]}
      value={value}
    />
  );
}

export function Toggle({
  value,
  onValueChange,
  accessibilityLabel = 'Toggle',
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.toggle}
    >
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.success : colors.border }]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

// Feedback
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={[typography.cardTitle, styles.textPrimary]}>{title}</Text>
      {detail ? <Text style={[typography.body, styles.textSecondary]}>{detail}</Text> : null}
    </View>
  );
}

export function ErrorState({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={[styles.emptyState, styles.errorSurface]}>
      <Text style={[typography.cardTitle, styles.errorText]}>{title}</Text>
      {detail ? <Text style={[typography.body, styles.errorText]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row' },
  divider: { height: 1, backgroundColor: colors.border, width: '100%' },

  textPrimary: { color: colors.textPrimary },
  textSecondary: { color: colors.textSecondary },
  textMuted: { color: colors.textMuted },
  errorText: { color: colors.error },

  surface: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  surfaceElevated: { ...shadows.subtle },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  pressable: { borderRadius: radii.lg },
  pressed: { opacity: 0.8 },

  button: { minHeight: 48, borderRadius: radii.md, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  primaryButton: { backgroundColor: colors.accent },
  secondaryButton: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  ghostButton: { backgroundColor: 'transparent' },
  destructiveButton: { backgroundColor: colors.error },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { transform: [{ scale: 0.99 }] },
  buttonText: { ...typography.body, fontWeight: '600' },
  primaryButtonText: { color: colors.textInverse },
  secondaryButtonText: { color: colors.textPrimary },
  ghostButtonText: { color: colors.accent },
  destructiveButtonText: { color: colors.textInverse },

  iconButton: { width: 40, height: 40, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  iconButtonText: { color: colors.textPrimary, fontSize: 18 },

  metric: { backgroundColor: colors.surfaceSubtle, borderRadius: radii.md, padding: spacing.lg, minWidth: 110 },
  metricAccent: { backgroundColor: colors.accentSubtle },
  metricDanger: { backgroundColor: '#FBEAE8' },

  progressTrack: { height: 10, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full },

  ring: { position: 'relative', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  ringProgress: { position: 'absolute', borderWidth: 3, borderColor: colors.accent, borderLeftWidth: 0, borderBottomWidth: 0 },
  ringCenter: { position: 'absolute', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.surfaceSubtle, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeAccent: { backgroundColor: colors.accentSubtle },
  badgeDanger: { backgroundColor: '#FBEAE8' },
  badgeMuted: { backgroundColor: colors.surface },
  badgeText: { color: colors.textPrimary },

  statusRow: { alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 999 },
  statusDotActive: { backgroundColor: colors.success },
  statusDotInactive: { backgroundColor: colors.textMuted },

  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, color: colors.textPrimary },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTrack: {
    width: 52,
    height: 32,
    borderRadius: radii.full,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  emptyState: { backgroundColor: colors.surfaceSubtle, borderRadius: radii.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  errorSurface: { backgroundColor: '#FBEAE8', borderColor: '#F5CFCB' },
});
