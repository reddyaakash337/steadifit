import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Exercise } from '@/data/catalog';
import { SteadiifitColors as C } from '@/constants/theme';
import { exerciseVisualForId } from '@/features/exerciseVisuals';
import { ExerciseVisual } from '@/components/exercises/ExerciseVisual';

export function ExerciseCard({ exercise, favorite, onFavorite, onPress, selectLabel }: {
  exercise: Exercise; favorite: boolean; onFavorite: () => void; onPress: () => void; selectLabel?: string;
}) {
  const hasVisual = Boolean(exerciseVisualForId(exercise.id));
  return <View style={[styles.card, selectLabel && styles.selectionCard]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${selectLabel ? `${selectLabel} ` : 'View '}${exercise.name}`} accessibilityHint={selectLabel ? `${selectLabel} this exercise` : 'View exercise details'} onPress={onPress} style={styles.body}>
      <View style={styles.demo}>{hasVisual ? <ExerciseVisual exerciseId={exercise.id} style={styles.demoImage} /> : <Text numberOfLines={2} style={styles.demoLabel}>{exercise.category}</Text>}</View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.name}>{exercise.name}</Text>
        <Text numberOfLines={2} style={styles.meta}>{exercise.primaryMuscles.join(' · ')} · {exercise.equipment}</Text>
        {selectLabel ? <View style={styles.selectAction}><Text style={styles.select}>{selectLabel}</Text><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={13} weight="semibold" tintColor={C.accent} /></View> : null}
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`} accessibilityState={{ selected: favorite }} onPress={onFavorite} style={styles.favorite}>
      <SymbolView name={{ ios: favorite ? 'heart.fill' : 'heart', android: favorite ? 'favorite' : 'favorite_border', web: favorite ? 'favorite' : 'favorite_border' }} size={19} weight="medium" tintColor={favorite ? C.accent : C.muted} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 10, marginBottom: 9, position: 'relative' },
  selectionCard: { borderColor: '#D8C4AD', backgroundColor: '#FBF7F1' },
  body: { flexDirection: 'row', alignItems: 'center', minHeight: 96 },
  demo: { width: 88, aspectRatio: 1, borderRadius: 12, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', padding: 7 }, demoImage: { width: '100%', height: '100%' },
  demoLabel: { color: C.muted, fontSize: 10, lineHeight: 14, fontFamily: 'InterSemiBold', textAlign: 'center' },
  content: { flex: 1, minWidth: 0, paddingLeft: 12, paddingRight: 38 },
  name: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 16, lineHeight: 20 },
  meta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: 5 },
  selectAction: { minHeight: 32, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: '#D8C4AD', borderRadius: 9, backgroundColor: C.surface },
  select: { color: C.accent, fontFamily: 'InterBold', fontSize: 11 },
  favorite: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
});
