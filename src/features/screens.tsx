import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { ExerciseCategory, ExerciseDifficulty, exerciseById, exercises, PlanDay, workoutById, workouts } from '@/data/catalog';
import { useSteadiifit, Goal, FoodMeal } from '@/state/AppContext';
import { SteadiifitColors as C } from '@/constants/theme';
import { Action, Card, Copy, Empty, Eyebrow, Heading, Option, Pill, Screen, SectionTitle, TopBar, uiStyles } from '@/components/steadiifit-ui';
import { ExerciseCard } from '@/components/exercises/ExerciseCard';
import { bodyWeightChange, calculateExerciseProgress, calculatePersonalRecords, calculateTotalVolume, calculateTotalWorkouts, calculateWeeklyWorkoutCount, calculateWorkoutStreak, calculateWorkoutStats, sortWorkoutsNewest, sortedBodyWeight, startOfWeek, workoutTimestamp } from '@/features/progress';
import { currentPlanWeek, equipmentCompatible, planDayFocus, planDayName, planDayStatus, planDayDuration, planWeekProgress, plannedExercises, PlanPreferences, TrainingFocus } from '@/features/plan';
import { estimateNutritionTargets, nutritionTotals } from '@/features/nutrition';
import { deriveCoachContext, localCoachResponse } from '@/features/coach';
import { convertWeight, formatWeight, WeightUnit } from '@/features/units';

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
const recommendedPlanDay = (plan: PlanDay[]) => {
  const today = (new Date().getDay() + 6) % 7;
  for (let offset = 0; offset < 7; offset += 1) { const day = plan[(today + offset) % 7]; if (day?.workoutId) return day; }
  return null;
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
  const { state, startPlanWorkout } = useSteadiifit();
  const today = (new Date().getDay() + 6) % 7;
  const isTrainingDay = Boolean(state.plan[today]?.workoutId);
  const planDay = recommendedPlanDay(state.plan); const workoutId = planDay?.workoutId ?? recommendedWorkoutId(state.plan);
  const workout = workoutById(workoutId); const recent = state.history[0]; const workoutName = planDay ? planDayName(planDay) : workout.name; const duration = planDay ? planDayDuration(planDay) : workout.duration;
  return <Screen>
    <BrandHeader /><Eyebrow>YOUR TRAINING, AT A GLANCE</Eyebrow><Heading size={24}>Good to see you, {state.name}.</Heading>
    <Card style={s.hero}><Eyebrow>{isTrainingDay ? 'TODAY’S WORKOUT' : 'NEXT UP IN YOUR PLAN'}</Eyebrow><Text style={s.heroTitle}>{workoutName}</Text><Text style={s.heroMeta}>{planDay ? planDayFocus(planDay) : workout.focus} · {duration} min · {planDay ? plannedExercises(planDay).length : workout.exerciseIds.length} exercises</Text><Action title="View workout  ›" onPress={() => planDay ? router.push({ pathname: '/plan/day/[day]', params: { day: String(planDay.day) } }) : pushWorkout(workout.id)} /><Pressable accessibilityRole="button" accessibilityLabel={state.activeWorkout ? 'Continue active workout' : 'Start workout now'} onPress={() => { if (state.activeWorkout) router.push({ pathname: '/active/[id]', params: { id: state.activeWorkout.workoutId } }); else if (planDay) { const id = startPlanWorkout(planDay.day); if (id) router.push({ pathname: '/active/[id]', params: { id } }); } else pushWorkout(workout.id); }} style={s.heroStart}><Text style={s.heroStartText}>{state.activeWorkout ? 'Continue active workout  →' : 'Start workout now  →'}</Text></Pressable></Card>
    <SectionTitle title="Your week" action="My Plan" onPress={() => router.push('/(tabs)/plan')} /><Card onPress={() => router.push('/(tabs)/plan')}><Text style={s.cardTitle}>{state.frequency} training days, planned for you</Text><Copy>{state.goal} · Tap to view your full week.</Copy></Card>
    <SectionTitle title="Progress" action="View" onPress={() => router.push('/(tabs)/progress')} /><View style={s.statsRow}><Stat value={`${calculateWorkoutStreak(state.history)} days`} label="Current streak" /><Stat value={`${calculateTotalWorkouts(state.history)}`} label="Workouts" /><Stat value={`${state.history[0] ? Math.round(calculateWorkoutStats(state.history[0], state.units).volume).toLocaleString() : '0'} ${state.units}`} label="Last volume" /></View>
    <SectionTitle title="Recent workout" action="History" onPress={() => router.push('/history')} />
    {recent ? <Card onPress={() => openHistoryItem(recent.id)}><Text style={s.cardTitle}>{recent.name}</Text><Copy>{recent.date} · {recent.duration} min · {Math.round(calculateWorkoutStats(recent, state.units).volume).toLocaleString()} {state.units}</Copy></Card> : <Empty title="No workouts yet" detail="Complete your first workout to start building your history." />}
    <SectionTitle title="Nutrition snapshot" action="Open" onPress={() => router.push('/nutrition')} /><Card onPress={() => router.push('/nutrition')}><Text style={s.cardTitle}>Today's nutrition</Text><Copy>{nutritionTotals(state.foodEntries).calories.toLocaleString()} kcal logged · {displayNumber(nutritionTotals(state.foodEntries).protein)}g protein</Copy></Card>
  </Screen>;
}

export function PlanScreen() {
  const { state } = useSteadiifit(); const progress = planWeekProgress(state.plan, state.history); const today = (new Date().getDay() + 6) % 7;
  if (!state.plan.length) return <Screen><Heading>My Plan</Heading><Empty title="No plan yet" detail="Choose your goal and schedule to build a weekly plan." /><Action title="Customize plan" onPress={() => router.push('/plan/customize')} /></Screen>;
  const durationPreference = state.duration === 75 ? '75+ min target' : `${state.duration} min target`;
  return <Screen><View style={s.planHeader}><View style={{ flex: 1 }}><Eyebrow>YOUR TRAINING, YOUR WAY</Eyebrow><Heading>My Plan</Heading><Copy>A personalized plan shaped around your routine.</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Customize plan" onPress={() => router.push('/plan/customize')} style={s.customizeIcon}><Text style={s.customizeIconText}>···</Text></Pressable></View>
    <Card style={s.planSummary}><View style={s.planSummaryTop}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{state.goal}</Text><Copy>{state.frequency} training days · {durationPreference} · {state.trainingFocus}</Copy></View><Pill>WEEK {currentPlanWeek(state.planStartedAt)}</Pill></View><View style={s.planMeter}><View style={[s.planMeterFill, { width: `${Math.round(progress.ratio * 100)}%` }]} /></View><Copy style={{ marginTop: 8 }}>{progress.completed} / {progress.planned} workouts completed this week</Copy></Card>
    <SectionTitle title="This week" action="Customize" onPress={() => router.push('/plan/customize')} />
    {state.plan.slice().sort((a, b) => a.weekday - b.weekday).map(day => { const status = planDayStatus(day, state.history); const rest = !day.workoutId; const title = planDayName(day); const exerciseCount = plannedExercises(day).length; return <Card key={day.id} style={{ ...s.planDayCard, ...(day.weekday === today && !rest ? s.planDayToday : {}) }} onPress={() => router.push({ pathname: '/plan/day/[day]', params: { day: String(day.weekday) } })}><Text style={s.day}>{weekday[day.weekday]}</Text><View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{title}</Text><Copy>{rest ? 'Rest and recover' : `${planDayFocus(day)} · ${planDayDuration(day)} min · ${exerciseCount} exercises`}</Copy></View><View style={s.planDayRight}><Pill green={status === 'Completed'}>{status.toUpperCase()}</Pill><Text style={s.chevron}>›</Text></View></Card>; })}
    <Action title="Browse all workouts" secondary onPress={() => router.push('/(tabs)/workouts')} />
  </Screen>;
}

export function CustomizePlanScreen() {
  const { state, regeneratePlan } = useSteadiifit();
  const [goal, setGoal] = useState<Goal>(state.goal); const [frequency, setFrequency] = useState(state.frequency); const [duration, setDuration] = useState(state.duration); const [equipment, setEquipment] = useState(state.equipment); const [focus, setFocus] = useState<TrainingFocus>(state.trainingFocus);
  const save = () => { regeneratePlan({ goal, experience: state.experience, frequency, equipment, duration, focus }); router.back(); };
  const choose = <T extends string | number,>(title: string, choices: T[], selected: T, setValue: (value: T) => void) => <><SectionTitle title={title} />{choices.map(choice => <Option key={String(choice)} title={String(choice)} selected={selected === choice} onPress={() => setValue(choice)} />)}</>;
  return <Screen><TopBar title="Customize plan" /><Eyebrow>PLAN PREFERENCES</Eyebrow><Heading>Make this plan yours.</Heading><Copy>Regenerating updates future planned workouts. Your workout history and progress stay as they are.</Copy>
    {choose<Goal>('Primary goal', ['Build muscle', 'Get stronger', 'Lose fat', 'Stay consistent'], goal, setGoal)}
    {choose<number>('Training days', [2, 3, 4, 5, 6], frequency, setFrequency)}
    {choose<number>('Workout duration', [30, 45, 60, 75], duration, setDuration)}
    {choose<string>('Available equipment', ['Full Gym', 'Dumbbells', 'Barbell', 'Machines', 'Bodyweight', 'Resistance Bands'], equipment, setEquipment)}
    {choose<TrainingFocus>('Training focus', ['Balanced', 'Full Body', 'Upper Body', 'Lower Body', 'Push', 'Pull', 'Legs', 'Strength', 'Hypertrophy'], focus, setFocus)}
    <Action title="Save and regenerate plan" onPress={save} /><Action title="Cancel" secondary onPress={() => router.back()} />
  </Screen>;
}

