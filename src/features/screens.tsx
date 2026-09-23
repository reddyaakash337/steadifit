import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { exerciseById, exercises, PlanDay, workoutById, workouts } from '@/data/catalog';
import { useSteadiifit, Goal } from '@/state/AppContext';
import { SteadiifitColors as C } from '@/constants/theme';
import { Action, Card, Copy, Empty, Eyebrow, Heading, Option, Pill, Screen, SectionTitle, TopBar, uiStyles } from '@/components/steadiifit-ui';

const weekday = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const pushWorkout = (id?: string) => router.push({ pathname: '/workout/[id]', params: { id: id || 'push' } });
const openExercise = (id: string) => router.push({ pathname: '/exercises/[id]', params: { id } });
const openHistoryItem = (id: string) => router.push({ pathname: '/history/[id]', params: { id } });
const recommendedWorkoutId = (plan: PlanDay[]) => {
  const today = (new Date().getDay() + 6) % 7;
  for (let offset = 0; offset < 7; offset += 1) {
    const workoutId = plan[(today + offset) % 7]?.workoutId;
    if (workoutId) return workoutId;
  }
  return 'push';
};

export function WelcomeScreen() {
  return <Screen style={s.welcome}>
    <View style={s.welcomeBrand}><Eyebrow>STEADIIFIT</Eyebrow><Heading size={40}>Consistency,{ '\n' }quantified.</Heading><Copy>Track every set, watch your progress, and let the plan adapt as you do.</Copy></View>
    <View><Copy style={{ textAlign: 'center', marginBottom: 9 }}>A personal training system, built around you.</Copy><Action title="Get started  ›" onPress={() => router.push('/onboarding')} /></View>
  </Screen>;
}

const questions: { title: string; key: 'goal' | 'experience' | 'equipment' | 'frequency'; choices: string[] }[] = [
  { title: 'What is your main goal?', key: 'goal', choices: ['Build muscle', 'Get stronger', 'Lose fat', 'Stay consistent'] },
  { title: 'How experienced are you?', key: 'experience', choices: ['New to training', 'Some Experience', 'Very Experienced'] },
  { title: 'What equipment do you have?', key: 'equipment', choices: ['Full Gym', 'Dumbbells', 'Bodyweight', 'Resistance Bands'] },
  { title: 'How often can you train?', key: 'frequency', choices: ['2 days', '3 days', '4 days', '5 days', '6 days'] },
];

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [experience, setExperience] = useState('');
  const [equipment, setEquipment] = useState('');
  const [frequency, setFrequency] = useState<number | null>(null);
  const { finishOnboarding } = useSteadiifit();
  const question = questions[step];
  const value = question.key === 'goal' ? goal : question.key === 'experience' ? experience : question.key === 'equipment' ? equipment : frequency;
  const selected = (choice: string) => question.key === 'frequency' ? value === Number(choice.split(' ')[0]) : value === choice;
  const choose = (choice: string) => {
    if (question.key === 'goal') setGoal(choice as Goal);
    if (question.key === 'experience') setExperience(choice);
    if (question.key === 'equipment') setEquipment(choice);
    if (question.key === 'frequency') setFrequency(Number(choice.split(' ')[0]));
  };
  const next = () => {
    if (value === '' || value === null) return;
    if (step < questions.length - 1) { setStep(step + 1); return; }
    finishOnboarding({ name: name.trim() || 'Alex', goal: goal || 'Build muscle', experience, equipment, frequency: frequency || 4 });
    router.replace('/plan-generated');
  };
  return <Screen>
    <TopBar title={`Getting started · ${step + 1} of 4`} onBack={() => step > 0 ? setStep(step - 1) : router.back()} />
    <View style={s.progressTrack}><View style={[s.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} /></View>
    <Heading>{question.title}</Heading><Copy style={{ marginBottom: 18 }}>We’ll use this to shape a plan that fits your routine.</Copy>
    {step === 0 ? <><Eyebrow>YOUR NAME (OPTIONAL)</Eyebrow><TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor={C.muted} style={uiStyles.input} /></> : null}
    {question.choices.map(choice => <Option key={choice} title={choice} selected={selected(choice)} onPress={() => choose(choice)} />)}
    <View style={{ flex: 1, minHeight: 16 }} />
    <Action title={step < 3 ? 'Continue' : 'Generate my plan'} disabled={value === '' || value === null} onPress={next} />
  </Screen>;
}

