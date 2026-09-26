import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, router } from 'expo-router';
import { SteadiifitColors as C } from '@/constants/theme';
import { useSteadiifit } from '@/state/AppContext';

const primaryDestinations: { title: string; route: Href }[] = [
  { title: 'Home', route: '/(tabs)/home' },
  { title: 'Train', route: '/(tabs)/train' },
  { title: 'Progress', route: '/(tabs)/progress' },
  { title: 'Nutrition', route: '/(tabs)/nutrition' },
  { title: 'Profile', route: '/(tabs)/profile' },
  { title: 'Settings', route: '/settings' },
  { title: 'About', route: '/about' },
];

export function PrimaryHeader({ title }: { title: string }) {
  const { state } = useSteadiifit();
  const [drawerOpen, setDrawerOpen] = useState(false);
  return <>
    <View style={s.primaryHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open navigation menu" onPress={() => setDrawerOpen(true)} style={s.headerButton}>
        <View style={s.hamburger}><View style={s.hamburgerLine} /><View style={s.hamburgerLine} /><View style={s.hamburgerLine} /></View>
      </Pressable>
      <Text numberOfLines={1} style={s.primaryHeaderTitle}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')} style={[s.headerButton, s.headerAvatar]}>
        <Text style={s.avatarLabel}>{(state.name || 'A')[0].toUpperCase()}</Text>
      </Pressable>
    </View>
    <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
      <View style={s.drawerShade}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={() => setDrawerOpen(false)} style={StyleSheet.absoluteFill} />
        <View style={s.drawerPanel}>
          <View style={s.drawerHeading}><Text style={s.brand}>Steadiifit</Text><Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={() => setDrawerOpen(false)} style={s.drawerClose}><Text style={s.drawerCloseText}>×</Text></Pressable></View>
          {primaryDestinations.map(destination => <Pressable key={destination.title} accessibilityRole="button" onPress={() => { setDrawerOpen(false); router.push(destination.route); }} style={s.drawerItem}><Text style={s.drawerItemText}>{destination.title}</Text><Text style={s.chevron}>›</Text></Pressable>)}
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  primaryHeader: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { borderRadius: 20, backgroundColor: C.ink },
  hamburger: { width: 20, height: 16, justifyContent: 'space-between', paddingVertical: 1 },
  hamburgerLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: C.ink },
  primaryHeaderTitle: { flex: 1, textAlign: 'center', color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 },
  drawerShade: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(21,20,15,0.42)' },
  drawerPanel: { width: 310, maxWidth: '84%', height: '100%', backgroundColor: C.background, paddingTop: 22, paddingHorizontal: 18 },
  drawerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 5, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line },
  drawerClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  drawerCloseText: { color: C.muted, fontSize: 27, lineHeight: 30 },
  drawerItem: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: C.line, paddingHorizontal: 5 },
  drawerItemText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14 },
  brand: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink },
  avatarLabel: { color: '#FFF', fontFamily: 'InterBold', fontSize: 16 },
  chevron: { color: C.muted, fontSize: 22 },
});