export function PlanDayDetailScreen({ dayIndex }: { dayIndex: number }) {
  const { state, startPlanWorkout, removePlanExercise } = useSteadiifit(); const day = state.plan[dayIndex];
  if (!day) return <Screen><TopBar title="Planned workout" /><Empty title="Plan day unavailable" detail="Regenerate your plan to restore this day." /><Action title="Customize plan" onPress={() => router.push('/plan/customize')} /></Screen>;
  const status = planDayStatus(day, state.history); const items = plannedExercises(day); const rest = !day.workoutId; const durationPreference = state.duration === 75 ? '75+ min target' : `${state.duration} min target`;
  const start = () => { const workoutId = startPlanWorkout(dayIndex); if (state.activeWorkout) router.push({ pathname: '/active/[id]', params: { id: state.activeWorkout.workoutId } }); else if (workoutId) router.push({ pathname: '/active/[id]', params: { id: workoutId } }); };
  return <Screen><TopBar title={weekday[dayIndex] ? `${weekday[dayIndex][0]}${weekday[dayIndex].slice(1).toLowerCase()} plan` : 'Planned workout'} /><Eyebrow>{rest ? 'RECOVERY DAY' : `WEEK ${currentPlanWeek(state.planStartedAt)} · ${status.toUpperCase()}`}</Eyebrow><Heading>{planDayName(day)}</Heading><Copy>{rest ? 'Rest is part of the plan. Take the day to recover before your next training session.' : `${planDayFocus(day)} · ${planDayDuration(day)} min · ${items.length} exercises`}</Copy>
    {rest ? <><Card style={{ marginTop: 14 }}><Text style={s.cardTitle}>Rest and recover</Text><Copy>Your next planned training day is already on your weekly schedule.</Copy></Card><Action title="View progress" secondary onPress={() => router.push('/(tabs)/progress')} /><Action title="Browse exercise library" secondary onPress={() => router.push('/exercises')} /></> : <>
      <View style={s.pills}><Pill>{state.goal}</Pill><Pill>{state.equipment}</Pill><Pill>{durationPreference}</Pill></View>
      <SectionTitle title="Workout exercises" action="Add exercise" onPress={() => router.push({ pathname: '/exercises', params: { mode: 'add', planDay: String(dayIndex) } })} />
      {items.length ? items.map((planned, index) => { const exercise = exerciseById(planned.exerciseId); return <Card key={planned.id}><Text style={s.cardTitle}>{index + 1}. {exercise.name}</Text><Copy>{exercise.primaryMuscles.join(', ')} · {exercise.equipment}</Copy><Text style={s.prescription}>{planned.sets} × {planned.repRange} · Rest {planned.restSeconds}s</Text><View style={s.planExerciseActions}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/exercises', params: { mode: 'replace', planDay: String(dayIndex), exerciseIndex: String(index) } })}><Text style={s.planExerciseLink}>Replace</Text></Pressable><Pressable accessibilityRole="button" disabled={items.length <= 1} onPress={() => removePlanExercise(dayIndex, index)}><Text style={[s.planExerciseLink, items.length <= 1 && { opacity: 0.4 }]}>Remove</Text></Pressable></View>{items.length <= 1 ? <Copy style={{ marginTop: 5, fontSize: 11 }}>Keep at least one exercise in the workout.</Copy> : null}</Card>; }) : <Empty title="No compatible exercises" detail="Adjust your equipment or focus in Customize Plan, or add a movement from the library." />}
      <Action title="Add an exercise" secondary onPress={() => router.push({ pathname: '/exercises', params: { mode: 'add', planDay: String(dayIndex) } })} />
      <SectionTitle title="Workout status" /><Card><Copy>{status === 'Completed' ? 'This planned workout is completed.' : status === 'Skipped' ? 'This day has passed without a matching completed workout.' : status === 'Today' ? 'Scheduled for today.' : 'Scheduled for later this week.'}</Copy></Card>
      <Action title={state.activeWorkout ? 'Continue active workout' : 'Start Workout'} onPress={start} disabled={!items.length} />
    </>}
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
  const workout = workouts.find(item => item.id === id); const { state, startWorkout } = useSteadiifit(); const active = state.activeWorkout;
  if (!workout) return <Screen><TopBar title="Workout details" /><Empty title="Workout not found" detail="This workout is not in the library." /><Action title="Browse workouts" onPress={() => router.replace('/(tabs)/workouts')} /></Screen>;
  return <Screen><TopBar title="Workout details" /><Heading>{workout.name}</Heading><Copy>{workout.description}</Copy><View style={s.pills}><Pill>{workout.focus}</Pill><Pill>{workout.difficulty}</Pill><Pill>{workout.duration} min</Pill></View><View style={s.statsRow}><Stat value={`${workout.duration}`} label="Minutes" /><Stat value={`${workout.exerciseIds.length}`} label="Exercises" /></View>
    <SectionTitle title="Exercise list" />{workout.exerciseIds.map(id => { const exercise = exerciseById(id); return <Card key={id} onPress={() => openExercise(id)}><Text style={s.cardTitle}>{exercise.name}</Text><Copy>{exercise.muscle} · {exercise.equipment}</Copy><Text style={s.prescription}>{exercise.sets} sets × {exercise.repRange} reps</Text></Card>; })}
    <Action title={active?.workoutId === workout.id ? 'Resume workout  →' : active ? 'Resume active workout  →' : 'Start workout  →'} onPress={() => { const targetId = active?.workoutId ?? workout.id; if (!active) startWorkout(targetId); router.push({ pathname: '/active/[id]', params: { id: targetId } }); }} />
  </Screen>;
}

export function ActiveWorkoutScreen({ id }: { id: string }) {
  const { state, startWorkout, startSingleExercise, updateSet, completeSet, setRest, advanceWorkout, skipExercise, togglePause, tickWorkout, discardWorkout } = useSteadiifit();
  const workout = workoutById(id); const session = state.activeWorkout;
  const exerciseId = id.startsWith('exercise-') ? id.slice('exercise-'.length) : null;
  const invalidRoute = exerciseId !== null ? !exercises.some(item => item.id === exerciseId) : !workouts.some(item => item.id === id);
  const [sheet, setSheet] = useState<'pause' | 'skip' | 'exit' | 'finish' | null>(null);
  const initializedRoute = useRef<string | null>(null);
  useEffect(() => {
    if (session) {
      initializedRoute.current = id;
      if (session.workoutId !== id) router.replace({ pathname: '/active/[id]', params: { id: session.workoutId } });
      return;
    }
    if (invalidRoute) return;
    if (initializedRoute.current === id) return;
    initializedRoute.current = id;
    if (id.startsWith('exercise-')) startSingleExercise(id.slice('exercise-'.length)); else startWorkout(id);
  }, [id, invalidRoute, session?.workoutId, startWorkout, startSingleExercise]);
  useEffect(() => { if (!session || session.paused) return; const timer = setInterval(tickWorkout, 1000); return () => clearInterval(timer); }, [session?.id, session?.paused, tickWorkout]);
  useEffect(() => { if (session?.paused && sheet === null) setSheet('pause'); }, [session?.id, session?.paused, sheet]);
  if (invalidRoute && !session) return <Screen><TopBar title="Workout unavailable" /><Empty title="Workout not found" detail="This workout or exercise is not in the library." /><Action title="Browse workouts" onPress={() => router.replace('/(tabs)/workouts')} /></Screen>;
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
      {current.sets.map((set, setIndex) => { const shownWeight = convertWeight(set.weight, session.units, state.units); return <Pressable key={set.id} onPress={() => !set.completed && updateSet(shownWeight, set.reps)} style={[s.loggedSet, setIndex === session.setIndex && s.loggedSetCurrent, set.completed && s.loggedSetDone]}><Text style={s.loggedSetLabel}>{set.completed ? '✓' : `SET ${setIndex + 1}`}</Text><Text style={s.loggedSetValue}>{set.weight ? `${formatWeight(set.weight, session.units, state.units)} ${state.units}` : 'Bodyweight'}  ×  {set.reps} {current.repUnit}</Text></Pressable>; })}
      {currentSet && !currentSet.completed && <Card style={s.adjustCard}><Text style={s.adjustHeading}>Log this set</Text><View style={s.adjustRow}>{[['Weight', convertWeight(currentSet.weight, session.units, state.units), (n: number) => updateSet(n, currentSet.reps)], [current.repUnit === 'reps' ? 'Reps' : 'Duration', currentSet.reps, (n: number) => updateSet(convertWeight(currentSet.weight, session.units, state.units), n)]].map(([label, value, update] : any, itemIndex) => <View key={label} style={s.adjustField}><Text style={s.adjustLabel}>{label} {itemIndex === 0 ? `(${state.units})` : current.repUnit !== 'reps' ? `(${current.repUnit})` : ''}</Text><View style={s.stepper}><Pressable style={s.stepperButton} onPress={() => update(Math.max(0, Number(value) - (itemIndex === 0 ? (state.units === 'kg' ? 2.5 : 5) : current.repUnit === 'sec' ? 5 : 1)))}><Text style={s.stepperText}>−</Text></Pressable><Text style={s.stepValue}>{itemIndex === 0 ? formatWeight(Number(value), state.units, state.units) : value}</Text><Pressable style={s.stepperButton} onPress={() => update(Number(value) + (itemIndex === 0 ? (state.units === 'kg' ? 2.5 : 5) : current.repUnit === 'sec' ? 5 : 1))}><Text style={s.stepperText}>+</Text></Pressable></View></View>)}</View></Card>}
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
  const sessionVolume = session ? convertWeight(session.volume, session.units ?? 'kg', state.units) : 0;
  return <Screen style={s.complete}><View style={s.success}><Text style={s.successText}>✓</Text></View><Heading>Workout complete</Heading><Copy>{session?.name ?? workout.name} · {session?.duration ?? 0} min</Copy><View style={[s.statsRow, { alignSelf: 'stretch', marginTop: 20 }]}><Stat value={`${exercisesDone}`} label="Exercises" /><Stat value={`${setCount}`} label="Sets" /><Stat value={`${Math.round(sessionVolume).toLocaleString()}`} label={`${state.units} volume`} /></View>{session?.personalRecord ? <Card style={{ alignSelf: 'stretch', marginTop: 14 }}><Pill green>NEW PERSONAL RECORD</Pill><Copy style={{ marginTop: 8 }}>You set a new best on a completed exercise.</Copy></Card> : null}<Card style={{ alignSelf: 'stretch', marginTop: 12 }}><Text style={s.cardTitle}>Nice work showing up.</Text><Copy>Your session is saved in workout history and your progress has been updated.</Copy></Card><Action title="Back to Home" onPress={() => router.replace('/(tabs)/home')} /><Action title="View workout history" secondary onPress={() => router.replace('/history')} /></Screen>;
}

export function WorkoutHistoryScreen() {
  const { state } = useSteadiifit(); const [filter, setFilter] = useState<'All' | 'This week' | 'This month'>('All'); const now = new Date();
  const sorted = sortWorkoutsNewest(state.history, now);
  const visible = sorted.filter(item => { const date = workoutTimestamp(item, now); if (filter === 'This week') return date >= startOfWeek(now).getTime() && date <= now.getTime(); if (filter === 'This month') return date >= new Date(now.getFullYear(), now.getMonth(), 1).getTime() && date <= now.getTime(); return true; });
  return <Screen><TopBar title="Workout history" /><Heading>History</Heading><Copy>Your completed training sessions.</Copy><View style={s.filterChoices}>{(['All', 'This week', 'This month'] as const).map(choice => <FilterChoice key={choice} label={choice} selected={filter === choice} onPress={() => setFilter(choice)} />)}</View>{visible.length ? visible.map(item => { const stats = calculateWorkoutStats(item, state.units); return <Card key={item.id} onPress={() => openHistoryItem(item.id)}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{item.name}</Text>{item.personalRecord ? <Pill green>PR</Pill> : null}</View><Copy>{formatDate(workoutTimestamp(item, now))} · {item.duration} min · {stats.exerciseCount} exercises</Copy><Copy style={{ marginTop: 4 }}>{Math.round(stats.volume).toLocaleString()} {state.units} volume · {stats.completedSets} sets</Copy></Card>; }) : <Empty title={state.history.length ? 'No workouts in this period' : 'No completed workouts yet'} detail={state.history.length ? 'Try another time filter to see your training.' : 'Complete a workout and your history will appear here.'} />}</Screen>;
}

export function WorkoutHistoryDetailsScreen({ id }: { id: string }) {
  const { state } = useSteadiifit(); const item = state.history.find(entry => entry.id === id);
  if (!item) return <Screen><TopBar title="Workout details" /><Empty title="Workout not found" detail="This session is not in your history." /></Screen>;
  const stats = calculateWorkoutStats(item, state.units); const sourceUnit = item.units ?? 'kg'; const prs = item.personalRecords?.map(record => ({ ...record, weight: convertWeight(record.weight, sourceUnit, state.units), workoutId: item.id })) ?? calculatePersonalRecords(state.history, new Date(), state.units).filter(record => record.workoutId === item.id);
  return <Screen><TopBar title="Workout details" /><Heading>{item.name}</Heading><Copy>{formatDate(workoutTimestamp(item))} · {item.duration} min</Copy><View style={s.statsRow}><Stat value={Math.round(stats.volume).toLocaleString()} label={`${state.units} volume`} /><Stat value={`${stats.exerciseCount}`} label="Exercises" /><Stat value={`${stats.completedSets}`} label="Sets" /></View>{prs.length ? <Card style={{ marginTop: 12 }}><Pill green>{prs.length} PERSONAL RECORD{prs.length === 1 ? '' : 'S'}</Pill>{prs.map(record => <Copy key={record.exerciseId} style={{ marginTop: 7 }}>{exerciseById(record.exerciseId).name} · {formatWeight(record.weight, state.units, state.units)} {state.units} × {record.reps}</Copy>)}</Card> : null}<SectionTitle title="Exercises performed" />{item.exercises.map(ex => { const exercise = exerciseById(ex.exerciseId); const unit = /min/i.test(exercise.repRange) ? 'min' : /sec/i.test(exercise.repRange) ? 'sec' : 'reps'; const exerciseVolume = ex.sets.filter(set => set.completed !== false).reduce((total, set) => total + convertWeight(set.weight, sourceUnit, state.units) * set.reps, 0); const isPR = prs.some(record => record.exerciseId === ex.exerciseId); return <Card key={ex.id}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{exercise.name}</Text>{ex.skipped ? <Pill>SKIPPED</Pill> : isPR ? <Pill green>PR</Pill> : null}</View>{ex.sets.length ? ex.sets.map(set => <Copy key={set.id}>Set {set.setNumber} · {set.weight ? `${formatWeight(set.weight, sourceUnit, state.units)} ${state.units}` : 'Bodyweight'} × {set.reps} {unit}</Copy>) : <Copy>{ex.skipped ? 'Skipped during this session' : 'No completed sets'}</Copy>}{exerciseVolume > 0 ? <Copy style={{ marginTop: 7 }}>Exercise volume · {Math.round(exerciseVolume).toLocaleString()} {state.units}</Copy> : null}</Card>; })}<Action title="Repeat workout" onPress={() => item.workoutId.startsWith('exercise-') ? router.push({ pathname: '/exercises/[id]', params: { id: item.workoutId.slice('exercise-'.length) } }) : router.push({ pathname: '/workout/[id]', params: { id: item.workoutId } })} /></Screen>;
}

function FilterChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.filterChoice, selected && s.filterChoiceActive]}><Text style={[s.filterChoiceText, selected && s.filterChoiceTextActive]}>{label}</Text></Pressable>;
}