export function PlanGeneratedScreen() {
  React.useEffect(() => { const timeout = setTimeout(() => router.replace('/(tabs)/home'), 1300); return () => clearTimeout(timeout); }, []);
  return <View style={s.loading}><ActivityIndicator color={C.accent} size="large" /><Heading size={24}>Building your plan…</Heading><Copy>{`Your first week is coming together.`}</Copy></View>;
}

function BrandHeader() {
  const { state } = useSteadiifit();
  return <View style={s.brandHeader}><Text style={s.brand}>Steadiifit</Text><Pressable onPress={() => router.push('/(tabs)/profile')} style={s.avatar}><Text style={s.avatarLabel}>{(state.name || 'A')[0].toUpperCase()}</Text></Pressable></View>;
}
function Stat({ value, label }: { value: string; label: string }) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }

export function HomeScreen() {
  const { state } = useSteadiifit();
  const today = (new Date().getDay() + 6) % 7;
  const isTrainingDay = Boolean(state.plan[today]?.workoutId);
  const workoutId = recommendedWorkoutId(state.plan);
  const workout = workoutById(workoutId); const recent = state.history[0];
  return <Screen>
    <BrandHeader /><Eyebrow>YOUR TRAINING, AT A GLANCE</Eyebrow><Heading size={24}>Good to see you, {state.name}.</Heading>
    <Card style={s.hero} onPress={() => pushWorkout(workout.id)}><Eyebrow>{isTrainingDay ? 'TODAY’S WORKOUT' : 'NEXT UP IN YOUR PLAN'}</Eyebrow><Text style={s.heroTitle}>{workout.name}</Text><Text style={s.heroMeta}>{workout.focus} · {workout.duration} min · {workout.exerciseIds.length} exercises</Text><Action title="View workout  ›" onPress={() => pushWorkout(workout.id)} /><Pressable onPress={() => router.push({ pathname: '/active/[id]', params: { id: workout.id } })} style={s.heroStart}><Text style={s.heroStartText}>Start workout now  →</Text></Pressable></Card>
    <SectionTitle title="Your week" action="My Plan" onPress={() => router.push('/(tabs)/plan')} /><Card onPress={() => router.push('/(tabs)/plan')}><Text style={s.cardTitle}>{state.frequency} training days, planned for you</Text><Copy>{state.goal} · Tap to view your full week.</Copy></Card>
    <SectionTitle title="Progress" action="View" onPress={() => router.push('/(tabs)/progress')} /><View style={s.statsRow}><Stat value={`${state.streak}`} label="Day streak" /><Stat value={`${state.history.length}`} label="Workouts" /><Stat value="+13 kg" label="Bench · 8 weeks" /></View>
    <SectionTitle title="Recent workout" action="History" onPress={() => router.push('/history')} />
    {recent ? <Card onPress={() => openHistoryItem(recent.id)}><Text style={s.cardTitle}>{recent.name}</Text><Copy>{recent.date} · {recent.duration} min · {recent.volume.toLocaleString()} kg</Copy></Card> : <Empty title="No workouts yet" detail="Complete your first workout to start building your history." />}
    <SectionTitle title="Nutrition snapshot" action="Open" onPress={() => router.push('/nutrition')} /><Card onPress={() => router.push('/nutrition')}><Text style={s.cardTitle}>Your daily nutrition</Text><Copy>Nutrition tracking will be added in a later part.</Copy></Card>
  </Screen>;
}

