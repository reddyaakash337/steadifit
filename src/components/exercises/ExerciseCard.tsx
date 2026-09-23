import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Exercise } from '@/data/catalog';
import { SteadiifitColors as C } from '@/constants/theme';

export function ExerciseCard({ exercise, favorite, onFavorite, onPress, selectLabel }: {
  exercise: Exercise; favorite: boolean; onFavorite: () => void; onPress: () => void; selectLabel?: string;
}) {
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${selectLabel ? `${selectLabel} ` : 'View '}${exercise.name}`} onPress={onPress} style={styles.body}>
      <View style={styles.demo}><Text style={styles.demoMark}>↗</Text><Text numberOfLines={1} style={styles.demoLabel}>{exercise.demo}</Text></View>
      <View style={styles.content}>
        <View style={styles.titleRow}><Text numberOfLines={2} style={styles.name}>{exercise.name}</Text><View style={styles.level}><Text style={styles.levelText}>{exercise.difficulty}</Text></View></View>
        <Text style={styles.meta}>{exercise.primaryMuscles.join(', ')} · {exercise.equipment}</Text>
        <Text style={styles.prescription}>{exercise.sets} sets · {exercise.repRange}</Text>
        {selectLabel ? <Text style={styles.select}>{selectLabel}  ›</Text> : null}
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`} accessibilityState={{ selected: favorite }} onPress={onFavorite} style={styles.favorite}>
      <Text style={[styles.favoriteIcon, favorite && styles.favoriteActive]}>{favorite ? '♥' : '♡'}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 10, marginBottom: 10, position: 'relative' },
  body: { flexDirection: 'row', alignItems: 'center', minHeight: 96 },
  demo: { width: 86, height: 86, borderRadius: 13, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', padding: 8 },
  demoMark: { color: C.accent, fontSize: 25, fontWeight: '700', marginBottom: 5 }, demoLabel: { color: C.accent, fontSize: 8, fontFamily: 'InterBold', letterSpacing: 0.4 },
  content: { flex: 1, paddingLeft: 12, paddingRight: 28 }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  name: { flex: 1, color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, lineHeight: 19 }, level: { backgroundColor: '#F0EEE7', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10 }, levelText: { color: C.muted, fontSize: 9, fontFamily: 'InterSemiBold' },
  meta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, marginTop: 5 }, prescription: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 11, marginTop: 6 }, select: { color: C.accent, fontFamily: 'InterBold', fontSize: 11, marginTop: 7 },
  favorite: { position: 'absolute', top: 11, right: 11, width: 35, height: 35, borderRadius: 18, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, favoriteIcon: { color: C.muted, fontSize: 20, lineHeight: 23 }, favoriteActive: { color: C.accent },
});
