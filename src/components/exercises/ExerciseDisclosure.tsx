import { useRef, useState, type ReactNode } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { SteadiifitColors as C } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function ExerciseDisclosure({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const nextExpanded = !expanded;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(nextExpanded);
    Animated.timing(rotation, {
      toValue: nextExpanded ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  };

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return <View style={styles.section}>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={toggle}
      style={styles.header}
    >
      <Text style={styles.title}>{title}</Text>
      <Animated.Text style={[styles.chevron, { transform: [{ rotate }] }]}>›</Animated.Text>
    </Pressable>
    {expanded ? <View style={styles.content}>{children}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { borderBottomWidth: 1, borderBottomColor: C.line },
  header: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14 },
  chevron: { color: C.muted, fontSize: 24, lineHeight: 26, paddingHorizontal: 5 },
  content: { paddingBottom: 8 },
});