export function PlanScreen() {
  const { state } = useSteadiifit();
  return <Screen><Heading>My Plan</Heading><Copy>{state.frequency} days a week · {state.goal}</Copy>
    {state.plan.map(day => { const workout = day.workoutId ? workoutById(day.workoutId) : null; return <Card key={day.day} style={s.planRow} onPress={() => workout && pushWorkout(workout.id)}><Text style={s.day}>{weekday[day.day]}</Text><View style={{ flex: 1 }}><Text style={s.cardTitle}>{workout?.name ?? 'Rest'}</Text><Copy>{workout ? `${workout.focus} · ${workout.duration} min` : 'Recovery day'}</Copy></View><Text style={s.chevron}>{workout ? '›' : '·'}</Text></Card>; })}
    <Action title="Browse workouts" secondary onPress={() => router.push('/(tabs)/workouts')} />
  </Screen>;
}

export function WorkoutsScreen() {
  const { state } = useSteadiifit();
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('All');
  const featured = workoutById(recommendedWorkoutId(state.plan));
  const categories = ['All', 'Strength', 'Full Body'];
  const filtered = useMemo(() => workouts.filter(workout => workout.name.toLowerCase().includes(search.toLowerCase()) && (category === 'All' || (category === 'Full Body' ? workout.id === 'full' : workout.id !== 'full'))), [search, category]);
  return <Screen><Heading>Workouts</Heading><Copy>Find a session that fits your plan.</Copy>
    <SectionTitle title="Today's recommendation" /><Card style={s.recommend} onPress={() => pushWorkout(featured.id)}><Pill>RECOMMENDED</Pill><Text style={[s.cardTitle, { marginTop: 9 }]}>{featured.name}</Text><Copy>{featured.duration} min · {featured.focus}</Copy></Card>
    <SectionTitle title="Workout library" action="History" onPress={() => router.push('/history')} /><TextInput value={search} onChangeText={setSearch} placeholder="Search workouts" placeholderTextColor={C.muted} style={uiStyles.input} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{categories.map(item => <Pressable key={item} onPress={() => setCategory(item)} style={[s.chip, category === item && s.chipActive]}><Text style={[s.chipText, category === item && s.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {filtered.length ? filtered.map(workout => <Card key={workout.id} onPress={() => pushWorkout(workout.id)}><Text style={s.cardTitle}>{workout.name}</Text><View style={s.pills}><Pill>{workout.difficulty}</Pill><Pill>{workout.duration} min</Pill></View><Copy style={{ marginTop: 8 }}>{workout.description}</Copy></Card>) : <Empty title="No workouts found" detail="Try changing your search or category." />}
    <Action title="Exercise library" secondary onPress={() => router.push('/exercises')} />
  </Screen>;
}

export function WorkoutDetailsScreen({ id }: { id: string }) {
  const workout = workoutById(id);
  return <Screen><TopBar title="Workout details" /><Heading>{workout.name}</Heading><Copy>{workout.description}</Copy><View style={s.pills}><Pill>{workout.focus}</Pill><Pill>{workout.difficulty}</Pill><Pill>{workout.duration} min</Pill></View><View style={s.statsRow}><Stat value={`${workout.duration}`} label="Minutes" /><Stat value={`${workout.exerciseIds.length}`} label="Exercises" /></View>
    <SectionTitle title="Exercise list" />{workout.exerciseIds.map(id => { const exercise = exerciseById(id); return <Card key={id} onPress={() => openExercise(id)}><Text style={s.cardTitle}>{exercise.name}</Text><Copy>{exercise.muscle} · {exercise.equipment}</Copy><Text style={s.prescription}>{exercise.sets} sets × {exercise.repRange} reps</Text></Card>; })}
    <Action title="Start workout  →" onPress={() => router.push({ pathname: '/active/[id]', params: { id: workout.id } })} />
  </Screen>;
}

export function ActiveWorkoutScreen({ id }: { id: string }) {
  const workout = workoutById(id); const [index, setIndex] = useState(0); const [done, setDone] = useState(0); const exercise = exerciseById(workout.exerciseIds[index]);
  return <Screen><TopBar title={workout.name} /><Eyebrow>EXERCISE {index + 1} OF {workout.exerciseIds.length}</Eyebrow><View style={s.progressTrack}><View style={[s.progressFill, { width: `${((index + 1) / workout.exerciseIds.length) * 100}%` }]} /></View>
    <Heading>{exercise.name}</Heading><Copy>{exercise.muscle} · {exercise.equipment}</Copy><Card style={{ marginTop: 18 }}><Eyebrow>TARGET</Eyebrow><Text style={s.cardTitle}>{exercise.sets} sets × {exercise.repRange} reps</Text><Copy>{exercise.cue}</Copy></Card><SectionTitle title="Sets" /><View style={s.setRow}>{Array.from({ length: exercise.sets }, (_, set) => <Pressable key={set} onPress={() => setDone(value => value + 1)} style={[s.setButton, set < done % exercise.sets && s.setButtonDone]}><Text style={[s.setButtonText, set < done % exercise.sets && { color: '#FFF' }]}>{set < done % exercise.sets ? '✓' : `Set ${set + 1}`}</Text></Pressable>)}</View>
    {index < workout.exerciseIds.length - 1 ? <Action title="Next exercise" onPress={() => { setDone(value => value + 1); setIndex(value => value + 1); }} /> : <Action title="Finish workout" onPress={() => router.push({ pathname: '/complete/[id]', params: { id: workout.id } })} />}
  </Screen>;
}

export function WorkoutCompleteScreen({ id }: { id: string }) {
  const workout = workoutById(id);
  return <Screen style={s.complete}><View style={s.success}><Text style={s.successText}>✓</Text></View><Heading>Workout complete</Heading><Copy>{workout.name} · {workout.duration} min</Copy><Card style={{ alignSelf: 'stretch', marginTop: 20 }}><Text style={s.cardTitle}>Nice work showing up.</Text><Copy>History and progress will connect to completed sessions in a later part.</Copy></Card><Action title="Back to Home" onPress={() => router.replace('/(tabs)/home')} /><Action title="View progress" secondary onPress={() => router.replace('/(tabs)/progress')} /></Screen>;
}

export function WorkoutHistoryScreen() {
  const { state } = useSteadiifit();
  return <Screen><TopBar title="Workout history" /><Heading>History</Heading><Copy>Your recent training sessions.</Copy>{state.history.length ? state.history.map(item => <Card key={item.id} onPress={() => openHistoryItem(item.id)}><Text style={s.cardTitle}>{item.name}</Text><Copy>{item.date} · {item.duration} min · {item.volume.toLocaleString()} kg</Copy>{item.personalRecord ? <View style={{ marginTop: 8 }}><Pill green>New PR</Pill></View> : null}</Card>) : <Empty title="No workouts yet" detail="Complete your first session to start your history." />}</Screen>;
}

export function WorkoutHistoryDetailsScreen({ id }: { id: string }) {
  const { state } = useSteadiifit(); const item = state.history.find(entry => entry.id === id);
  if (!item) return <Screen><TopBar title="Workout details" /><Empty title="Workout not found" detail="This session is not in your history." /></Screen>;
  return <Screen><TopBar title="Workout details" /><Heading>{item.name}</Heading><Copy>{item.date} · {item.duration} min · {item.volume.toLocaleString()} kg</Copy>{item.exercises.map(ex => <Card key={ex.exerciseId}><Text style={s.cardTitle}>{exerciseById(ex.exerciseId).name}</Text>{ex.sets.map((set, index) => <Copy key={index}>Set {index + 1} · {set.weight || 'Bodyweight'}{set.weight ? ` ${state.units}` : ''} × {set.reps}</Copy>)}</Card>)}<Action title="Repeat workout" onPress={() => router.push({ pathname: '/active/[id]', params: { id: item.workoutId } })} /></Screen>;
}

export function ExerciseLibraryScreen() {
  const [query, setQuery] = useState(''); const [muscle, setMuscle] = useState('All'); const muscles = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps'];
  const matches = exercises.filter(exercise => exercise.name.toLowerCase().includes(query.toLowerCase()) && (muscle === 'All' || exercise.muscle === muscle));
  return <Screen><TopBar title="Exercise library" /><Heading>Exercises</Heading><Copy>Browse the Steadiifit exercise library.</Copy><TextInput value={query} onChangeText={setQuery} placeholder="Search exercises" placeholderTextColor={C.muted} style={uiStyles.input} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{muscles.map(item => <Pressable key={item} onPress={() => setMuscle(item)} style={[s.chip, muscle === item && s.chipActive]}><Text style={[s.chipText, muscle === item && s.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {matches.length ? matches.map(exercise => <Card key={exercise.id} onPress={() => openExercise(exercise.id)}><Text style={s.cardTitle}>{exercise.name}</Text><Copy>{exercise.muscle} · {exercise.equipment} · {exercise.difficulty}</Copy></Card>) : <Empty title="No exercises found" detail="Try another search or muscle group." />}</Screen>;
}

export function ExerciseDetailsScreen({ id }: { id: string }) {
  const exercise = exerciseById(id);
  return <Screen><TopBar title="Exercise details" /><View style={s.demo}><Text style={{ color: C.accent, fontSize: 26 }}>▷</Text><Text style={s.demoText}>Exercise demo placeholder</Text></View><Heading>{exercise.name}</Heading><View style={s.pills}><Pill>{exercise.muscle}</Pill><Pill>{exercise.equipment}</Pill><Pill>{exercise.difficulty}</Pill></View><SectionTitle title="Recommended sets and reps" /><Card><Text style={s.cardTitle}>{exercise.sets} sets × {exercise.repRange} reps</Text></Card><SectionTitle title="How to perform" /><Card><Copy>{exercise.cue}</Copy></Card><SectionTitle title="Common mistake" /><Card><Copy>{exercise.mistake}</Copy></Card></Screen>;
}

export function ProgressScreen() {
  const { state } = useSteadiifit();
  return <Screen><Heading>Progress</Heading><Copy>Your training, at a glance.</Copy><View style={s.statsRow}><Stat value={`${state.history.length}`} label="Workouts" /><Stat value={`${state.streak}`} label="Day streak" /></View><SectionTitle title="Strength" /><Card><Text style={s.cardTitle}>Bench Press</Text><Text style={s.chartValue}>65 kg</Text><Copy>+13 kg · 8 weeks</Copy><View style={s.chartBars}>{[35, 44, 50, 56, 68, 72, 82, 92].map((height, index) => <View key={index} style={[s.bar, { height }]} />)}</View></Card><SectionTitle title="Body" /><Card><Text style={s.cardTitle}>Weight trend</Text><Copy>Current mock weight: 80.2 kg</Copy></Card><Action title="Workout history" secondary onPress={() => router.push('/history')} /></Screen>;
}

export function NutritionScreen() { return <Screen><TopBar title="Nutrition" /><Heading>Nutrition</Heading><Empty title="Coming in a later part" detail="Nutrition is a placeholder in this frontend foundation." /></Screen>; }
export function CoachScreen() { return <Screen><TopBar title="AI Coach" /><Heading>AI Coach</Heading><Copy>Suggested prompts</Copy><Card><Text style={s.cardTitle}>What should I train today?</Text></Card><Card><Text style={s.cardTitle}>I only have 30 minutes.</Text></Card><Empty title="Coach replies come later" detail="This screen is a placeholder. No AI or external API is connected." /></Screen>; }

export function ProfileScreen() {
  const { state } = useSteadiifit();
  return <Screen><Heading>Profile</Heading><View style={s.profileHead}><View style={s.avatarBig}><Text style={s.avatarLabel}>{state.name[0]?.toUpperCase() || 'A'}</Text></View><View><Text style={s.cardTitle}>{state.name}</Text><Copy>{state.goal}</Copy></View></View><Card>{[['Experience', state.experience], ['Equipment', state.equipment], ['Training', `${state.frequency} days / week`], ['Units', state.units]].map(([key, value]) => <View key={key} style={s.profileRow}><Copy>{key}</Copy><Text style={s.profileValue}>{value}</Text></View>)}</Card><Action title="Settings" secondary onPress={() => router.push('/settings')} /><SectionTitle title="More" />{[['Workout history', '/history'], ['Nutrition', '/nutrition'], ['AI Coach', '/coach']].map(([name, path]) => <Card key={path} onPress={() => router.push(path as never)}><Text style={s.cardTitle}>{name}  ›</Text></Card>)}</Screen>;
}

export function SettingsScreen() {
  const { state, setUnits } = useSteadiifit();
  return <Screen><TopBar title="Settings" /><Heading>Settings</Heading><SectionTitle title="Units" /><Card><Copy>Choose how weights appear throughout the app.</Copy><View style={s.unitRow}>{(['kg', 'lb'] as const).map(unit => <Pressable key={unit} onPress={() => setUnits(unit)} style={[s.unit, state.units === unit && s.unitSelected]}><Text style={[s.unitText, state.units === unit && { color: '#FFF' }]}>{unit}</Text></Pressable>)}</View></Card><SectionTitle title="About" /><Card><Text style={s.cardTitle}>Steadiifit</Text><Copy>Frontend foundation · mock data</Copy></Card></Screen>;
}

const s = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: 'space-between', paddingTop: 70, paddingBottom: 24 }, welcomeBrand: { marginTop: 90, gap: 9 },
  progressTrack: { height: 5, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden', marginBottom: 19 }, progressFill: { height: 5, backgroundColor: C.ink },
  loading: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }, brand: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink }, avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, avatarBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, avatarLabel: { color: '#FFF', fontFamily: 'InterBold', fontSize: 16 },
  hero: { backgroundColor: C.ink, borderColor: C.ink, marginTop: 12 }, heroTitle: { color: '#FFF', fontFamily: 'BricolageExtraBold', fontSize: 24, marginTop: 5 }, heroMeta: { color: '#D2CEC3', fontFamily: 'InterRegular', fontSize: 12, marginTop: 5 }, heroStart: { alignItems: 'center', paddingVertical: 9 }, heroStartText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 13 },
  cardTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 5 }, statsRow: { flexDirection: 'row', gap: 8, marginTop: 9 }, stat: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 14 }, statValue: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 }, statLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 3 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }, day: { color: C.muted, fontSize: 11, fontWeight: '700', width: 34 }, chevron: { color: C.muted, fontSize: 22 }, recommend: { backgroundColor: '#FBF7F1', borderColor: '#D8C4AD' }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, chips: { gap: 7, paddingBottom: 12 }, chip: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: C.ink, borderColor: C.ink }, chipText: { color: C.ink, fontSize: 12, fontWeight: '600' }, chipTextActive: { color: '#FFF' }, prescription: { marginTop: 9, color: C.accent, fontSize: 12, fontWeight: '700' },
  setRow: { flexDirection: 'row', gap: 7 }, setButton: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, setButtonDone: { backgroundColor: C.green, borderColor: C.green }, setButtonText: { color: C.ink, fontSize: 11, fontWeight: '700' },
  complete: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }, success: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.greenWash, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, successText: { color: C.green, fontSize: 30 },
  demo: { height: 145, borderRadius: 16, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 15 }, demoText: { color: C.accent, fontWeight: '600', fontSize: 12 },
  chartValue: { color: C.ink, fontSize: 23, fontWeight: '800', marginTop: 4 }, chartBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 12 }, bar: { width: 16, backgroundColor: C.accent, borderRadius: 5 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 13 }, profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }, profileValue: { color: C.ink, fontSize: 13, fontWeight: '700' }, unitRow: { flexDirection: 'row', gap: 8, marginTop: 12 }, unit: { minWidth: 54, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, borderRadius: 16 }, unitSelected: { backgroundColor: C.ink, borderColor: C.ink }, unitText: { color: C.ink, textAlign: 'center', fontWeight: '700' },
});