export function ExerciseLibraryScreen() {
  const params = useLocalSearchParams<{ mode?: string; planDay?: string; exerciseIndex?: string }>(); const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const rawPlanDay = Array.isArray(params.planDay) ? params.planDay[0] : params.planDay; const planDayIndex = rawPlanDay !== undefined && Number.isInteger(Number(rawPlanDay)) ? Number(rawPlanDay) : null;
  const rawExerciseIndex = Array.isArray(params.exerciseIndex) ? params.exerciseIndex[0] : params.exerciseIndex; const planExerciseIndex = rawExerciseIndex !== undefined && Number.isInteger(Number(rawExerciseIndex)) ? Number(rawExerciseIndex) : -1;
  const selectionMode = mode === 'replace' || mode === 'add';
  const { state, toggleFavorite, replaceExercise, addExercise, replacePlanExercise, addPlanExercise } = useSteadiifit();
  const planDay = planDayIndex === null ? undefined : state.plan[planDayIndex]; const planned = planDay ? plannedExercises(planDay) : [];
  const sessionExercise = state.activeWorkout?.exercises[state.activeWorkout.exerciseIndex];
  const activeCurrentId = sessionExercise?.exerciseId; const planCurrentId = mode === 'replace' ? planned[planExerciseIndex]?.exerciseId : undefined; const currentId = planCurrentId ?? activeCurrentId;
  const currentMuscle = currentId ? exerciseById(currentId).muscle : '';
  const planSelection = planDayIndex !== null && Boolean(planDay);
  const [query, setQuery] = useState(''); const [muscle, setMuscle] = useState(mode === 'replace' ? currentMuscle : ''); const [equipment, setEquipment] = useState('');
  const [difficulty, setDifficulty] = useState(''); const [category, setCategory] = useState(''); const [favoritesOnly, setFavoritesOnly] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false);
  const muscles = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core'];
  const equipmentOptions = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Resistance Band'];
  const difficulties: ExerciseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];
  const categories: ExerciseCategory[] = ['Strength', 'Cardio', 'Flexibility', 'Core'];
  const currentSession = state.activeWorkout; const currentExercise = currentSession?.exercises[currentSession.exerciseIndex];
  const matches = exercises.filter(item => {
    const needle = query.trim().toLowerCase();
    const searchable = [item.name, ...item.primaryMuscles, ...item.secondaryMuscles, item.equipment, item.category].join(' ').toLowerCase();
    const alreadyInSession = Boolean(currentSession?.exercises.some(entry => entry.exerciseId === item.id)); const alreadyInPlan = planned.some(entry => entry.exerciseId === item.id);
    const sameAsCurrent = currentId === item.id;
    const sharesTargetMuscle = !planSelection || mode !== 'replace' || !currentMuscle || item.primaryMuscles.includes(currentMuscle) || item.secondaryMuscles.includes(currentMuscle) || exerciseById(currentId).secondaryMuscles.includes(item.muscle);
    const hasAvailableEquipment = !planSelection || equipmentCompatible(item, state.equipment);
    return (!needle || searchable.includes(needle)) && (!muscle || item.primaryMuscles.includes(muscle) || item.secondaryMuscles.includes(muscle)) && (!equipment || item.equipment === equipment) && (!difficulty || item.difficulty === difficulty) && (!category || item.category === category) && (!favoritesOnly || state.favoriteExerciseIds.includes(item.id)) && sharesTargetMuscle && hasAvailableEquipment && !(mode === 'replace' && sameAsCurrent) && !(mode === 'add' && (planSelection ? alreadyInPlan : alreadyInSession));
  }).sort((a, b) => {
    if (!planSelection || mode !== 'add' || !planDay) return 0;
    const targetMuscles = planDayFocus(planDay).split(', ').filter(Boolean);
    const relevance = (item: typeof a) => item.primaryMuscles.reduce((score, itemMuscle) => score + (targetMuscles.includes(itemMuscle) ? 3 : 0), 0) + item.secondaryMuscles.reduce((score, itemMuscle) => score + (targetMuscles.includes(itemMuscle) ? 1 : 0), 0);
    return relevance(b) - relevance(a);
  });
  const activeFilterCount = [muscle, equipment, difficulty, category].filter(Boolean).length;
  const clearFilters = () => { setQuery(''); setMuscle(''); setEquipment(''); setDifficulty(''); setCategory(''); setFavoritesOnly(false); };
  const selectExercise = (exerciseId: string) => {
    if (mode === 'replace' && planSelection) replacePlanExercise(planDayIndex!, planExerciseIndex, exerciseId);
    else if (mode === 'add' && planSelection) addPlanExercise(planDayIndex!, exerciseId);
    else if (mode === 'replace') replaceExercise(exerciseId);
    else if (mode === 'add') addExercise(exerciseId);
    router.back();
  };
  return <Screen>
    <TopBar title="Exercises" right={<Text style={s.favoriteCount}>{state.favoriteExerciseIds.length} saved</Text>} />
    {selectionMode ? <><Eyebrow>{mode === 'replace' ? 'REPLACE PLANNED MOVEMENT' : planSelection ? 'ADD TO PLANNED WORKOUT' : 'ADD TO THIS WORKOUT'}</Eyebrow><Heading size={23}>{mode === 'replace' ? `Replace ${currentId ? exerciseById(currentId).name : 'exercise'}` : 'Choose an exercise'}</Heading><Copy>{planSelection ? `Options are limited to ${state.equipment} equipment${mode === 'replace' && currentMuscle ? ` and movements for ${currentMuscle.toLowerCase()}` : ''}.` : mode === 'replace' ? 'Choose a movement to take its place. Your other sets stay saved.' : 'Your new movement will be added to the end of this session.'}</Copy></> : <><Heading>Exercises</Heading><Copy>Explore {exercises.length} movements and find the right fit.</Copy></>}
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
  const exercise = exercises.find(item => item.id === id); const { state, toggleFavorite, startSingleExercise, replaceExercise } = useSteadiifit();
  if (!exercise) return <Screen><TopBar title="Exercise details" /><Empty title="Exercise not found" detail="This movement is not in the exercise library." /><Action title="Browse exercises" onPress={() => router.replace('/exercises')} /></Screen>;
  const previous = state.history.find(session => session.exercises.some(item => item.exerciseId === exercise.id && item.sets.length > 0));
  const previousExercise = previous?.exercises.find(item => item.exerciseId === exercise.id && item.sets.length > 0);
  const previousSets = previousExercise?.sets ?? [];
  const previousUnit = previous?.units ?? 'kg';
  const bestWeight = previousSets.reduce((best, set) => Math.max(best, convertWeight(set.weight, previousUnit, state.units)), 0);
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
    <SectionTitle title="Previous performance" />{previous && previousExercise ? <Card><Eyebrow>LAST PERFORMANCE · {previous.date.toUpperCase()}</Eyebrow>{previousSets.map((set, index) => <Text key={`${previous.id}-${index}`} style={s.performanceSet}>{set.weight ? `${formatWeight(set.weight, previousUnit, state.units)} ${state.units}` : 'Bodyweight'} × {set.reps} {exercise.repRange.toLowerCase().includes('min') ? 'min' : exercise.repRange.toLowerCase().includes('sec') ? 'sec' : 'reps'}</Text>)}<View style={s.performanceMeta}><Copy>Best weight  <Text style={s.performanceValue}>{bestWeight ? `${formatWeight(bestWeight, state.units, state.units)} ${state.units}` : 'Bodyweight'}</Text></Copy><Copy>Best {exercise.repRange.toLowerCase().includes('min') ? 'time' : exercise.repRange.toLowerCase().includes('sec') ? 'hold' : 'reps'}  <Text style={s.performanceValue}>{bestReps}{exercise.repRange.toLowerCase().includes('min') ? ' min' : exercise.repRange.toLowerCase().includes('sec') ? ' sec' : ''}</Text></Copy></View><Copy style={{ marginTop: 8 }}>Last trained {previous.date}</Copy></Card> : <Empty title="No previous performance" detail="Complete this exercise to start tracking your progress." />}
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
      <SectionTitle title="Recent activity" action="History" onPress={() => router.push('/history')} />{recent.map(item => { const stats = calculateWorkoutStats(item, state.units); return <Card key={item.id} onPress={() => openHistoryItem(item.id)}><Text style={s.cardTitle}>{item.name}</Text><Copy>{formatDate(workoutTimestamp(item, now))} · {item.duration} min · {stats.exerciseCount} exercises</Copy><Copy style={{ marginTop: 4 }}>{Math.round(stats.volume).toLocaleString()} {state.units} volume</Copy></Card>; })}
      <SectionTitle title="Strength progress" />{exercisesWithHistory.length ? exercisesWithHistory.map(id => { const exercise = exerciseById(id); const progress = calculateExerciseProgress(state.history, id, now, state.units); if (!progress) return null; return <Card key={id} onPress={() => router.push({ pathname: '/progress/exercise/[id]', params: { id } })}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{exercise.name}</Text><Text style={s.linkArrow}>›</Text></View><Copy>Best · {progress.bestWeight > 0 ? `${progress.bestWeight.toFixed(1).replace(/\.0$/, '')} ${state.units}` : 'Bodyweight'} × {progress.bestReps} reps</Copy><Copy style={{ marginTop: 4 }}>{progress.sessions} sessions · {Math.round(progress.totalVolume).toLocaleString()} {state.units} volume · Last {formatDate(progress.lastPerformed)}</Copy></Card>; }) : <Empty title="No performance data yet" detail="Logged exercise performances will be tracked here." />}
      <SectionTitle title="Personal records" />{records.length ? records.map(record => <Card key={record.exerciseId}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{exerciseById(record.exerciseId).name}</Text><Pill green>BEST</Pill></View><Copy>{formatWeight(record.weight, state.units, state.units)} {state.units} × {record.reps} reps · {formatDate(record.date)}</Copy></Card>) : <Empty title="No records yet" detail="Complete a weighted set to establish your first personal record." />}
    </>}
    <SectionTitle title="Body weight" action="View" onPress={() => router.push('/progress/body-weight')} /><Card onPress={() => router.push('/progress/body-weight')}><Text style={s.cardTitle}>{currentWeight ? `${formatWeight(currentWeight.weight, currentWeight.units, state.units)} ${state.units}` : 'No weight entries yet'}</Text><Copy>{currentWeight ? change === null ? 'Current body weight · log another entry to see a change' : `${change > 0 ? '+' : ''}${formatWeight(change, currentWeight.units, state.units)} ${state.units} since previous entry` : 'Log a body weight to start your personal trend.'}</Copy></Card>
    <Action title="Workout history" secondary onPress={() => router.push('/history')} />
  </Screen>;
}

