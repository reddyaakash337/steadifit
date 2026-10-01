import React, { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle, TextStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { SteadiifitColors as C } from '@/constants/theme';
import { colors as designColors, radii as designRadii } from '@/design/tokens';

export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <ScrollView style={s.scroll} contentContainerStyle={[s.content, style]} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}
export function Heading({ children, size = 28, style, numberOfLines }: PropsWithChildren<{ size?: number; style?: TextStyle; numberOfLines?: number }>) { return <Text numberOfLines={numberOfLines} style={[s.heading, { fontSize: size }, style]}>{children}</Text>; }
export function Copy({ children, style, numberOfLines }: PropsWithChildren<{ style?: TextStyle; numberOfLines?: number }>) { return <Text numberOfLines={numberOfLines} style={[s.copy, style]}>{children}</Text>; }
export function Eyebrow({ children }: PropsWithChildren) { return <Text style={s.eyebrow}>{children}</Text>; }
export function Card({ children, onPress, style }: PropsWithChildren<{ onPress?: () => void; style?: ViewStyle }>) {
  const body = <View style={[s.card, style]}>{children}</View>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed ? s.pressed : undefined}>{body}</Pressable> : body;
}
export function Action({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, secondary && s.secondary, disabled && s.disabled, pressed && !disabled && s.actionPressed]}><Text style={[s.actionText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
export function TopBar({ title, back = true, onBack, right }: { title: string; back?: boolean; onBack?: () => void; right?: React.ReactNode }) {
  return <View style={s.topbar}>{back ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack ?? (() => router.back())} style={s.back}><SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} weight="medium" tintColor={C.ink} /></Pressable> : null}<Text style={s.topTitle}>{title}</Text>{right}</View>;
}
export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={s.section}><Text style={s.sectionText}>{title}</Text>{action ? <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={s.sectionAction}><Text style={s.link}>{action}</Text></Pressable> : null}</View>;
}
export function Pill({ children, green = false }: PropsWithChildren<{ green?: boolean }>) { return <View style={[s.pill, green && s.pillGreen]}><Text style={[s.pillText, green && s.pillGreenText]}>{children}</Text></View>; }
export function SearchBox({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} style={s.input} />;
}
export function Empty({ title, detail }: { title: string; detail: string }) { return <Card style={s.empty}><Text style={s.emptyTitle}>{title}</Text><Copy style={{ textAlign: 'center' }}>{detail}</Copy></Card>; }
export function Loading({ title }: { title: string }) { return <View style={s.loading}><Text style={s.loadingMark}>◌</Text><Heading size={23}>{title}</Heading><Copy>Putting your first week together.</Copy></View>; }
export function Option({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[s.option, selected && s.optionSelected]}><Text style={s.optionText}>{title}</Text><View style={[s.radio, selected && s.radioSelected]}>{selected ? <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text> : null}</View></Pressable>;
}
const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.background }, content: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 28 },
  heading: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 28, lineHeight: 34, marginBottom: 6 },
  copy: { color: C.muted, fontFamily: 'InterRegular', fontSize: 14, lineHeight: 21 }, eyebrow: { color: C.muted, fontFamily: 'InterBold', fontSize: 11, letterSpacing: 0.45, marginBottom: 7 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 10 },
  action: { minHeight: 48, borderRadius: designRadii.md, backgroundColor: designColors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 }, actionText: { color: designColors.textInverse, fontFamily: 'InterSemiBold', fontSize: 14 }, secondary: { backgroundColor: designColors.surfaceSubtle, borderColor: designColors.line, borderWidth: 1 }, secondaryText: { color: designColors.textPrimary }, disabled: { opacity: 0.45 }, actionPressed: { transform: [{ scale: 0.99 }] }, pressed: { opacity: 0.75 },
  topbar: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.line, marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 15 }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }, topTitle: { flex: 1, color: C.ink, fontFamily: 'InterSemiBold', fontSize: 15 },
  section: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionText: { color: C.ink, fontFamily: 'InterBold', fontSize: 14 }, sectionAction: { minHeight: 40, justifyContent: 'center', alignItems: 'flex-end' }, link: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, padding: 4 },
  pill: { backgroundColor: C.wash, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 18, alignSelf: 'flex-start' }, pillText: { color: C.accent, fontFamily: 'InterBold', fontSize: 11 }, pillGreen: { backgroundColor: C.greenWash }, pillGreenText: { color: C.green },
  input: { height: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, color: C.ink, backgroundColor: C.surface, marginTop: 12, marginBottom: 10, fontSize: 15, fontFamily: 'InterRegular' },
  empty: { minHeight: 150, justifyContent: 'center', alignItems: 'center', gap: 7 }, emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: C.background }, loadingMark: { color: C.accent, fontSize: 40 },
  option: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, marginBottom: 9 }, optionSelected: { borderColor: C.ink, backgroundColor: C.wash }, optionText: { fontFamily: 'InterSemiBold', fontSize: 14, color: C.ink }, radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, radioSelected: { backgroundColor: C.ink, borderColor: C.ink },
});

export const uiStyles = s;
