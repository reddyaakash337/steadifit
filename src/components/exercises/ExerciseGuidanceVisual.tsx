import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SteadiifitColors as C } from '@/constants/theme';
import { exerciseVisualForId } from '@/features/exerciseVisuals';

export type ExerciseGuidanceMode = 'illustration' | 'live-form';

type ExerciseGuidanceVisualProps = Readonly<{
  mode: ExerciseGuidanceMode;
  exerciseId: string;
  fallbackLabel: string;
  children?: ReactNode;
}>;

export function ExerciseGuidanceVisual({
  mode,
  exerciseId,
  fallbackLabel,
  children,
}: ExerciseGuidanceVisualProps) {
  const { width } = useWindowDimensions();
  const visual = mode === 'illustration' ? exerciseVisualForId(exerciseId) : undefined;
  const wide = visual?.orientation === 'landscape';
  const compactHeight = wide ? 104 : 122;
  const desktopHeight = wide ? 132 : 152;
  const frameHeight = width >= 720 ? desktopHeight : compactHeight;
  let content = children;

  if (mode === 'illustration' && visual) {
    content = <Image
      key={visual.exerciseId}
      source={visual.image}
      resizeMode="contain"
      style={styles.image}
      accessible
      accessibilityLabel={`${visual.exerciseName} illustration`}
    />;
  } else if (mode === 'illustration') {
    content = <Text style={styles.fallback}>{fallbackLabel}</Text>;
  }

  return <View style={[styles.frame, { height: frameHeight, maxWidth: width >= 720 ? 620 : undefined }]}>
    {content}
  </View>;
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: C.wash,
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  image: { width: '100%', height: '100%' },
  fallback: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center' },
});