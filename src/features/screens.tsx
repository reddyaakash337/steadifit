import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseCategory, ExerciseDifficulty, exerciseById, exercises, PlanDay, workoutById, workouts } from '@/data/catalog';
import { useSteadiifit, Goal } from '@/state/AppContext';
import { SteadiifitColors as C } from '@/constants/theme';
import { Action, Card, Copy, Empty, Eyebrow, Heading, Option, Pill, Screen, SectionTitle, TopBar, uiStyles } from '@/components/steadiifit-ui';
import { ExerciseCard } from '@/components/exercises/ExerciseCard';
import { bodyWeightChange, calculateExerciseProgress, calculatePersonalRecords, calculateTotalVolume, calculateTotalWorkouts, calculateWeeklyWorkoutCount, calculateWorkoutStreak, calculateWorkoutStats, sortWorkoutsNewest, sortedBodyWeight, startOfWeek, workoutTimestamp, workoutVolume } from '@/features/progress';

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
    <Card style={s.hero} onPress={() => pushWorkout(workout.id)}><Eyebrow>{isTrainingDay ? 'TODAY’S WORKOUT' : 'NEXT UP IN YOUR PLAN'}</Eyebrow><Text style={s.heroTitle}>{workout.name}</Text><Text style={s.heroMeta}>{workout.focus} · {workout.duration} min · {workout.exerciseIds.length} exercises</Text><Action title="View workout  ›" onPress={() => pushWorkout(workout.id)} /><Pressable onPress={() => router.push({ pathname: '/active/[id]', params: { id: state.activeWorkout?.workoutId ?? workout.id } })} style={s.heroStart}><Text style={s.heroStartText}>{state.activeWorkout ? 'Continue active workout  →' : 'Start workout now  →'}</Text></Pressable></Card>
    <SectionTitle title="Your week" action="My Plan" onPress={() => router.push('/(tabs)/plan')} /><Card onPress={() => router.push('/(tabs)/plan')}><Text style={s.cardTitle}>{state.frequency} training days, planned for you</Text><Copy>{state.goal} · Tap to view your full week.</Copy></Card>
    <SectionTitle title="Progress" action="View" onPress={() => router.push('/(tabs)/progress')} /><View style={s.statsRow}><Stat value={`${calculateWorkoutStreak(state.history)} days`} label="Current streak" /><Stat value={`${calculateTotalWorkouts(state.history)}`} label="Workouts" /><Stat value={`${state.history[0] ? Math.round(workoutVolume(state.history[0])).toLocaleString() : '0'} ${state.units}`} label="Last volume" /></View>
    <SectionTitle title="Recent workout" action="History" onPress={() => router.push('/history')} />
    {recent ? <Card onPress={() => openHistoryItem(recent.id)}><Text style={s.cardTitle}>{recent.name}</Text><Copy>{recent.date} · {recent.duration} min · {Math.round(workoutVolume(recent)).toLocaleString()} {recent.units ?? state.units}</Copy></Card> : <Empty title="No workouts yet" detail="Complete your first workout to start building your history." />}
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
  const workout = workoutById(id); const { state, startWorkout } = useSteadiifit(); const active = state.activeWorkout;
  return <Screen><TopBar title="Workout details" /><Heading>{workout.name}</Heading><Copy>{workout.description}</Copy><View style={s.pills}><Pill>{workout.focus}</Pill><Pill>{workout.difficulty}</Pill><Pill>{workout.duration} min</Pill></View><View style={s.statsRow}><Stat value={`${workout.duration}`} label="Minutes" /><Stat value={`${workout.exerciseIds.length}`} label="Exercises" /></View>
    <SectionTitle title="Exercise list" />{workout.exerciseIds.map(id => { const exercise = exerciseById(id); return <Card key={id} onPress={() => openExercise(id)}><Text style={s.cardTitle}>{exercise.name}</Text><Copy>{exercise.muscle} · {exercise.equipment}</Copy><Text style={s.prescription}>{exercise.sets} sets × {exercise.repRange} reps</Text></Card>; })}
    <Action title={active?.workoutId === workout.id ? 'Resume workout  →' : active ? 'Resume active workout  →' : 'Start workout  →'} onPress={() => { const targetId = active?.workoutId ?? workout.id; if (!active) startWorkout(targetId); router.push({ pathname: '/active/[id]', params: { id: targetId } }); }} />
  </Screen>;
}