export function ExerciseProgressScreen({ id }: { id: string }) {
  const { state } = useSteadiifit(); const exercise = exercises.find(item => item.id === id); const now = new Date(); const progress = calculateExerciseProgress(state.history, id, now, state.units);
  if (!exercise) return <Screen><TopBar title="Exercise progress" /><Empty title="Exercise not found" detail="This movement is not in the exercise library." /><Action title="Browse exercises" onPress={() => router.replace('/exercises')} /></Screen>;
  if (!progress) return <Screen><TopBar title="Exercise progress" /><Heading>{exercise.name}</Heading><Empty title="No performance data yet" detail="Complete this exercise in a workout and its progress will appear here." /></Screen>;
  const weighted = progress.points.some(point => point.weight > 0); const values = progress.points.map(point => weighted ? point.weight : point.reps); const max = Math.max(...values, 1); const floor = Math.min(...values);
  return <Screen><TopBar title="Exercise progress" /><Eyebrow>STRENGTH PROGRESS</Eyebrow><Heading>{exercise.name}</Heading><Copy>Performance from your completed workout history.</Copy><Card style={{ marginTop: 14 }}><Eyebrow>{weighted ? 'PERSONAL RECORD' : 'BEST PERFORMANCE'}</Eyebrow><Text style={s.chartValue}>{progress.bestWeight > 0 ? `${formatWeight(progress.bestWeight, state.units, state.units)} ${state.units}` : 'Bodyweight'} × {progress.bestReps} reps</Text><Copy>{weighted ? 'Best completed weight and reps' : 'Highest completed reps'}</Copy><View style={s.chartArea}>{progress.points.slice(-8).map((point, index) => { const value = weighted ? point.weight : point.reps; const height = max === floor ? 42 : Math.max(18, Math.round((value / max) * 105)); return <View key={`${point.date}-${index}`} style={s.chartColumn}><Text style={s.chartPoint}>{weighted ? formatWeight(value, state.units, state.units) : `${value}r`}</Text><View style={[s.chartBar, { height }]} /><Text style={s.chartDate}>{new Date(point.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</Text></View>; })}</View><Copy style={{ marginTop: 6 }}>{weighted ? `Weight per session · ${state.units}` : 'Reps per session'}</Copy></Card><View style={s.progressGrid}><ProgressStat label="Sessions" value={`${progress.sessions}`} /><ProgressStat label="Total volume" value={`${Math.round(progress.totalVolume).toLocaleString()} ${state.units}`} /><ProgressStat label="Last performed" value={formatDate(progress.lastPerformed)} /><ProgressStat label="Best reps" value={`${progress.bestReps}`} /></View><SectionTitle title="Session history" />{progress.points.slice().reverse().map((point, index) => <Card key={`${point.date}-${index}`}><Text style={s.cardTitle}>{formatDate(point.date)}</Text><Copy>{point.weight > 0 ? `${formatWeight(point.weight, state.units, state.units)} ${state.units}` : 'Bodyweight'} × {point.reps} reps · {Math.round(point.volume).toLocaleString()} {state.units} volume</Copy></Card>)}</Screen>;
}

export function BodyWeightScreen() {
  const { state, logBodyWeight } = useSteadiifit(); const [value, setValue] = useState(''); const entries = sortedBodyWeight(state.bodyWeightEntries); const change = bodyWeightChange(entries);
  const save = () => { const weight = Number(value.replace(',', '.')); if (!Number.isFinite(weight) || weight <= 0) return; logBodyWeight(weight); setValue(''); };
  return <Screen><TopBar title="Body weight" /><Heading>Body weight</Heading><Copy>Track your check-ins over time. Values are shown in your selected unit.</Copy>{entries[0] ? <Card style={{ marginTop: 12 }}><Eyebrow>CURRENT</Eyebrow><Text style={s.chartValue}>{formatWeight(entries[0].weight, entries[0].units, state.units)} {state.units}</Text><Copy>{change === null ? 'Log another entry to see your change.' : `${change > 0 ? '+' : ''}${formatWeight(change, entries[0].units, state.units)} ${state.units} since your previous entry`}</Copy></Card> : <Empty title="No weight entries yet" detail="Log your first check-in to start a personal body weight history." />}<SectionTitle title="Log a weight" /><TextInput accessibilityLabel={`Body weight in ${state.units}`} keyboardType="decimal-pad" value={value} onChangeText={setValue} placeholder={`Weight in ${state.units}`} placeholderTextColor={C.muted} style={uiStyles.input} /><Action title="Save weight" disabled={!Number.isFinite(Number(value.replace(',', '.'))) || Number(value.replace(',', '.')) <= 0} onPress={save} /><SectionTitle title="Previous entries" />{entries.length ? entries.map(entry => <Card key={entry.id}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{formatDate(entry.recordedAt)}</Text><Text style={s.weightValue}>{formatWeight(entry.weight, entry.units, state.units)} {state.units}</Text></View></Card>) : <Empty title="Nothing logged yet" detail="Your previous entries will be listed here." />}</Screen>;
}

function ProgressStat({ label, value }: { label: string; value: string }) { return <View style={s.progressStat}><Text style={s.progressStatValue} numberOfLines={1}>{value}</Text><Text style={s.progressStatLabel}>{label}</Text></View>; }
function formatDate(timestamp: number) { return timestamp ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : 'Date unavailable'; }

const meals: FoodMeal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const numberValue = (value: string) => Number(value.trim().replace(',', '.'));
const displayNumber = (value: number) => Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1).replace(/\.0$/, '');

export function NutritionScreen() {
  const { state, removeFood } = useSteadiifit();
  const entries = state.foodEntries.filter(item => { const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; return item.date === date; });
  const totals = nutritionTotals(state.foodEntries); const targets = estimateNutritionTargets(state.bodyWeightEntries, state.goal, state.frequency);
  const macro = (label: string, value: number, target: number | undefined, tint: string) => <View key={label} style={s.macroCard}><View style={s.macroHead}><Text style={s.cardTitle}>{label}</Text><Text style={s.macroTotal}>{displayNumber(value)}g{target ? ` / ${target}g` : ''}</Text></View><View style={s.macroTrack}><View style={[s.macroFill, { backgroundColor: tint, width: `${target ? Math.min(100, Math.round(value / target * 100)) : value ? 100 : 0}%` }]} /></View><Copy style={s.macroRemaining}>{target ? value >= target ? 'Target reached' : `${displayNumber(target - value)}g remaining` : 'Target unavailable'}</Copy></View>;
  const insights = !entries.length ? ['You haven’t logged any food today.'] : [targets ? totals.protein >= targets.protein ? 'Protein target completed.' : `You're ${displayNumber(targets.protein - totals.protein)}g away from your protein target.` : 'Add body weight in Progress to see rough estimated targets.', `You've logged ${totals.meals} ${totals.meals === 1 ? 'food item' : 'food items'} today.`];
  return <Screen><TopBar title="Nutrition" right={<Pressable accessibilityRole="button" onPress={() => router.push('/coach')}><Text style={s.nutritionCoachLink}>Coach</Text></Pressable>} /><Eyebrow>TODAY · ESTIMATED TARGETS</Eyebrow><Heading>Nutrition</Heading>
    {!entries.length ? <Empty title="Start tracking your nutrition" detail="Log your meals to see calories and macros here." /> : null}
    <Card style={s.calorieCard}><View style={s.calorieHeading}><View><Eyebrow>CALORIES CONSUMED</Eyebrow><Text style={s.calorieValue}>{totals.calories.toLocaleString()}<Text style={s.calorieTarget}>{targets ? ` / ${targets.calories.toLocaleString()} kcal` : ' kcal'}</Text></Text></View><Text style={s.calorieGlyph}>◒</Text></View><View style={s.calorieTrack}><View style={[s.calorieFill, { width: `${targets ? Math.min(100, totals.calories / targets.calories * 100) : 0}%` }]} /></View><Copy style={{ marginTop: 9 }}>{targets ? `${Math.max(0, targets.calories - totals.calories).toLocaleString()} kcal to estimated daily target` : 'Add body weight to get a rough estimated daily target.'}</Copy></Card>
    <View style={s.macroGrid}>{macro('Protein', totals.protein, targets?.protein, C.accent)}{macro('Carbs', totals.carbs, targets?.carbs, C.green)}{macro('Fat', totals.fat, targets?.fat, '#9A8061')}</View>
    {!targets ? <Card style={s.targetNote}><Text style={s.cardTitle}>Set up an estimate</Text><Copy>Targets use your latest body-weight entry, goal, and training frequency. They’re rough estimates, not medical advice.</Copy><Action title="Add body weight" secondary onPress={() => router.push('/progress/body-weight')} /></Card> : <Copy style={s.targetDisclaimer}>Rough estimate based on body weight, goal, and training frequency — not a medical recommendation.</Copy>}
    <SectionTitle title="Today's meals" action="Log food" onPress={() => router.push('/nutrition/add')} />
    {meals.map(meal => { const mealEntries = entries.filter(entry => entry.meal === meal); if (!mealEntries.length) return null; return <View key={meal}><Text style={s.mealTitle}>{meal}</Text>{mealEntries.map(entry => <Card key={entry.id} style={s.foodCard}><View style={s.foodRow}><View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{entry.name}</Text><Copy>{entry.calories} kcal · P {displayNumber(entry.protein)}g · C {displayNumber(entry.carbs)}g · F {displayNumber(entry.fat)}g</Copy></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.name}`} onPress={() => removeFood(entry.id)} hitSlop={10}><Text style={s.removeFood}>×</Text></Pressable></View></Card>)}</View>; })}
    {entries.length ? <Action title="Log food" secondary onPress={() => router.push('/nutrition/add')} /> : <Action title="Log Food" onPress={() => router.push('/nutrition/add')} />}
    <SectionTitle title="Nutrition insights" />{insights.map((insight, index) => <Card key={index} style={s.insightCard}><Text style={s.insightMark}>✦</Text><Copy style={{ flex: 1 }}>{insight}</Copy></Card>)}
  </Screen>;
}

export function AddFoodScreen() {
  const { addFood } = useSteadiifit();
  const [name, setName] = useState(''); const [meal, setMeal] = useState<FoodMeal>('Breakfast');
  const [fields, setFields] = useState({ calories: '', protein: '', carbs: '', fat: '' }); const [error, setError] = useState('');
  const update = (key: keyof typeof fields, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  const save = () => {
    const values = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() === '' ? 0 : numberValue(value)])) as Record<keyof typeof fields, number>;
    if (!name.trim()) { setError('Enter a food name to continue.'); return; }
    if (Object.values(values).some(value => !Number.isFinite(value) || value < 0)) { setError('Nutrition values must be valid non-negative numbers.'); return; }
    if (values.calories > 10000 || values.protein > 1000 || values.carbs > 1000 || values.fat > 1000) { setError('That value looks unusually high. Check the serving values and try again.'); return; }
    addFood({ name: name.trim(), meal, ...values }); router.replace('/nutrition');
  };
  const valid = name.trim().length > 0 && Object.values(fields).every(value => value.trim() === '' || (Number.isFinite(numberValue(value)) && numberValue(value) >= 0 && !/[eE+-]/.test(value)));
  const field = (label: string, key: keyof typeof fields, unit: string) => <View style={s.foodField}><Text style={s.foodLabel}>{label} <Text style={s.fieldUnit}>({unit})</Text></Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={fields[key]} onChangeText={value => update(key, value)} placeholder="0" placeholderTextColor={C.muted} style={uiStyles.input} maxLength={7} /></View>;
  return <Screen><TopBar title="Add food" /><Eyebrow>FOOD LOG</Eyebrow><Heading>Add a meal</Heading><Copy>Enter the nutrition information for one serving.</Copy><SectionTitle title="Food name" /><TextInput accessibilityLabel="Food name" value={name} onChangeText={setName} placeholder="e.g. Greek yogurt" placeholderTextColor={C.muted} style={uiStyles.input} maxLength={60} />
    <SectionTitle title="Nutrition" /><View style={s.foodFields}>{field('Calories', 'calories', 'kcal')}{field('Protein', 'protein', 'g')}{field('Carbs', 'carbs', 'g')}{field('Fat', 'fat', 'g')}</View>
    <SectionTitle title="Meal" />{meals.map(item => <Option key={item} title={item} selected={meal === item} onPress={() => setMeal(item)} />)}
    {error ? <Copy style={s.formError}>{error}</Copy> : null}<Action title="Save food" disabled={!valid} onPress={save} /><Action title="Cancel" secondary onPress={() => router.back()} />
  </Screen>;
}

const quickPrompts = ["What's my workout today?", 'How is my progress?', 'How much protein do I have left?', 'Explain my plan'];
const coachGreeting = "Hey! I'm your Steadiifit Coach. I can help you understand your workouts, progress, and nutrition. I'm a local demo assistant, not a medical professional.";
export function CoachScreen() {
  const { state, appendCoachMessage, clearCoachMessages } = useSteadiifit();
  const [input, setInput] = useState(''); const [typing, setTyping] = useState(false); const [prompt, setPrompt] = useState(''); const scrollRef = useRef<ScrollView>(null); const responseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (responseTimeout.current) clearTimeout(responseTimeout.current); }, []);
  const submit = (value = input) => { const text = value.trim(); if (!text || typing) return; appendCoachMessage({ role: 'user', text }); setInput(''); setTyping(true); setPrompt(text); responseTimeout.current = setTimeout(() => { appendCoachMessage({ role: 'assistant', text: localCoachResponse(text, state, deriveCoachContext(state)) }); setTyping(false); }, 420); };
  const messages = state.coachMessages;
  return <KeyboardAvoidingView style={s.coachRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
    <View style={s.coachContainer}><TopBar title="AI Coach" right={<Pressable accessibilityRole="button" accessibilityLabel="Clear conversation" onPress={() => { if (responseTimeout.current) clearTimeout(responseTimeout.current); setTyping(false); clearCoachMessages(); }}><Text style={s.coachClear}>Clear</Text></Pressable>} /><Eyebrow>YOUR PERSONAL FITNESS ASSISTANT</Eyebrow><Heading size={25}>AI Coach</Heading><Copy>Answers use your local workouts and tracking.</Copy>
      <View style={s.coachShortcuts}><Pressable onPress={() => router.push('/nutrition')} style={s.coachShortcut}><Text style={s.coachShortcutText}>Nutrition</Text></Pressable><Pressable onPress={() => router.push('/(tabs)/plan')} style={s.coachShortcut}><Text style={s.coachShortcutText}>My Plan</Text></Pressable><Pressable onPress={() => router.push('/(tabs)/progress')} style={s.coachShortcut}><Text style={s.coachShortcutText}>Progress</Text></Pressable></View>
      <ScrollView ref={scrollRef} style={s.chatScroll} contentContainerStyle={s.chatMessages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {!messages.length ? <View style={[s.chatBubble, s.assistantBubble]}><Text style={s.chatText}>{coachGreeting}</Text></View> : messages.map(message => <View key={message.id} style={[s.chatBubble, message.role === 'user' ? s.userBubble : s.assistantBubble]}><Text style={[s.chatText, message.role === 'user' && s.userChatText]}>{message.text}</Text></View>)}
        {typing ? <View accessibilityLabel={`Coach is responding to ${prompt}`} style={[s.chatBubble, s.assistantBubble, s.typingBubble]}><ActivityIndicator size="small" color={C.accent} /><Text style={s.chatTyping}>Thinking locally…</Text></View> : null}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.promptRow}>{quickPrompts.map(item => <Pressable key={item} onPress={() => submit(item)} style={s.promptChip}><Text style={s.promptText}>{item}</Text></Pressable>)}</ScrollView>
      <View style={s.chatInputRow}><TextInput accessibilityLabel="Message your coach" value={input} onChangeText={setInput} onSubmitEditing={() => submit()} returnKeyType="send" placeholder="Ask about your training…" placeholderTextColor={C.muted} style={s.chatInput} multiline maxLength={500} blurOnSubmit /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!input.trim() || typing} onPress={() => submit()} style={[s.sendButton, (!input.trim() || typing) && { opacity: 0.45 }]}><Text style={s.sendButtonText}>↑</Text></Pressable></View>
      <Copy style={s.localNote}>Local demo responses · Not medical advice</Copy>
    </View>
  </KeyboardAvoidingView>;
}

export function ProfileScreen() {
  const { state } = useSteadiifit();
  const latest = sortedBodyWeight(state.bodyWeightEntries)[0];
  const bodyWeight = latest ? `${formatWeight(latest.weight, latest.units, state.units)} ${state.units}` : 'Not logged';
  const summary = `${state.goal} · ${state.frequency} workouts/week`;
  return <Screen><TopBar title="Profile" back={false} right={<Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/profile/edit')} style={s.editProfileButton}><Text style={s.editProfileText}>Edit</Text></Pressable>} />
    <Card style={s.profileHero}><View style={s.profileHeroRow}><View style={s.avatarBig}><Text style={s.avatarLabel}>{(state.name.trim().slice(0, 2) || 'A').toUpperCase()}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Heading size={23} style={s.profileName} numberOfLines={1}>{state.name || 'Athlete'}</Heading><Copy numberOfLines={2}>{summary}</Copy></View></View><Text style={s.profileExperience}>{state.experience} · {state.equipment}</Text></Card>
    <SectionTitle title="Your stats" /><View style={s.profileStats}><ProgressStat label="Workouts" value={`${calculateTotalWorkouts(state.history)}`} /><ProgressStat label="Current streak" value={`${calculateWorkoutStreak(state.history)} days`} /><ProgressStat label="Current plan" value={`${state.frequency} days / wk`} /><ProgressStat label="Body weight" value={bodyWeight} /></View>
    <SectionTitle title="Training" /><Card onPress={() => router.push('/(tabs)/plan')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>My Plan</Text><Copy>{state.goal} · {state.trainingFocus}</Copy></View><Text style={s.chevron}>›</Text></Card>
    <Card onPress={() => router.push('/(tabs)/progress')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Progress & history</Text><Copy>Workouts, strength, and body-weight tracking</Copy></View><Text style={s.chevron}>›</Text></Card>
    <SectionTitle title="Nutrition" /><Card onPress={() => router.push('/nutrition')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Nutrition tracking</Text><Copy>Today’s meals and macro overview</Copy></View><Text style={s.chevron}>›</Text></Card>
    <SectionTitle title="Preferences" /><Card onPress={() => router.push('/profile/edit')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Personalize your plan</Text><Copy>{state.frequency} days · {state.duration} min · {state.equipment}</Copy></View><Text style={s.chevron}>›</Text></Card>
    <SectionTitle title="App" /><Card onPress={() => router.push('/settings')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Settings</Text><Copy>Units, workout behavior, and local data</Copy></View><Text style={s.chevron}>›</Text></Card><Action title="About Steadiifit" secondary onPress={() => router.push('/about')} />
  </Screen>;
}

export function EditProfileScreen() {
  const { state, updateName, regeneratePlan } = useSteadiifit();
  const [name, setName] = useState(state.name); const [goal, setGoal] = useState<Goal>(state.goal); const [experience, setExperience] = useState(state.experience); const [frequency, setFrequency] = useState(state.frequency); const [duration, setDuration] = useState(state.duration); const [equipment, setEquipment] = useState(state.equipment); const [focus, setFocus] = useState<TrainingFocus>(state.trainingFocus);
  const save = () => {
    const changed = goal !== state.goal || experience !== state.experience || frequency !== state.frequency || duration !== state.duration || equipment !== state.equipment || focus !== state.trainingFocus;
    if (changed) regeneratePlan({ goal, experience, frequency, duration, equipment, focus }, name);
    else updateName(name);
    router.back();
  };
  const choices = <T extends string | number,>(title: string, values: T[], selected: T, setValue: (value: T) => void) => <><SectionTitle title={title} />{values.map(value => <Option key={String(value)} title={String(value)} selected={selected === value} onPress={() => setValue(value)} />)}</>;
  return <Screen><TopBar title="Edit profile" /><Eyebrow>PROFILE & PERSONALIZATION</Eyebrow><Heading>Make it yours.</Heading><Copy>These preferences also shape your My Plan. Saving changed training preferences regenerates the week while keeping your workout history.</Copy><SectionTitle title="Name" /><TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} maxLength={40} placeholder="Your name" placeholderTextColor={C.muted} style={uiStyles.input} />
    {choices<Goal>('Fitness goal', ['Build muscle', 'Get stronger', 'Lose fat', 'Stay consistent'], goal, setGoal)}
    {choices<string>('Training experience', ['New to training', 'Some Experience', 'Very Experienced'], experience, setExperience)}
    {choices<number>('Training frequency', [2, 3, 4, 5, 6], frequency, setFrequency)}
    {choices<number>('Workout duration', [30, 45, 60, 75], duration, setDuration)}
    {choices<string>('Equipment', ['Full Gym', 'Dumbbells', 'Barbell', 'Machines', 'Bodyweight', 'Resistance Bands'], equipment, setEquipment)}
    {choices<TrainingFocus>('Training focus', ['Balanced', 'Full Body', 'Upper Body', 'Lower Body', 'Push', 'Pull', 'Legs', 'Strength', 'Hypertrophy'], focus, setFocus)}
    <Action title="Save profile" onPress={save} /><Action title="Cancel" secondary onPress={() => router.back()} />
  </Screen>;
}

type ConfirmAction = { title: string; message: string; confirm: string; onConfirm: () => void };
export function SettingsScreen() {
  const { state, setUnits, updateWorkoutSettings, clearWorkoutHistory, clearNutritionData, resetPlan, resetAppData } = useSteadiifit();
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const confirm = (value: ConfirmAction) => setConfirmation(value);
  const finish = () => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); };
  const toggle = (enabled: boolean) => <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} accessibilityLabel="Automatically start rest timer" onPress={() => updateWorkoutSettings({ autoStartRest: !enabled })} style={[s.switch, enabled && s.switchOn]}><View style={[s.switchThumb, enabled && s.switchThumbOn]} /></Pressable>;
  return <Screen><TopBar title="Settings" /><Eyebrow>YOUR APP, YOUR PREFERENCES</Eyebrow><Heading>Settings</Heading><Copy>Manage the preferences that affect your training experience.</Copy>
    <SectionTitle title="Account" /><Card onPress={() => router.push('/profile/edit')} style={s.settingsRow}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Profile & personalization</Text><Copy>Edit your name and plan preferences</Copy></View><Text style={s.chevron}>›</Text></Card>
    <SectionTitle title="Workout" /><Card><Text style={s.cardTitle}>Units</Text><Copy>Convert weight displays without changing saved workout data.</Copy><View style={s.unitChoiceRow}>{([{ label: 'Metric · kg', unit: 'kg' }, { label: 'Imperial · lb', unit: 'lb' }] as const).map(choice => <Pressable key={choice.unit} accessibilityRole="radio" accessibilityState={{ selected: state.units === choice.unit }} onPress={() => setUnits(choice.unit)} style={[s.unitChoice, state.units === choice.unit && s.unitChoiceActive]}><Text style={[s.unitChoiceText, state.units === choice.unit && s.unitChoiceTextActive]}>{choice.label}</Text></Pressable>)}</View></Card>
    <Card><Text style={s.cardTitle}>Rest timer duration</Text><Copy>Used between sets. You can still adjust or skip each rest.</Copy><View style={s.unitChoiceRow}>{[60, 90, 120].map(seconds => <Pressable key={seconds} accessibilityRole="radio" accessibilityState={{ selected: state.workoutSettings.defaultRestSeconds === seconds }} onPress={() => updateWorkoutSettings({ defaultRestSeconds: seconds })} style={[s.restChoice, state.workoutSettings.defaultRestSeconds === seconds && s.unitChoiceActive]}><Text style={[s.unitChoiceText, state.workoutSettings.defaultRestSeconds === seconds && s.unitChoiceTextActive]}>{seconds}s</Text></Pressable>)}</View></Card>
    <Card style={s.settingsRow}><View style={{ flex: 1, paddingRight: 12 }}><Text style={s.cardTitle}>Automatically start rest timer</Text><Copy>Start countdown after each completed set.</Copy></View>{toggle(state.workoutSettings.autoStartRest)}</Card>
    <SectionTitle title="Local data" /><Copy style={s.dataNotice}>This frontend keeps data in the current app session. It resets on reload; nothing is synced to a server.</Copy>
    <Card><Text style={s.cardTitle}>Reset plan</Text><Copy>Regenerate this week from your current preferences. Workout history and progress are kept.</Copy><Action title="Regenerate plan" secondary onPress={() => confirm({ title: 'Regenerate your plan?', message: 'Your current weekly plan and exercise edits will be replaced using your saved preferences. Workout history will remain.', confirm: 'Regenerate plan', onConfirm: resetPlan })} /></Card>
    <Card><Text style={s.cardTitle}>Clear workout history</Text><Copy>Remove completed workouts and progress calculated from those sessions. Body-weight entries are kept.</Copy><Action title="Clear workout history" secondary onPress={() => confirm({ title: 'Clear workout history?', message: 'This removes all completed workouts from this in-memory app session. Workout statistics and PRs based on them will disappear. Body-weight entries will remain.', confirm: 'Clear history', onConfirm: clearWorkoutHistory })} /></Card>
    <Card><Text style={s.cardTitle}>Clear nutrition data</Text><Copy>Remove all food entries from this app session.</Copy><Action title="Clear nutrition data" secondary onPress={() => confirm({ title: 'Clear nutrition data?', message: 'This removes all logged food from the current in-memory app session.', confirm: 'Clear nutrition', onConfirm: clearNutritionData })} /></Card>
    <Card style={s.resetCard}><Text style={s.cardTitle}>Reset app data</Text><Copy>Return profile, plan, workouts, favorites, body weight, nutrition, chat, and workout settings to the fresh demo state.</Copy><Action title="Reset all app data" secondary onPress={() => confirm({ title: 'Reset all app data?', message: 'This clears all current in-memory app data, including your profile settings, active workout, workout history, body weight, nutrition, favorites, and Coach conversation. The app will return to onboarding. This cannot be undone in the current session.', confirm: 'Reset all data', onConfirm: () => { resetAppData(); router.replace('/onboarding'); } })} /></Card>
    <SectionTitle title="About" /><Card onPress={() => router.push('/about')} style={s.settingsRow}><View style={{ flex: 1 }}><Text style={s.cardTitle}>About Steadiifit</Text><Copy>Version {Constants.expoConfig?.version ?? 'Unavailable'} · Privacy and terms</Copy></View><Text style={s.chevron}>›</Text></Card>
    <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}><View style={s.modalShade}><View style={s.confirmCard}><Eyebrow>PLEASE CONFIRM</Eyebrow><Heading size={22}>{confirmation?.title}</Heading><Copy>{confirmation?.message}</Copy><Pressable accessibilityRole="button" onPress={finish} style={s.destructiveAction}><Text style={s.destructiveText}>{confirmation?.confirm}</Text></Pressable><Action title="Cancel" secondary onPress={() => setConfirmation(null)} /></View></View></Modal>
  </Screen>;
}

export function AboutScreen() {
  const version = Constants.expoConfig?.version;
  return <Screen><TopBar title="About" /><Eyebrow>STEADIIFIT</Eyebrow><Heading>Your personalized fitness companion.</Heading><Copy>A focused place to plan workouts, track progress, and build consistent habits.</Copy><Card style={s.aboutBrand}><Text style={s.brand}>Steadiifit</Text><Copy style={{ marginTop: 8 }}>Version {version ?? 'Unavailable'}</Copy><Copy style={s.aboutFootnote}>Frontend demo · Your app data stays in this session and is not synced.</Copy></Card><SectionTitle title="Privacy" /><Card><Text style={s.cardTitle}>Privacy information</Text><Copy>A privacy policy will be available if cloud services are introduced. This frontend demo does not connect to a backend or sync your data.</Copy></Card><SectionTitle title="Terms" /><Card><Text style={s.cardTitle}>Terms of use</Text><Copy>Terms of use have not been published for this frontend demo.</Copy></Card></Screen>;
}

const s = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: 'space-between', paddingTop: 70, paddingBottom: 24 }, welcomeBrand: { marginTop: 90, gap: 9 },
  progressTrack: { height: 5, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden', marginBottom: 19 }, progressFill: { height: 5, backgroundColor: C.ink },
  loading: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }, brand: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink }, avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, avatarBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, avatarLabel: { color: '#FFF', fontFamily: 'InterBold', fontSize: 16 },
  hero: { backgroundColor: C.ink, borderColor: C.ink, marginTop: 12 }, heroTitle: { color: '#FFF', fontFamily: 'BricolageExtraBold', fontSize: 24, marginTop: 5 }, heroMeta: { color: '#D2CEC3', fontFamily: 'InterRegular', fontSize: 12, marginTop: 5 }, heroStart: { alignItems: 'center', paddingVertical: 9 }, heroStartText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 13 },
  cardTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 5 }, statsRow: { flexDirection: 'row', gap: 8, marginTop: 9 }, stat: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 14 }, statValue: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 }, statLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 3 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }, day: { color: C.muted, fontSize: 11, fontWeight: '700', width: 34 }, chevron: { color: C.muted, fontSize: 22 }, recommend: { backgroundColor: '#FBF7F1', borderColor: '#D8C4AD' }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, chips: { gap: 7, paddingBottom: 12 }, chip: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: C.ink, borderColor: C.ink }, chipText: { color: C.ink, fontSize: 12, fontWeight: '600' }, chipTextActive: { color: '#FFF' }, prescription: { marginTop: 9, color: C.accent, fontSize: 12, fontWeight: '700' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, customizeIcon: { width: 42, height: 42, borderWidth: 1, borderColor: C.line, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface }, customizeIconText: { fontSize: 22, color: C.ink, lineHeight: 24, marginTop: -8 }, planSummary: { marginTop: 16 }, planSummaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, planMeter: { height: 6, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 14 }, planMeterFill: { height: 6, borderRadius: 4, backgroundColor: C.accent }, planDayCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 }, planDayToday: { borderColor: C.accent, backgroundColor: '#FBF7F1' }, planDayRight: { alignItems: 'flex-end', gap: 5 }, planExerciseActions: { flexDirection: 'row', gap: 18, marginTop: 10 }, planExerciseLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, paddingVertical: 4 },
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
  editProfileButton: { minWidth: 54, minHeight: 40, justifyContent: 'center', alignItems: 'flex-end' }, editProfileText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 13, padding: 7 }, profileHero: { marginTop: 6, padding: 18 }, profileHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, profileName: { marginBottom: 3 }, profileExperience: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11, marginTop: 14 }, profileStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, profileLinkCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }, settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  unitChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, unitChoice: { flexGrow: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9 }, unitChoiceActive: { backgroundColor: C.ink, borderColor: C.ink }, unitChoiceText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center' }, unitChoiceTextActive: { color: '#FFF' }, restChoice: { minWidth: 68, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9 }, switch: { width: 52, height: 32, borderRadius: 16, backgroundColor: C.line, padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: C.green }, switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: 'flex-start' }, switchThumbOn: { alignSelf: 'flex-end' }, dataNotice: { fontSize: 12, marginBottom: 10 }, resetCard: { borderColor: '#D8B7A8', backgroundColor: '#FBF5F1' }, confirmCard: { backgroundColor: C.background, padding: 22, paddingBottom: 18, borderRadius: 22, marginHorizontal: 20, width: '90%', maxWidth: 430, alignSelf: 'center' }, destructiveAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A04435', borderRadius: 14, marginTop: 16, marginBottom: 8, paddingHorizontal: 16 }, destructiveText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 14 }, aboutBrand: { marginTop: 20, paddingVertical: 22 }, aboutFootnote: { fontSize: 11, marginTop: 13 },
  macroGrid: { gap: 8 }, macroCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 14 }, macroHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, macroTotal: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, macroTrack: { height: 6, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 5 }, macroFill: { height: 6, borderRadius: 4 }, macroRemaining: { fontSize: 11, marginTop: 7 }, calorieCard: { marginTop: 14, backgroundColor: C.surface }, calorieHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, calorieValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 28, marginTop: 4 }, calorieTarget: { color: C.muted, fontFamily: 'InterRegular', fontSize: 13 }, calorieGlyph: { fontSize: 34, color: C.accent }, calorieTrack: { height: 8, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden', marginTop: 13 }, calorieFill: { height: 8, borderRadius: 5, backgroundColor: C.accent }, targetNote: { marginTop: 10, backgroundColor: '#FBF7F1', borderColor: '#D8C4AD' }, targetDisclaimer: { fontSize: 10, marginTop: 5 }, nutritionCoachLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 13, padding: 6 }, mealTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 17, marginTop: 14, marginBottom: 1 }, foodCard: { paddingVertical: 12 }, foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, removeFood: { color: C.muted, fontSize: 24, paddingHorizontal: 5 }, insightCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13 }, insightMark: { color: C.accent, fontSize: 16 }, foodFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, foodField: { width: '48%', flexGrow: 1 }, foodLabel: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, marginBottom: 5 }, fieldUnit: { color: C.muted, fontFamily: 'InterRegular' }, formError: { color: '#A04435', marginTop: 8 },
  coachRoot: { flex: 1, backgroundColor: C.background }, coachContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 7 }, coachClear: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, padding: 7 }, coachShortcuts: { flexDirection: 'row', gap: 7, marginTop: 12, marginBottom: 9 }, coachShortcut: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7 }, coachShortcutText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, chatScroll: { flex: 1, minHeight: 150 }, chatMessages: { paddingVertical: 8, gap: 9, flexGrow: 1, justifyContent: 'flex-end' }, chatBubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 17 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 5 }, userBubble: { alignSelf: 'flex-end', backgroundColor: C.ink, borderBottomRightRadius: 5 }, chatText: { color: C.ink, fontFamily: 'InterRegular', fontSize: 13, lineHeight: 19 }, userChatText: { color: '#FFF' }, typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 }, chatTyping: { color: C.muted, fontSize: 11 }, promptRow: { gap: 7, paddingVertical: 8 }, promptChip: { borderRadius: 18, backgroundColor: C.wash, paddingHorizontal: 11, paddingVertical: 8 }, promptText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 17, backgroundColor: C.surface, padding: 7 }, chatInput: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 9, paddingTop: 9, paddingBottom: 8, color: C.ink, fontFamily: 'InterRegular', fontSize: 13 }, sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, sendButtonText: { color: '#FFF', fontSize: 23, lineHeight: 25 }, localNote: { textAlign: 'center', fontSize: 9, marginTop: 5 },
});