export function ActiveWorkoutScreen({ id }: { id: string }) {
  const { state, startWorkout, startSingleExercise, updateSet, completeSet, setRest, advanceWorkout, skipExercise, togglePause, tickWorkout, discardWorkout } = useSteadiifit();
  const workout = workoutById(id); const session = state.activeWorkout;
  const [sheet, setSheet] = useState<'pause' | 'skip' | 'exit' | 'finish' | null>(null);
  useEffect(() => { if (!session) { if (id.startsWith('exercise-')) startSingleExercise(id.slice('exercise-'.length)); else startWorkout(id); } else if (session.workoutId !== id) router.replace({ pathname: '/active/[id]', params: { id: session.workoutId } }); }, [id, session?.workoutId, startWorkout, startSingleExercise]);
  useEffect(() => { if (!session || session.paused) return; const timer = setInterval(tickWorkout, 1000); return () => clearInterval(timer); }, [session?.id, session?.paused, tickWorkout]);
  useEffect(() => { if (session?.paused && sheet === null) setSheet('pause'); }, [session?.id, session?.paused, sheet]);
  if (!session) return <Screen><TopBar title={workout.name} /><Empty title="Preparing workout" detail="Your session is starting." /></Screen>;
  const workoutName = session.workoutName || workout.name;
  const index = Math.min(session.exerciseIndex, session.exercises.length - 1); const current = session.exercises[index];
  const exercise = exerciseById(current?.exerciseId); const currentSet = current?.sets[session.setIndex];
  const atEnd = !current || session.exerciseIndex >= session.exercises.length;
  const moveOn = () => { if (atEnd) { router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); return; } const lastSet = session.setIndex >= current.sets.length - 1; const lastExercise = session.exerciseIndex >= session.exercises.length - 1; if (lastSet && lastExercise) router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); else advanceWorkout(); };
  const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
  const modal = sheet !== null;
  const pauseSession = () => { if (!session.paused) togglePause(); setSheet('pause'); };
  const confirmExit = () => { if (!session.paused) togglePause(); setSheet('exit'); };
  return <Screen>
    <TopBar title={workoutName} onBack={confirmExit} right={<Pressable onPress={pauseSession}><Text style={s.sessionMenu}>Ⅱ</Text></Pressable>} />
    <View style={s.sessionTop}><Text style={s.sessionElapsed}>{formatTime(session.elapsedSeconds)}</Text><Pill>{session.paused ? 'PAUSED' : 'IN PROGRESS'}</Pill></View>
    <Eyebrow>{atEnd ? 'WORKOUT COMPLETE' : `EXERCISE ${session.exerciseIndex + 1} OF ${session.exercises.length}`}</Eyebrow><View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.min(100, ((session.exerciseIndex + (session.setIndex / Math.max(1, current?.sets.length ?? 1))) / Math.max(1, session.exercises.length)) * 100)}%` }]} /></View>
    {!atEnd && <><Heading>{exercise.name}</Heading><Copy>{exercise.muscle} · {exercise.equipment} · {current.targetSets} sets × {current.targetReps} reps</Copy>
      <Card style={{ marginTop: 16 }}><Eyebrow>FORM CUE</Eyebrow><Copy>{exercise.cue}</Copy></Card>
      <SectionTitle title="Your sets" action={`${session.setIndex + 1} / ${current.sets.length}`} />
      {current.sets.map((set, setIndex) => <Pressable key={setIndex} onPress={() => !set.completed && updateSet(set.weight, set.reps)} style={[s.loggedSet, setIndex === session.setIndex && s.loggedSetCurrent, set.completed && s.loggedSetDone]}><Text style={s.loggedSetLabel}>{set.completed ? '✓' : `SET ${setIndex + 1}`}</Text><Text style={s.loggedSetValue}>{set.weight || 'Bodyweight'}{set.weight ? ` ${state.units}` : ''}  ×  {set.reps} {current.repUnit}</Text></Pressable>)}
      {currentSet && !currentSet.completed && <Card style={s.adjustCard}><Text style={s.adjustHeading}>Log this set</Text><View style={s.adjustRow}>{[['Weight', currentSet.weight, (n: number) => updateSet(n, currentSet.reps)], [current.repUnit === 'reps' ? 'Reps' : 'Duration', currentSet.reps, (n: number) => updateSet(currentSet.weight, n)]].map(([label, value, update] : any, itemIndex) => <View key={label} style={s.adjustField}><Text style={s.adjustLabel}>{label} {itemIndex === 0 ? `(${state.units})` : current.repUnit !== 'reps' ? `(${current.repUnit})` : ''}</Text><View style={s.stepper}><Pressable style={s.stepperButton} onPress={() => update(Math.max(0, Number(value) - (itemIndex === 0 ? 2.5 : current.repUnit === 'sec' ? 5 : 1)))}><Text style={s.stepperText}>−</Text></Pressable><Text style={s.stepValue}>{value}</Text><Pressable style={s.stepperButton} onPress={() => update(Number(value) + (itemIndex === 0 ? 2.5 : current.repUnit === 'sec' ? 5 : 1))}><Text style={s.stepperText}>+</Text></Pressable></View></View>)}</View></Card>}
      {session.restSeconds !== null && <Card style={s.restCard}><Eyebrow>{session.restActive ? 'REST TIMER' : session.restSeconds === 0 ? 'REST COMPLETE' : 'REST'}</Eyebrow><Text style={s.restTime}>{formatTime(session.restSeconds)}</Text><View style={s.restControls}><Pressable onPress={() => setRest(Math.max(0, (session.restSeconds ?? 0) - 15), true)}><Text style={s.restLink}>−15 sec</Text></Pressable><Pressable onPress={() => setRest((session.restSeconds ?? 0) + 15, true)}><Text style={s.restLink}>+15 sec</Text></Pressable><Pressable onPress={() => setRest(0, false)}><Text style={s.restLink}>Skip rest</Text></Pressable></View></Card>}
      <Action title={currentSet?.completed ? (session.restActive ? `Resting · ${formatTime(session.restSeconds ?? 0)}` : session.setIndex + 1 < current.sets.length ? 'Next set  →' : session.exerciseIndex + 1 < session.exercises.length ? 'Next exercise  →' : 'Finish workout  →') : 'Complete set  ✓'} disabled={session.paused || (currentSet?.completed && session.restActive)} onPress={() => { if (currentSet && !currentSet.completed) completeSet(); else moveOn(); }} />
      <View style={s.sessionActions}><Pressable onPress={() => router.push({ pathname: '/exercises', params: { mode: 'replace' } })}><Text style={s.restLink}>Replace exercise</Text></Pressable><Pressable onPress={() => setSheet('skip')}><Text style={s.restLink}>Skip exercise</Text></Pressable><Pressable onPress={() => router.push({ pathname: '/exercises', params: { mode: 'add' } })}><Text style={s.restLink}>Add exercise</Text></Pressable></View>
    </>}
    {atEnd && <><Heading>All exercises done</Heading><Copy>Review your session and save it to your workout history.</Copy><Action title="Finish workout" onPress={() => router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } })} /></>}
    <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setSheet(null)}><View style={s.modalShade}><View style={s.modalCard}>
      {sheet === 'pause' ? <><Eyebrow>SESSION PAUSED</Eyebrow><Heading size={23}>Take your time.</Heading><Copy>Your workout is saved here until you resume or finish.</Copy><Action title="Resume workout" onPress={() => { togglePause(); setSheet(null); }} /><Action title="Finish workout" secondary onPress={() => setSheet('finish')} /><Action title="Exit workout" secondary onPress={() => setSheet('exit')} /></> : null}
      {sheet === 'finish' || sheet === 'exit' || sheet === 'skip' ? <><Eyebrow>CONFIRM</Eyebrow><Heading size={23}>{sheet === 'skip' ? 'Skip this exercise?' : sheet === 'exit' ? 'Leave workout?' : 'Finish workout?'}</Heading><Copy>{sheet === 'skip' ? 'Completed sets stay logged and this exercise will be marked skipped.' : sheet === 'exit' ? 'Keep your session to resume later, save it to history now, or discard it.' : 'Save this session and add it to your history.'}</Copy>
        {sheet === 'skip' ? <><Action title="Skip exercise" onPress={() => { const last = session.exerciseIndex >= session.exercises.length - 1; skipExercise(); setSheet(null); if (last) router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); }} /><Action title="Keep exercising" secondary onPress={() => setSheet(null)} /></> : sheet === 'finish' ? <><Action title="Save workout" onPress={() => { setSheet(null); router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); }} /><Action title="Keep exercising" secondary onPress={() => setSheet(null)} /></> : <><Action title="Keep workout" onPress={() => { setSheet(null); router.back(); }} /><Action title="Finish workout" secondary onPress={() => { setSheet(null); router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); }} /><Action title="Discard workout" secondary onPress={() => { discardWorkout(); setSheet(null); router.replace('/(tabs)/home'); }} /></>}
      </> : null}
    </View></View></Modal>
  </Screen>;
}

export function WorkoutCompleteScreen({ id }: { id: string }) {
  const workout = workoutById(id); const { state, finishWorkout } = useSteadiifit(); const [item, setItem] = useState<ReturnType<typeof finishWorkout>>(null); const completedSession = useRef<string | null>(null);
  useEffect(() => { if (!item && state.activeWorkout && completedSession.current !== state.activeWorkout.id) { completedSession.current = state.activeWorkout.id; setItem(finishWorkout()); } }, [item, state.activeWorkout, finishWorkout]);
  const session = item ?? state.history[0]; const exercisesDone = session?.exercises.filter(ex => ex.sets.some(set => set.completed !== false)).length ?? 0; const setCount = session?.exercises.reduce((total, ex) => total + ex.sets.length, 0) ?? 0;
  return <Screen style={s.complete}><View style={s.success}><Text style={s.successText}>✓</Text></View><Heading>Workout complete</Heading><Copy>{session?.name ?? workout.name} · {session?.duration ?? 0} min</Copy><View style={[s.statsRow, { alignSelf: 'stretch', marginTop: 20 }]}><Stat value={`${exercisesDone}`} label="Exercises" /><Stat value={`${setCount}`} label="Sets" /><Stat value={`${(session?.volume ?? 0).toLocaleString()}`} label={`${state.units} volume`} /></View>{session?.personalRecord ? <Card style={{ alignSelf: 'stretch', marginTop: 14 }}><Pill green>NEW PERSONAL RECORD</Pill><Copy style={{ marginTop: 8 }}>You set a new best on a completed exercise.</Copy></Card> : null}<Card style={{ alignSelf: 'stretch', marginTop: 12 }}><Text style={s.cardTitle}>Nice work showing up.</Text><Copy>Your session is saved in workout history and your progress has been updated.</Copy></Card><Action title="Back to Home" onPress={() => router.replace('/(tabs)/home')} /><Action title="View workout history" secondary onPress={() => router.replace('/history')} /></Screen>;
}

export function WorkoutHistoryScreen() {
  const { state } = useSteadiifit(); const [filter, setFilter] = useState<'All' | 'This week' | 'This month'>('All'); const now = new Date();
  const sorted = sortWorkoutsNewest(state.history, now);
  const visible = sorted.filter(item => { const date = workoutTimestamp(item, now); if (filter === 'This week') return date >= startOfWeek(now).getTime() && date <= now.getTime(); if (filter === 'This month') return date >= new Date(now.getFullYear(), now.getMonth(), 1).getTime() && date <= now.getTime(); return true; });
  return <Screen><TopBar title="Workout history" /><Heading>History</Heading><Copy>Your completed training sessions.</Copy><View style={s.filterChoices}>{(['All', 'This week', 'This month'] as const).map(choice => <FilterChoice key={choice} label={choice} selected={filter === choice} onPress={() => setFilter(choice)} />)}</View>{visible.length ? visible.map(item => { const stats = calculateWorkoutStats(item); return <Card key={item.id} onPress={() => openHistoryItem(item.id)}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{item.name}</Text>{item.personalRecord ? <Pill green>PR</Pill> : null}</View><Copy>{formatDate(workoutTimestamp(item, now))} · {item.duration} min · {stats.exerciseCount} exercises</Copy><Copy style={{ marginTop: 4 }}>{Math.round(stats.volume).toLocaleString()} {item.units ?? state.units} volume · {stats.completedSets} sets</Copy></Card>; }) : <Empty title={state.history.length ? 'No workouts in this period' : 'No completed workouts yet'} detail={state.history.length ? 'Try another time filter to see your training.' : 'Complete a workout and your history will appear here.'} />}</Screen>;
}

export function WorkoutHistoryDetailsScreen({ id }: { id: string }) {
  const { state } = useSteadiifit(); const item = state.history.find(entry => entry.id === id);
  if (!item) return <Screen><TopBar title="Workout details" /><Empty title="Workout not found" detail="This session is not in your history." /></Screen>;
  const stats = calculateWorkoutStats(item, item.units ?? state.units); const prs = item.personalRecords?.map(record => ({ ...record, workoutId: item.id })) ?? calculatePersonalRecords(state.history, new Date(), item.units ?? state.units).filter(record => record.workoutId === item.id);
  return <Screen><TopBar title="Workout details" /><Heading>{item.name}</Heading><Copy>{formatDate(workoutTimestamp(item))} · {item.duration} min</Copy><View style={s.statsRow}><Stat value={Math.round(stats.volume).toLocaleString()} label={`${item.units ?? state.units} volume`} /><Stat value={`${stats.exerciseCount}`} label="Exercises" /><Stat value={`${stats.completedSets}`} label="Sets" /></View>{prs.length ? <Card style={{ marginTop: 12 }}><Pill green>{prs.length} PERSONAL RECORD{prs.length === 1 ? '' : 'S'}</Pill>{prs.map(record => <Copy key={record.exerciseId} style={{ marginTop: 7 }}>{exerciseById(record.exerciseId).name} · {record.weight} {item.units ?? state.units} × {record.reps}</Copy>)}</Card> : null}<SectionTitle title="Exercises performed" />{item.exercises.map((ex, exIndex) => { const exercise = exerciseById(ex.exerciseId); const unit = /min/i.test(exercise.repRange) ? 'min' : /sec/i.test(exercise.repRange) ? 'sec' : 'reps'; const exerciseVolume = ex.sets.filter(set => set.completed !== false).reduce((total, set) => total + set.weight * set.reps, 0); const isPR = prs.some(record => record.exerciseId === ex.exerciseId); return <Card key={`${ex.exerciseId}-${exIndex}`}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{exercise.name}</Text>{ex.skipped ? <Pill>SKIPPED</Pill> : isPR ? <Pill green>PR</Pill> : null}</View>{ex.sets.length ? ex.sets.map((set, index) => <Copy key={`${ex.exerciseId}-${index}`}>Set {index + 1} · {set.weight ? `${set.weight} ${item.units ?? state.units}` : 'Bodyweight'} × {set.reps} {unit}</Copy>) : <Copy>{ex.skipped ? 'Skipped during this session' : 'No completed sets'}</Copy>}{exerciseVolume > 0 ? <Copy style={{ marginTop: 7 }}>Exercise volume · {exerciseVolume.toLocaleString()} {item.units ?? state.units}</Copy> : null}</Card>; })}<Action title="Repeat workout" onPress={() => item.workoutId.startsWith('exercise-') ? router.push({ pathname: '/exercises/[id]', params: { id: item.workoutId.slice('exercise-'.length) } }) : router.push({ pathname: '/workout/[id]', params: { id: item.workoutId } })} /></Screen>;
}

function FilterChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.filterChoice, selected && s.filterChoiceActive]}><Text style={[s.filterChoiceText, selected && s.filterChoiceTextActive]}>{label}</Text></Pressable>;
}

export function ExerciseLibraryScreen() {
  const params = useLocalSearchParams<{ mode?: string }>(); const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const selectionMode = mode === 'replace' || mode === 'add';
  const { state, toggleFavorite, replaceExercise, addExercise } = useSteadiifit();
  const sessionExercise = state.activeWorkout?.exercises[state.activeWorkout.exerciseIndex];
  const [query, setQuery] = useState(''); const [muscle, setMuscle] = useState(mode === 'replace' && sessionExercise ? exerciseById(sessionExercise.exerciseId).muscle : ''); const [equipment, setEquipment] = useState('');
  const [difficulty, setDifficulty] = useState(''); const [category, setCategory] = useState(''); const [favoritesOnly, setFavoritesOnly] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false);
  const muscles = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core'];
  const equipmentOptions = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Resistance Band'];
  const difficulties: ExerciseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];
  const categories: ExerciseCategory[] = ['Strength', 'Cardio', 'Flexibility', 'Core'];
  const currentSession = state.activeWorkout; const currentExercise = currentSession?.exercises[currentSession.exerciseIndex];
  const matches = exercises.filter(item => {
    const needle = query.trim().toLowerCase();
    const searchable = [item.name, ...item.primaryMuscles, ...item.secondaryMuscles, item.equipment, item.category].join(' ').toLowerCase();
    const alreadyInSession = Boolean(currentSession?.exercises.some(entry => entry.exerciseId === item.id));
    const sameAsCurrent = currentExercise?.exerciseId === item.id;
    return (!needle || searchable.includes(needle)) && (!muscle || item.primaryMuscles.includes(muscle) || item.secondaryMuscles.includes(muscle)) && (!equipment || item.equipment === equipment) && (!difficulty || item.difficulty === difficulty) && (!category || item.category === category) && (!favoritesOnly || state.favoriteExerciseIds.includes(item.id)) && !(mode === 'replace' && sameAsCurrent) && !(mode === 'add' && alreadyInSession);
  });
  const activeFilterCount = [muscle, equipment, difficulty, category].filter(Boolean).length;
  const clearFilters = () => { setQuery(''); setMuscle(''); setEquipment(''); setDifficulty(''); setCategory(''); setFavoritesOnly(false); };
  const selectExercise = (exerciseId: string) => {
    if (mode === 'replace') replaceExercise(exerciseId);
    if (mode === 'add') addExercise(exerciseId);
    router.back();
  };
  return <Screen>
    <TopBar title="Exercises" right={<Text style={s.favoriteCount}>{state.favoriteExerciseIds.length} saved</Text>} />
    {selectionMode ? <><Eyebrow>{mode === 'replace' ? 'REPLACE CURRENT MOVEMENT' : 'ADD TO THIS WORKOUT'}</Eyebrow><Heading size={23}>{mode === 'replace' ? `Replace ${currentExercise ? exerciseById(currentExercise.exerciseId).name : 'exercise'}` : 'Choose an exercise'}</Heading><Copy>{mode === 'replace' ? 'Choose a movement to take its place. Your other sets stay saved.' : 'Your new movement will be added to the end of this session.'}</Copy></> : <><Heading>Exercises</Heading><Copy>Explore {exercises.length} movements and find the right fit.</Copy></>}
    <View style={s.searchRow}><TextInput accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search exercises, muscles, equipment" placeholderTextColor={C.muted} style={[uiStyles.input, s.exerciseSearch]} /><Pressable accessibilityRole="button" accessibilityLabel="Clear search" disabled={!query} onPress={() => setQuery('')} style={[s.clearSearch, !query && { opacity: 0.35 }]}><Text style={s.clearSearchText}>×</Text></Pressable></View>
    <View style={s.exerciseToolbar}><Pressable accessibilityRole="button" onPress={() => setFiltersOpen(true)} style={s.filterButton}><Text style={s.filterButtonText}>☷  Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: favoritesOnly }} onPress={() => setFavoritesOnly(value => !value)} style={[s.favoriteToggle, favoritesOnly && s.filterChoiceActive]}><Text style={[s.favoriteToggleText, favoritesOnly && s.filterChoiceTextActive]}>{favoritesOnly ? '♥ Favorites' : '♡ Favorites'}</Text></Pressable><Text style={s.resultCount}>{matches.length} found</Text></View>
    {(query || muscle || equipment || difficulty || category || favoritesOnly) ? <View style={s.selectedFilters}>{[query ? `“${query}”` : '', muscle, equipment, difficulty, category, favoritesOnly ? 'Favorites' : ''].filter(Boolean).map(label => <Pill key={label}>{label}</Pill>)}<Pressable accessibilityRole="button" onPress={clearFilters}><Text style={s.clearFilters}>Clear filters</Text></Pressable></View> : null}
    {matches.length ? matches.map(item => <ExerciseCard key={item.id} exercise={item} favorite={state.favoriteExerciseIds.includes(item.id)} onFavorite={() => toggleFavorite(item.id)} selectLabel={selectionMode ? mode === 'replace' ? 'Replace' : 'Add' : undefined} onPress={() => selectionMode ? selectExercise(item.id) : openExercise(item.id)} />) : <><Empty title="No exercises found" detail="Try a different search or remove a filter." />{(query || activeFilterCount || favoritesOnly) ? <Action title="Clear Filters" secondary onPress={clearFilters} /> : null}</>}
    <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}><View style={s.modalShade}><View style={s.filterSheet}><TopBar title="Filters" onBack={() => setFiltersOpen(false)} right={activeFilterCount ? <Pressable onPress={() => { setMuscle(''); setEquipment(''); setDifficulty(''); setCategory(''); }}><Text style={s.clearFilters}>Clear</Text></Pressable> : null} /><ScrollView showsVerticalScrollIndicator={false}>
      <Eyebrow>MUSCLE</Eyebrow><View style={s.filterChoices}>{muscles.map(item => <FilterChoice key={item} label={item} selected={muscle === item} onPress={() => setMuscle(muscle === item ? '' : item)} />)}</View>
      <Eyebrow>EQUIPMENT</Eyebrow><View style={s.filterChoices}>{equipmentOptions.map(item => <FilterChoice key={item} label={item} selected={equipment === item} onPress={() => setEquipment(equipment === item ? '' : item)} />)}</View>
      <Eyebrow>DIFFICULTY</Eyebrow><View style={s.filterChoices}>{difficulties.map(item => <FilterChoice key={item} label={item} selected={difficulty === item} onPress={() => setDifficulty(difficulty === item ? '' : item)} />)}</View>
      <Eyebrow>CATEGORY</Eyebrow><View style={s.filterChoices}>{categories.map(item => <FilterChoice key={item} label={item} selected={category === item} onPress={() => setCategory(category === item ? '' : item)} />)}</View>
    </ScrollView><Action title={`Show ${matches.length} exercises`} onPress={() => setFiltersOpen(false)} /></View></View></Modal>
  </Screen>;
}

export function ExerciseDetailsScreen({ id }: { id: string }) {
  const exercise = exerciseById(id); const { state, toggleFavorite, startSingleExercise, replaceExercise } = useSteadiifit();
  const previous = state.history.find(session => session.exercises.some(item => item.exerciseId === exercise.id && item.sets.length > 0));
  const previousExercise = previous?.exercises.find(item => item.exerciseId === exercise.id && item.sets.length > 0);
  const previousSets = previousExercise?.sets ?? [];
  const bestWeight = previousSets.reduce((best, set) => Math.max(best, set.weight), 0);
  const bestReps = previousSets.reduce((best, set) => Math.max(best, set.reps), 0);
  const active = state.activeWorkout; const activeExercise = active?.exercises[active.exerciseIndex];
  const start = () => {
    if (active) {
      if (activeExercise?.exerciseId !== exercise.id) replaceExercise(exercise.id);
      router.replace({ pathname: '/active/[id]', params: { id: active.workoutId } });
      return;
    }
    startSingleExercise(exercise.id);
    router.push({ pathname: '/active/[id]', params: { id: `exercise-${exercise.id}` } });
  };
  return <Screen>
    <TopBar title="Exercise details" right={<Pressable accessibilityRole="button" accessibilityLabel={state.favoriteExerciseIds.includes(exercise.id) ? 'Remove from favorites' : 'Add to favorites'} onPress={() => toggleFavorite(exercise.id)} style={s.detailFavorite}><Text style={s.detailFavoriteIcon}>{state.favoriteExerciseIds.includes(exercise.id) ? '♥' : '♡'}</Text></Pressable>} />
    <View style={s.demoHero}><View style={s.demoBar}><View style={s.demoPlate} /><View style={s.demoGrip} /><View style={s.demoPlate} /></View><Text style={s.demoKicker}>MOVEMENT PREVIEW</Text><Text style={s.demoLabel}>{exercise.demo}</Text><Copy style={s.demoCopy}>A visual guide for {exercise.name.toLowerCase()}.</Copy></View>
    <Heading>{exercise.name}</Heading><Copy>{exercise.category} · {exercise.difficulty}</Copy>
    <SectionTitle title="Muscles & equipment" /><View style={s.detailInfoGrid}><Card style={s.detailInfo}><Eyebrow>PRIMARY</Eyebrow><Text style={s.cardTitle}>{exercise.primaryMuscles.join(', ')}</Text></Card><Card style={s.detailInfo}><Eyebrow>SECONDARY</Eyebrow><Text style={s.cardTitle}>{exercise.secondaryMuscles.length ? exercise.secondaryMuscles.join(', ') : '—'}</Text></Card><Card style={s.detailInfo}><Eyebrow>EQUIPMENT</Eyebrow><Text style={s.cardTitle}>{exercise.equipment}</Text></Card><Card style={s.detailInfo}><Eyebrow>DIFFICULTY</Eyebrow><Text style={s.cardTitle}>{exercise.difficulty}</Text></Card></View>
    <SectionTitle title="Recommended" /><View style={s.statsRow}><Stat value={`${exercise.sets}`} label="Sets" /><Stat value={exercise.repRange} label="Reps / time" /><Stat value={`${exercise.restSeconds}s`} label="Rest" /></View>
    <SectionTitle title="How to perform" />{exercise.instructions.map((instruction, index) => <View key={instruction} style={s.instructionRow}><Text style={s.instructionNumber}>{String(index + 1).padStart(2, '0')}</Text><Copy style={s.instructionText}>{instruction}</Copy></View>)}
    <SectionTitle title="Form tips" />{exercise.formTips.map(tip => <Card key={tip} style={s.tipCard}><Text style={s.tipMark}>✓</Text><Copy style={s.tipCopy}>{tip}</Copy></Card>)}
    <SectionTitle title="Common mistakes" />{exercise.commonMistakes.map(mistake => <View key={mistake} style={s.mistakeRow}><Text style={s.mistakeMark}>•</Text><Copy style={s.instructionText}>{mistake}</Copy></View>)}
    <SectionTitle title="Previous performance" />{previous && previousExercise ? <Card><Eyebrow>LAST PERFORMANCE · {previous.date.toUpperCase()}</Eyebrow>{previousSets.map((set, index) => <Text key={`${previous.id}-${index}`} style={s.performanceSet}>{set.weight || 'Bodyweight'}{set.weight ? ` ${state.units}` : ''} × {set.reps} {exercise.repRange.toLowerCase().includes('min') ? 'min' : exercise.repRange.toLowerCase().includes('sec') ? 'sec' : 'reps'}</Text>)}<View style={s.performanceMeta}><Copy>Best weight  <Text style={s.performanceValue}>{bestWeight ? `${bestWeight} ${state.units}` : 'Bodyweight'}</Text></Copy><Copy>Best {exercise.repRange.toLowerCase().includes('min') ? 'time' : exercise.repRange.toLowerCase().includes('sec') ? 'hold' : 'reps'}  <Text style={s.performanceValue}>{bestReps}{exercise.repRange.toLowerCase().includes('min') ? ' min' : exercise.repRange.toLowerCase().includes('sec') ? ' sec' : ''}</Text></Copy></View><Copy style={{ marginTop: 8 }}>Last trained {previous.date}</Copy></Card> : <Empty title="No previous performance" detail="Complete this exercise to start tracking your progress." />}
    <Action title={active ? 'Use in active workout  →' : 'Start Exercise  →'} onPress={start} />
  </Screen>;
}

export function ProgressScreen() {
  const { state } = useSteadiifit(); const now = new Date(); const weekly = calculateWeeklyWorkoutCount(state.history, now); const records = calculatePersonalRecords(state.history, now, state.units);
  const days = Array.from({ length: 7 }, (_, index) => { const date = startOfWeek(now); date.setDate(date.getDate() + index); const key = date.toDateString(); const done = state.history.some(item => new Date(workoutTimestamp(item, now)).toDateString() === key); return { date, done }; });
  const exercisesWithHistory = [...new Set(state.history.flatMap(item => item.exercises.filter(ex => ex.sets.some(set => set.completed !== false)).map(ex => ex.exerciseId)))];
  const recent = sortWorkoutsNewest(state.history, now).slice(0, 3); const weightEntries = sortedBodyWeight(state.bodyWeightEntries); const currentWeight = weightEntries[0]; const change = bodyWeightChange(state.bodyWeightEntries);
  return <Screen><Heading>Progress</Heading><Copy>Your training, at a glance.</Copy>
    {!state.history.length ? <Empty title="Your progress starts here" detail="Complete a workout and your stats, consistency, and strength history will appear here." /> : <>
      <View style={s.progressGrid}><ProgressStat label="Current streak" value={`${calculateWorkoutStreak(state.history, now)} days`} /><ProgressStat label="This week" value={`${weekly} workouts`} /><ProgressStat label="Workouts" value={`${calculateTotalWorkouts(state.history)}`} /><ProgressStat label="Training volume" value={`${Math.round(calculateTotalVolume(state.history, state.units)).toLocaleString()} ${state.units}`} /></View>
      <SectionTitle title="Weekly consistency" /><Card><View style={s.weekDays}>{days.map(({ date, done }) => <View key={date.toISOString()} style={s.weekDay}><View style={[s.weekDot, done && s.weekDotDone]}><Text style={[s.weekCheck, done && { color: '#FFF' }]}>{done ? '✓' : ''}</Text></View><Text style={s.weekLabel}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</Text></View>)}</View><Copy style={{ marginTop: 11 }}>{weekly} {weekly === 1 ? 'workout' : 'workouts'} completed this week</Copy></Card>
      <SectionTitle title="Recent activity" action="History" onPress={() => router.push('/history')} />{recent.map(item => { const stats = calculateWorkoutStats(item); return <Card key={item.id} onPress={() => openHistoryItem(item.id)}><Text style={s.cardTitle}>{item.name}</Text><Copy>{formatDate(workoutTimestamp(item, now))} · {item.duration} min · {stats.exerciseCount} exercises</Copy><Copy style={{ marginTop: 4 }}>{Math.round(workoutVolume(item)).toLocaleString()} {item.units ?? state.units} volume</Copy></Card>; })}
      <SectionTitle title="Strength progress" />{exercisesWithHistory.length ? exercisesWithHistory.map(id => { const exercise = exerciseById(id); const progress = calculateExerciseProgress(state.history, id, now, state.units); if (!progress) return null; return <Card key={id} onPress={() => router.push({ pathname: '/progress/exercise/[id]', params: { id } })}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{exercise.name}</Text><Text style={s.linkArrow}>›</Text></View><Copy>Best · {progress.bestWeight > 0 ? `${progress.bestWeight.toFixed(1).replace(/\.0$/, '')} ${state.units}` : 'Bodyweight'} × {progress.bestReps} reps</Copy><Copy style={{ marginTop: 4 }}>{progress.sessions} sessions · {Math.round(progress.totalVolume).toLocaleString()} {state.units} volume · Last {formatDate(progress.lastPerformed)}</Copy></Card>; }) : <Empty title="No performance data yet" detail="Logged exercise performances will be tracked here." />}
      <SectionTitle title="Personal records" />{records.length ? records.map(record => <Card key={record.exerciseId}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{exerciseById(record.exerciseId).name}</Text><Pill green>BEST</Pill></View><Copy>{record.weight} {state.units} × {record.reps} reps · {formatDate(record.date)}</Copy></Card>) : <Empty title="No records yet" detail="Complete a weighted set to establish your first personal record." />}
    </>}
    <SectionTitle title="Body weight" action="View" onPress={() => router.push('/progress/body-weight')} /><Card onPress={() => router.push('/progress/body-weight')}><Text style={s.cardTitle}>{currentWeight ? `${currentWeight.weight} ${currentWeight.units}` : 'No weight entries yet'}</Text><Copy>{currentWeight ? change === null ? 'Current body weight · log another entry to see a change' : `${change > 0 ? '+' : ''}${change.toFixed(1)} ${currentWeight.units} since previous entry` : 'Log a body weight to start your personal trend.'}</Copy></Card>
    <Action title="Workout history" secondary onPress={() => router.push('/history')} />
  </Screen>;
}

export function ExerciseProgressScreen({ id }: { id: string }) {
  const { state } = useSteadiifit(); const exercise = exerciseById(id); const now = new Date(); const progress = calculateExerciseProgress(state.history, id, now, state.units);
  if (!progress) return <Screen><TopBar title="Exercise progress" /><Heading>{exercise.name}</Heading><Empty title="No performance data yet" detail="Complete this exercise in a workout and its progress will appear here." /></Screen>;
  const weighted = progress.points.some(point => point.weight > 0); const values = progress.points.map(point => weighted ? point.weight : point.reps); const max = Math.max(...values, 1); const floor = Math.min(...values);
  return <Screen><TopBar title="Exercise progress" /><Eyebrow>STRENGTH PROGRESS</Eyebrow><Heading>{exercise.name}</Heading><Copy>Performance from your completed workout history.</Copy><Card style={{ marginTop: 14 }}><Eyebrow>{weighted ? 'PERSONAL RECORD' : 'BEST PERFORMANCE'}</Eyebrow><Text style={s.chartValue}>{progress.bestWeight > 0 ? `${progress.bestWeight.toFixed(1).replace(/\.0$/, '')} ${state.units}` : 'Bodyweight'} × {progress.bestReps} reps</Text><Copy>{weighted ? 'Best completed weight and reps' : 'Highest completed reps'}</Copy><View style={s.chartArea}>{progress.points.slice(-8).map((point, index) => { const value = weighted ? point.weight : point.reps; const height = max === floor ? 42 : Math.max(18, Math.round((value / max) * 105)); return <View key={`${point.date}-${index}`} style={s.chartColumn}><Text style={s.chartPoint}>{weighted ? value : `${value}r`}</Text><View style={[s.chartBar, { height }]} /><Text style={s.chartDate}>{new Date(point.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</Text></View>; })}</View><Copy style={{ marginTop: 6 }}>{weighted ? `Weight per session · ${state.units}` : 'Reps per session'}</Copy></Card><View style={s.progressGrid}><ProgressStat label="Sessions" value={`${progress.sessions}`} /><ProgressStat label="Total volume" value={`${Math.round(progress.totalVolume).toLocaleString()} ${state.units}`} /><ProgressStat label="Last performed" value={formatDate(progress.lastPerformed)} /><ProgressStat label="Best reps" value={`${progress.bestReps}`} /></View><SectionTitle title="Session history" />{progress.points.slice().reverse().map((point, index) => <Card key={`${point.date}-${index}`}><Text style={s.cardTitle}>{formatDate(point.date)}</Text><Copy>{point.weight > 0 ? `${point.weight} ${state.units}` : 'Bodyweight'} × {point.reps} reps · {Math.round(point.volume).toLocaleString()} {state.units} volume</Copy></Card>)}</Screen>;
}

export function BodyWeightScreen() {
  const { state, logBodyWeight } = useSteadiifit(); const [value, setValue] = useState(''); const entries = sortedBodyWeight(state.bodyWeightEntries); const change = bodyWeightChange(entries);
  const save = () => { const weight = Number(value.replace(',', '.')); if (!Number.isFinite(weight) || weight <= 0) return; logBodyWeight(weight); setValue(''); };
  return <Screen><TopBar title="Body weight" /><Heading>Body weight</Heading><Copy>Track your check-ins over time.</Copy>{entries[0] ? <Card style={{ marginTop: 12 }}><Eyebrow>CURRENT</Eyebrow><Text style={s.chartValue}>{entries[0].weight} {entries[0].units}</Text><Copy>{change === null ? 'Log another entry to see your change.' : `${change > 0 ? '+' : ''}${change.toFixed(1)} ${entries[0].units} since your previous entry`}</Copy></Card> : <Empty title="No weight entries yet" detail="Log your first check-in to start a personal body weight history." />}<SectionTitle title="Log a weight" /><TextInput accessibilityLabel="Body weight" keyboardType="decimal-pad" value={value} onChangeText={setValue} placeholder={`Weight in ${state.units}`} placeholderTextColor={C.muted} style={uiStyles.input} /><Action title="Save weight" disabled={!Number.isFinite(Number(value.replace(',', '.'))) || Number(value.replace(',', '.')) <= 0} onPress={save} /><SectionTitle title="Previous entries" />{entries.length ? entries.map(entry => <Card key={entry.id}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{formatDate(entry.recordedAt)}</Text><Text style={s.weightValue}>{entry.weight} {entry.units}</Text></View></Card>) : <Empty title="Nothing logged yet" detail="Your previous entries will be listed here." />}</Screen>;
}

function ProgressStat({ label, value }: { label: string; value: string }) { return <View style={s.progressStat}><Text style={s.progressStatValue} numberOfLines={1}>{value}</Text><Text style={s.progressStatLabel}>{label}</Text></View>; }
function formatDate(timestamp: number) { return timestamp ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : 'Date unavailable'; }

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
  sessionMenu: { fontSize: 20, color: C.ink, paddingHorizontal: 8 }, sessionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, sessionElapsed: { fontFamily: 'BricolageBold', fontSize: 22, color: C.ink },
  loggedSet: { minHeight: 48, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, loggedSetCurrent: { borderColor: C.accent, backgroundColor: '#FBF7F1' }, loggedSetDone: { backgroundColor: C.greenWash, borderColor: C.green }, loggedSetLabel: { color: C.muted, fontFamily: 'InterBold', fontSize: 11 }, loggedSetValue: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13 },
  adjustCard: { marginTop: 5 }, adjustHeading: { color: C.ink, fontFamily: 'InterBold', fontSize: 13, marginBottom: 12 }, adjustRow: { flexDirection: 'row', gap: 12 }, adjustField: { flex: 1 }, adjustLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11, marginBottom: 6 }, stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: C.background, borderWidth: 1, borderColor: C.line }, stepperButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }, stepperText: { color: C.ink, fontSize: 22 }, stepValue: { color: C.ink, fontFamily: 'InterBold', fontSize: 14 },
  restCard: { marginTop: 9, alignItems: 'center', backgroundColor: C.wash }, restTime: { fontFamily: 'BricolageExtraBold', fontSize: 34, color: C.ink, marginVertical: 4 }, restControls: { flexDirection: 'row', gap: 23, marginTop: 5 }, restLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, paddingVertical: 7 }, sessionActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginVertical: 10 },
  modalShade: { flex: 1, backgroundColor: 'rgba(21,20,15,0.45)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: C.background, padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }, exerciseOption: { paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line },
  complete: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }, success: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.greenWash, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, successText: { color: C.green, fontSize: 30 },
  demo: { height: 145, borderRadius: 16, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 15 }, demoText: { color: C.accent, fontWeight: '600', fontSize: 12 },
  favoriteCount: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 }, searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, exerciseSearch: { flex: 1, marginBottom: 8 }, clearSearch: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: C.wash, marginTop: 1 }, clearSearchText: { color: C.ink, fontSize: 23, lineHeight: 25 },
  exerciseToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }, filterButton: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 8 }, filterButtonText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, favoriteToggle: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 8 }, favoriteToggleText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, resultCount: { flex: 1, textAlign: 'right', color: C.muted, fontFamily: 'InterRegular', fontSize: 11 }, selectedFilters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }, clearFilters: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, padding: 7 },
  filterSheet: { backgroundColor: C.background, padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }, filterChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4, marginBottom: 16 }, filterChoice: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 2 }, filterChoiceActive: { backgroundColor: C.ink, borderColor: C.ink }, filterChoiceText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, filterChoiceTextActive: { color: '#FFF' },
  detailFavorite: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center' }, detailFavoriteIcon: { color: C.accent, fontSize: 20 }, demoHero: { height: 210, borderRadius: 20, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', marginBottom: 19, overflow: 'hidden' }, demoBar: { height: 8, width: 160, backgroundColor: C.accent, borderRadius: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, demoGrip: { height: 22, width: 52, backgroundColor: C.ink, borderRadius: 5 }, demoPlate: { width: 22, height: 58, borderRadius: 7, backgroundColor: C.ink }, demoKicker: { color: C.muted, fontFamily: 'InterBold', fontSize: 9, letterSpacing: 1.1 }, demoLabel: { color: C.accent, fontFamily: 'InterBold', fontSize: 13, marginTop: 5 }, demoCopy: { fontSize: 11, marginTop: 3 }, detailInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailInfo: { width: '48%', marginBottom: 0, flexGrow: 1 },
  instructionRow: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line }, instructionNumber: { color: C.accent, fontFamily: 'BricolageBold', fontSize: 16, width: 26 }, instructionText: { flex: 1 }, tipCard: { flexDirection: 'row', gap: 9, paddingVertical: 12 }, tipMark: { color: C.green, fontFamily: 'InterBold', fontSize: 15 }, tipCopy: { flex: 1 }, mistakeRow: { flexDirection: 'row', gap: 9, paddingVertical: 7 }, mistakeMark: { color: C.accent, fontSize: 17 }, performanceSet: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, paddingVertical: 4 }, performanceMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, performanceValue: { color: C.ink, fontFamily: 'InterBold' },
  chartValue: { color: C.ink, fontSize: 23, fontWeight: '800', marginTop: 4 }, chartBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 12 }, bar: { width: 16, backgroundColor: C.accent, borderRadius: 5 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, progressStat: { width: '48%', flexGrow: 1, minHeight: 75, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 15, padding: 13, justifyContent: 'center' }, progressStatValue: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink }, progressStatLabel: { fontFamily: 'InterRegular', color: C.muted, fontSize: 11, marginTop: 4 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between' }, weekDay: { alignItems: 'center', gap: 7, flex: 1 }, weekDot: { width: 27, height: 27, borderRadius: 14, backgroundColor: C.background, borderColor: C.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, weekDotDone: { backgroundColor: C.green, borderColor: C.green }, weekCheck: { color: C.muted, fontSize: 12, fontFamily: 'InterBold' }, weekLabel: { color: C.muted, fontSize: 10, fontFamily: 'InterSemiBold' },
  historyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, linkArrow: { color: C.accent, fontSize: 24, lineHeight: 25 }, weightValue: { color: C.ink, fontFamily: 'InterBold', fontSize: 14 }, chartArea: { minHeight: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 4, borderBottomWidth: 1, borderBottomColor: C.line, marginTop: 18, paddingHorizontal: 3 }, chartColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' }, chartPoint: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 9, marginBottom: 4 }, chartBar: { width: '55%', maxWidth: 28, minWidth: 10, backgroundColor: C.accent, borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartDate: { color: C.muted, fontFamily: 'InterRegular', fontSize: 9, marginTop: 5, marginBottom: 4 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 13 }, profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }, profileValue: { color: C.ink, fontSize: 13, fontWeight: '700' }, unitRow: { flexDirection: 'row', gap: 8, marginTop: 12 }, unit: { minWidth: 54, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, borderRadius: 16 }, unitSelected: { backgroundColor: C.ink, borderColor: C.ink }, unitText: { color: C.ink, textAlign: 'center', fontWeight: '700' },
});
