import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { ExerciseCategory, ExerciseDifficulty, exerciseById, exercises, PlanDay, workoutById, workouts } from '@/data/catalog';
import { useSteadiifit, Goal, FoodMeal } from '@/state/AppContext';
import { useAuth } from '@/state/AuthContext';
import { SteadiifitColors as C } from '@/constants/theme';
import { Action, Card, Copy, Empty, Eyebrow, Heading, Option, Pill, Screen, SectionTitle, TopBar, uiStyles } from '@/components/steadiifit-ui';
import { PrimaryHeader } from '@/components/PrimaryHeader';
import { BodyText as DesignBodyText, Caption as DesignCaption, Card as DesignCard, PrimaryButton as DesignPrimaryButton, ScreenTitle as DesignScreenTitle, SectionTitle as DesignSectionTitle } from '@/design/components';
import { colors as designColors, radii as designRadii, spacing as designSpacing, typography as designTypography } from '@/design/tokens';
import { ExerciseCard } from '@/components/exercises/ExerciseCard';
import { ExerciseVisual } from '@/components/exercises/ExerciseVisual';
import { ExerciseDisclosure } from '@/components/exercises/ExerciseDisclosure';
import { exerciseVisualForId, exerciseVisualForWorkout } from '@/features/exerciseVisuals';
import { bodyWeightChange, calculateExerciseProgress, calculateMonthlyWorkoutCount, calculatePersonalRecords, calculateTotalVolume, calculateTotalWorkouts, calculateWorkoutStreak, calculateWorkoutStats, sortWorkoutsNewest, sortedBodyWeight, startOfWeek, workoutTimestamp } from '@/features/progress';
import { currentPlanWeek, equipmentCompatible, planDayFocus, planDayName, planDayStatus, planDayDuration, planWeekProgress, plannedExercises, PlanPreferences, TrainingFocus } from '@/features/plan';
import { localDateKey, nutritionTotals, recentFoods } from '@/features/nutrition';
import { calculateNutritionTargets, formatTarget, NutritionTargetValue, targetMidpoint } from '@/features/nutritionTargets';
import { deriveCoachContext, localCoachResponse } from '@/features/coach';
import { convertWeight, formatWeight, WeightUnit } from '@/features/units';
import type { NutritionEntry } from '@/types/domain';

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

function isValidDateOfBirth(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date <= today;
}

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [height, setHeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [units, setUnits] = useState<WeightUnit>('kg');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [experience, setExperience] = useState('');
  const [equipment, setEquipment] = useState('');
  const [frequency, setFrequency] = useState<number | null>(null);
  const { finishOnboarding, state } = useSteadiifit();
  const question = step > 0 ? questions[step - 1] : null;
  const value = question?.key === 'goal' ? goal : question?.key === 'experience' ? experience : question?.key === 'equipment' ? equipment : question?.key === 'frequency' ? frequency : null;
  const heightValue = Number(height.replace(',', '.'));
  const weightValue = Number(currentWeight.replace(',', '.'));
  const heightCm = units === 'lb' ? heightValue * 2.54 : heightValue;
  const weightKg = units === 'lb' ? weightValue / 2.2046226218 : weightValue;
  const aboutValid = isValidDateOfBirth(dateOfBirth) && Number.isFinite(heightCm) && heightCm >= 50 && heightCm <= 280 && Number.isFinite(weightKg) && weightKg > 0 && weightKg <= 500;
  const canContinue = step === 0 ? aboutValid : value !== '' && value !== null;
  const selected = (choice: string) => question?.key === 'frequency' ? value === Number(choice.split(' ')[0]) : value === choice;
  const choose = (choice: string) => {
    if (question?.key === 'goal') setGoal(choice as Goal);
    if (question?.key === 'experience') setExperience(choice);
    if (question?.key === 'equipment') setEquipment(choice);
    if (question?.key === 'frequency') setFrequency(Number(choice.split(' ')[0]));
  };
  const next = () => {
    if (!canContinue) return;
    if (step < questions.length) { setStep(step + 1); return; }
    finishOnboarding({ name: name.trim() || state.name || 'Alex', goal: goal || 'Build muscle', experience, equipment, frequency: frequency || 4,
      dateOfBirth: dateOfBirth.trim(), heightCm, currentWeight: weightValue, units });
    router.replace('/plan-generated');
  };
  return <Screen>
    <TopBar title={`Getting started · ${step + 1} of 5`} onBack={() => step > 0 ? setStep(step - 1) : router.back()} />
    <View style={s.progressTrack}><View style={[s.progressFill, { width: `${((step + 1) / 5) * 100}%` }]} /></View>
    <Heading>{question?.title ?? 'About You'}</Heading><Copy style={{ marginBottom: 18 }}>We’ll use this to shape a plan that fits your routine.</Copy>
    {step === 0 ? <>
      <Eyebrow>YOUR NAME (OPTIONAL)</Eyebrow><TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor={C.muted} style={uiStyles.input} />
      <Eyebrow>DATE OF BIRTH</Eyebrow><TextInput value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation" style={uiStyles.input} />
      <Eyebrow>{units === 'kg' ? 'HEIGHT (CM)' : 'HEIGHT (IN)'}</Eyebrow><TextInput value={height} onChangeText={setHeight} placeholder={units === 'kg' ? 'e.g. 170' : 'e.g. 67'} placeholderTextColor={C.muted} keyboardType="decimal-pad" style={uiStyles.input} />
      <Eyebrow>{units === 'kg' ? 'CURRENT WEIGHT (KG)' : 'CURRENT WEIGHT (LB)'}</Eyebrow><TextInput value={currentWeight} onChangeText={setCurrentWeight} placeholder={units === 'kg' ? 'e.g. 70' : 'e.g. 154'} placeholderTextColor={C.muted} keyboardType="decimal-pad" style={uiStyles.input} />
      <Eyebrow>UNIT SYSTEM</Eyebrow><View style={{ marginTop: 10 }}><Option title="Metric · kg / cm" selected={units === 'kg'} onPress={() => setUnits('kg')} /><Option title="Imperial · lb / in" selected={units === 'lb'} onPress={() => setUnits('lb')} /></View>
      {!canContinue ? <Copy style={{ marginBottom: 10 }}>Enter a valid past date, height, and weight to continue.</Copy> : null}
    </> : null}
    {question?.choices.map(choice => <Option key={choice} title={choice} selected={selected(choice)} onPress={() => choose(choice)} />)}
    <View style={{ flex: 1, minHeight: 16 }} />
    <Action title={step < 4 ? 'Continue' : 'Generate my plan'} disabled={!canContinue} onPress={next} />
  </Screen>;
}

export function PlanGeneratedScreen() {
  React.useEffect(() => { const timeout = setTimeout(() => router.replace('/(tabs)/home'), 1300); return () => clearTimeout(timeout); }, []);
  return <View style={s.loading}><ActivityIndicator color={C.accent} size="large" /><Heading size={24}>Building your plan…</Heading><Copy>{`Your first week is coming together.`}</Copy></View>;
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }

export function TrainScreen() {
  const { state } = useSteadiifit();
  const { width } = useWindowDimensions();
  const compact = width < 430;
  const now = new Date();
  const today = (now.getDay() + 6) % 7;
  const [selectedWeekday, setSelectedWeekday] = useState(today);
  const selectedPlanDay = state.plan.find(day => day.weekday === selectedWeekday);
  const selectedIsToday = selectedWeekday === today;
  const selectedStatus = selectedPlanDay ? planDayStatus(selectedPlanDay, state.history) : undefined;
  const selectedIsActive = Boolean(selectedIsToday && state.activeWorkout);
  const selectedExercises = selectedPlanDay?.workoutId ? plannedExercises(selectedPlanDay) : [];
  const futureWorkout = state.plan
    .filter(day => day.workoutId && day.weekday > selectedWeekday)
    .sort((a, b) => a.weekday - b.weekday)[0];
  const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayName = (weekdayIndex: number) => new Date(2024, 0, 1 + weekdayIndex).toLocaleDateString('en-US', { weekday: 'long' });
  const selectedTitle = selectedPlanDay?.workoutId ? planDayName(selectedPlanDay) : selectedPlanDay ? 'Rest and recover' : 'No weekly plan';
  const selectedDetail = selectedPlanDay?.workoutId
    ? `${selectedExercises.length} exercises · ~${planDayDuration(selectedPlanDay)} min`
    : selectedPlanDay
      ? 'Recovery day'
      : 'Set up a plan to organize your training week.';
  const selectedAction = () => {
    if (selectedIsActive && state.activeWorkout) router.push({ pathname: '/active/[id]', params: { id: state.activeWorkout.workoutId } });
    else if (selectedPlanDay?.workoutId) router.push({ pathname: '/plan/day/[day]', params: { day: String(selectedPlanDay.weekday) } });
    else if (selectedPlanDay) router.push('/(tabs)/plan');
    else router.push('/plan/customize');
  };
  const selectedActionLabel = selectedIsActive ? 'Resume workout' : selectedPlanDay?.workoutId ? 'View workout' : selectedPlanDay ? 'View plan' : 'Set up plan';
  const todayPlanDay = state.plan.find(day => day.weekday === today);
  const activeWorkout = state.activeWorkout;
  const todayStatus = todayPlanDay?.workoutId ? planDayStatus(todayPlanDay, state.history, now) : undefined;
  const activeTemplate = activeWorkout ? workouts.find(item => item.id === activeWorkout.workoutId) : undefined;
  const heroEyebrow = activeWorkout ? 'Workout in progress' : todayPlanDay?.workoutId ? todayStatus === 'Completed' ? 'Completed today' : 'Today’s workout' : todayPlanDay ? 'Recovery day' : state.plan.length ? 'Plan ready' : 'Plan not set';
  const heroTitle = activeWorkout ? activeWorkout.workoutName || 'Workout in progress' : todayPlanDay?.workoutId ? planDayName(todayPlanDay) : todayPlanDay ? 'Rest and recover' : 'Plan your training';
  const heroMeta = activeWorkout
    ? `${activeTemplate?.focus ?? 'Session in progress'} · ${activeTemplate?.duration ?? 0} min · ${activeWorkout.exercises.length} exercises`
    : todayPlanDay?.workoutId
      ? `${planDayFocus(todayPlanDay)} · ${planDayDuration(todayPlanDay)} min · ${plannedExercises(todayPlanDay).length} exercises`
      : todayPlanDay
        ? 'Recovery day built into your weekly schedule.'
        : !state.plan.length
          ? 'Set up your weekly plan to start training.'
          : 'No workout scheduled for today.';
  const heroActionLabel = activeWorkout ? 'Resume workout' : todayPlanDay?.workoutId && todayStatus !== 'Completed' ? 'Start workout' : todayPlanDay?.workoutId ? 'Review workout' : todayPlanDay ? 'View plan' : state.plan.length ? 'View training plan' : 'Set up plan';
  const heroActionAccessibilityLabel = activeWorkout ? 'Resume active workout' : todayPlanDay?.workoutId && todayStatus !== 'Completed' ? 'Start today’s workout' : todayPlanDay?.workoutId ? 'Review today’s workout' : todayPlanDay ? 'View today’s plan' : state.plan.length ? 'View training plan' : 'Set up plan';
  const heroWorkoutAction = () => {
    if (activeWorkout) {
      router.push({ pathname: '/active/[id]', params: { id: activeWorkout.workoutId } });
    } else if (todayPlanDay?.workoutId && todayStatus !== 'Completed') {
      const id = state.plan.find(day => day.weekday === today)?.workoutId ? workouts.find(item => item.id === state.plan.find(day => day.weekday === today)?.workoutId)?.id : undefined;
      if (id) router.push({ pathname: '/active/[id]', params: { id } });
    } else if (todayPlanDay) {
      router.push({ pathname: '/plan/day/[day]', params: { day: String(todayPlanDay.weekday) } });
    } else if (state.plan.length) {
      router.push('/(tabs)/plan');
    } else {
      router.push('/plan/customize');
    }
  };
  const heroExerciseId = activeWorkout
    ? activeWorkout.exercises[activeWorkout.exerciseIndex]?.exerciseId
    : todayPlanDay?.workoutId
      ? exerciseVisualForWorkout(workoutById(todayPlanDay.workoutId))?.exerciseId
      : undefined;
  const heroVisual = exerciseVisualForId(heroExerciseId);
  const weekStart = startOfWeek(new Date());
  const destinations = [
    { title: 'My Plan', detail: 'Weekly structure', route: '/(tabs)/plan' as const, symbol: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
    { title: 'Workouts', detail: 'Browse sessions', route: '/(tabs)/workouts' as const, symbol: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' } },
    { title: 'Exercise Library', detail: 'Find movements', route: '/exercises' as const, symbol: { ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' } },
  ] as const;
  return <Screen style={n.trainScreen}>
    <PrimaryHeader title="Train" />
    <View style={n.trainPageContent}>
      <View style={n.section}>
        <View style={n.sectionHeading}>
          <DesignSectionTitle style={n.sectionTitle}>Today’s workout</DesignSectionTitle>
          {todayPlanDay?.workoutId ? <Pressable accessibilityRole="button" accessibilityLabel="Open today’s plan" onPress={() => router.push({ pathname: '/plan/day/[day]', params: { day: String(todayPlanDay.weekday) } })} style={n.sectionAction}>
            <Text style={n.sectionActionText}>Plan</Text>
          </Pressable> : null}
        </View>
        <DesignCard style={[n.heroCard, compact && n.heroCardCompact]}>
          <View style={[n.heroTop, compact && n.heroTopCompact]}>
            <View style={n.heroCopy}>
              {heroEyebrow !== 'Today’s workout' ? <DesignCaption style={n.heroEyebrow}>{heroEyebrow}</DesignCaption> : null}
              <Text style={n.heroTitle}>{heroTitle}</Text>
              <Text style={n.heroMeta}>{heroMeta}</Text>
            </View>
            {heroVisual ? <View style={[n.heroVisual, compact && n.heroVisualCompact]}>
              <ExerciseVisual exerciseId={heroVisual.exerciseId} style={n.heroVisualImage} />
            </View> : null}
          </View>
          <View style={n.heroActionWrap}>
            <DesignPrimaryButton accessibilityLabel={heroActionAccessibilityLabel} onPress={heroWorkoutAction}>
              {heroActionLabel}
            </DesignPrimaryButton>
          </View>
        </DesignCard>
      </View>

      <View style={n.section}>
        <View style={n.sectionHeading}>
          <DesignSectionTitle style={n.sectionTitle}>Week overview</DesignSectionTitle>
          <Text style={n.sectionMeta}>This week</Text>
        </View>
        {state.plan.length ? <>
          <View style={n.weekSelector}>
            {weekdayLabels.map((label, weekdayIndex) => {
              const day = state.plan.find(item => item.weekday === weekdayIndex);
              const status = day ? planDayStatus(day, state.history) : undefined;
              const active = Boolean(day?.workoutId && weekdayIndex === today && state.activeWorkout);
              const completed = status === 'Completed';
              const current = weekdayIndex === today;
              let mark = '•';
              if (active) mark = '●';
              else if (completed) mark = '✓';
              else if (status === 'Skipped') mark = '×';
              else if (day?.workoutId) mark = current ? '●' : '○';
              else if (day) mark = '—';
              return <Pressable key={weekdayIndex} accessibilityRole="button" accessibilityLabel={`${dayName(weekdayIndex)}${day?.workoutId ? `, ${planDayName(day)}` : day ? ', rest day' : ', unplanned'}`} accessibilityState={{ selected: selectedWeekday === weekdayIndex }} onPress={() => setSelectedWeekday(weekdayIndex)} style={[n.weekDayChoice, current && n.weekDayChoiceToday, completed && n.weekDayChoiceCompleted, status === 'Rest' && n.weekDayChoiceRest, selectedWeekday === weekdayIndex && n.weekDayChoiceSelected]}>
                <Text style={[n.weekDayName, selectedWeekday === weekdayIndex && n.weekDayTextSelected]}>{label}</Text>
                <Text style={[n.weekDayNumber, selectedWeekday === weekdayIndex && n.weekDayTextSelected]}>{new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + weekdayIndex).getDate()}</Text>
                <View style={[n.weekDayIndicator, current && n.weekDayIndicatorToday, completed && n.weekDayIndicatorCompleted, selectedWeekday === weekdayIndex && n.weekDayIndicatorSelected]}><Text style={[n.weekDayMarkText, completed && n.weekDayMarkCompleted, selectedWeekday === weekdayIndex && n.weekDayTextSelected]}>{mark}</Text></View>
              </Pressable>;
            })}
          </View>
          {!selectedIsToday ? <View style={n.selectedDayPanel}>
            <View style={n.selectedDayText}>
              <DesignCaption style={n.selectedDayEyebrow}>{dayName(selectedWeekday).toUpperCase()}{selectedStatus === 'Completed' ? ' · COMPLETED' : ''}</DesignCaption>
              <Text style={n.selectedDayTitle}>{selectedTitle}</Text>
              <Text style={n.selectedDayMeta}>{selectedStatus === 'Completed' ? `Completed${futureWorkout ? ` · next ${planDayName(futureWorkout)}` : ''}` : selectedStatus === 'Skipped' ? `Not completed · ${selectedDetail}` : selectedDetail}</Text>
            </View>
            <DesignPrimaryButton accessibilityLabel={selectedActionLabel} onPress={selectedAction}>
              {selectedActionLabel}
            </DesignPrimaryButton>
          </View> : null}
        </> : <View style={n.emptyState}><Text style={n.emptyTitle}>No weekly plan yet</Text><Text style={n.emptyText}>Set up your schedule to start building your training week.</Text><DesignPrimaryButton onPress={() => router.push('/plan/customize')}>Set up plan</DesignPrimaryButton></View>}
      </View>

      <View style={n.section}>
        <View style={n.sectionHeading}>
          <DesignSectionTitle style={n.sectionTitle}>Browse</DesignSectionTitle>
          <Text style={n.sectionMeta}>Explore</Text>
        </View>
        <View style={[n.destinationGroup, compact && n.destinationGroupCompact]}>
          {destinations.map(item => <Pressable key={item.title} accessibilityRole="button" onPress={() => router.push(item.route)} style={[n.destinationTile, compact && n.destinationTileCompact]}>
            <View style={n.destinationIcon}><SymbolView name={item.symbol} size={18} weight="medium" tintColor={C.accent} /></View>
            <View style={n.destinationText}><Text style={n.destinationTitle}>{item.title}</Text><Text numberOfLines={2} style={n.destinationMeta}>{item.detail}</Text></View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={C.accent} />
          </Pressable>)}
        </View>
      </View>

    </View>
  </Screen>;
}

export function HomeScreen() {
  const { state, personalInformation, startPlanWorkout } = useSteadiifit();
  const now = new Date();
  const nutrition = nutritionTotals(state.foodEntries);
  const nutritionTargets = calculateNutritionTargets({ dateOfBirth: personalInformation.dateOfBirth, heightCm: personalInformation.heightCm,
    bodyWeightEntries: state.bodyWeightEntries, goal: state.goal, trainingFrequency: state.frequency,
    workoutDurationMinutes: state.duration, trainingFocus: state.trainingFocus }).targets;
  const today = (now.getDay() + 6) % 7;
  const todayPlanIndex = state.plan.findIndex(day => day.weekday === today);
  const todayPlanDay = todayPlanIndex >= 0 ? state.plan[todayPlanIndex] : undefined;
  const nextPlanDay = Array.from({ length: 7 }, (_, offset) => state.plan.find(day => day.weekday === (today + offset + 1) % 7 && day.workoutId)).find(Boolean);
  const activeWorkout = state.activeWorkout;
  const activeTemplate = activeWorkout ? workouts.find(item => item.id === activeWorkout.workoutId) : undefined;
  const activeMatchesPlan = Boolean(activeWorkout && todayPlanDay?.workoutId === activeWorkout.workoutId);
  const planWorkoutName = todayPlanDay?.workoutId ? planDayName(todayPlanDay) : undefined;
  const workoutName = activeWorkout?.workoutName || planWorkoutName;
  const isRestDay = Boolean(todayPlanDay && !todayPlanDay.workoutId && !activeWorkout);
  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const exerciseCount = activeWorkout?.exercises.length ?? (todayPlanDay?.workoutId ? plannedExercises(todayPlanDay).length : 0);
  let duration: number | undefined;
  if (activeWorkout && activeMatchesPlan && todayPlanDay) duration = planDayDuration(todayPlanDay);
  else if (activeWorkout) duration = activeTemplate?.duration;
  else if (todayPlanDay?.workoutId) duration = planDayDuration(todayPlanDay);
  const todayStatus = todayPlanDay?.workoutId ? planDayStatus(todayPlanDay, state.history, now) : undefined;
  const heroEyebrow = activeWorkout ? 'WORKOUT IN PROGRESS'
    : todayPlanDay?.workoutId ? todayStatus === 'Completed' ? 'COMPLETED TODAY' : 'TODAY’S WORKOUT'
      : isRestDay ? 'RECOVERY DAY' : state.plan.length ? 'YOUR TRAINING PLAN' : 'PLAN NOT SET UP';
  const heroTitle = activeWorkout ? workoutName
    : todayPlanDay?.workoutId ? planWorkoutName
      : isRestDay ? 'Rest and recover' : 'Plan your training';
  const heroMeta = workoutName
    ? undefined
    : isRestDay && nextPlanDay ? `Next workout · ${new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((nextPlanDay.weekday - today + 7) % 7 || 7)).toLocaleDateString('en-US', { weekday: 'long' })}`
      : isRestDay ? 'Recovery is part of your weekly plan.'
        : !state.plan.length ? 'Set up a weekly plan that fits your routine.'
          : todayPlanDay ? 'Your scheduled session is complete for today.' : 'No workout is scheduled for today.';
  const canStartToday = Boolean(todayPlanDay?.workoutId && todayStatus !== 'Completed');
  const heroActionLabel = activeWorkout ? 'Continue workout  →'
    : canStartToday ? 'Start workout  →'
      : todayPlanDay?.workoutId ? 'Review workout  →'
        : todayPlanDay ? 'View today’s plan  →'
        : state.plan.length ? 'View training plan  →' : 'Set up plan  →';
  const heroActionAccessibilityLabel = activeWorkout ? 'Continue active workout'
    : canStartToday ? 'Start today’s workout'
      : todayPlanDay?.workoutId ? 'Review today’s completed workout'
        : todayPlanDay ? 'View today’s plan' : state.plan.length ? 'View training plan' : 'Set up training plan';
  const startOrContinue = () => {
    if (activeWorkout) {
      router.push({ pathname: '/active/[id]', params: { id: activeWorkout.workoutId } });
    } else if (todayPlanDay?.workoutId && todayStatus !== 'Completed') {
      const id = startPlanWorkout(todayPlanIndex);
      if (id) router.push({ pathname: '/active/[id]', params: { id } });
    } else if (todayPlanDay) {
      router.push({ pathname: '/plan/day/[day]', params: { day: String(todayPlanDay.weekday) } });
    } else if (state.plan.length) {
      router.push('/(tabs)/plan');
    } else {
      router.push('/plan/customize');
    }
  };
  const streak = calculateWorkoutStreak(state.history, now);
  const monthlyWorkouts = calculateMonthlyWorkoutCount(state.history, now);
  const heroExerciseId = activeWorkout
    ? activeWorkout.exercises[activeWorkout.exerciseIndex]?.exerciseId
    : todayPlanDay?.workoutId
      ? exerciseVisualForWorkout(workoutById(todayPlanDay.workoutId))?.exerciseId
      : undefined;
  const heroVisual = exerciseVisualForId(heroExerciseId);
  const recommendationPlanDay = state.plan
    .filter(day => day.workoutId && day.weekday !== today)
    .sort((a, b) => ((a.weekday - today + 7) % 7) - ((b.weekday - today + 7) % 7))[0];
  const recommendationWorkout = recommendationPlanDay?.workoutId ? workoutById(recommendationPlanDay.workoutId) : undefined;
  const showRecommendation = Boolean(
    recommendationWorkout
    && !activeWorkout
    && recommendationPlanDay?.workoutId !== todayPlanDay?.workoutId
    && recommendationPlanDay?.workoutId !== activeTemplate?.id,
  );
  const recommendationVisual = recommendationWorkout ? exerciseVisualForWorkout(recommendationWorkout) : undefined;
  const compactLayout = useWindowDimensions().width < 430;
  return <Screen style={homeStyles.screen}>
    <View style={homeStyles.page}>
      <PrimaryHeader title="SteadiFit" />
      <View style={homeStyles.greeting}>
        <DesignScreenTitle style={homeStyles.greetingTitle}>{greeting}, {state.name || 'there'}</DesignScreenTitle>
        <DesignBodyText style={homeStyles.greetingDate}>{dayLabel}</DesignBodyText>
      </View>

      <View style={homeStyles.workoutSection}>
        <View style={homeStyles.sectionHeading}>
          <DesignSectionTitle style={homeStyles.sectionTitle}>Today’s workout</DesignSectionTitle>
          {todayPlanDay?.workoutId ? <Pressable accessibilityRole="button" accessibilityLabel="Open today’s plan" onPress={() => router.push({ pathname: '/plan/day/[day]', params: { day: String(todayPlanDay.weekday) } })} style={homeStyles.sectionAction}>
            <Text style={homeStyles.sectionActionText}>Plan</Text>
          </Pressable> : null}
        </View>
        <DesignCard style={[homeStyles.workoutCard, compactLayout && homeStyles.workoutCardCompact]}>
          <View style={[homeStyles.workoutTop, compactLayout && homeStyles.workoutTopCompact]}>
            <View style={homeStyles.workoutText}>
              {heroEyebrow !== 'TODAY’S WORKOUT' ? <DesignCaption style={homeStyles.workoutStatus}>{heroEyebrow}</DesignCaption> : null}
              <Text style={homeStyles.workoutTitle}>{heroTitle}</Text>
              <Text style={homeStyles.workoutMeta}>{heroMeta}</Text>
            </View>
            {heroVisual ? <View style={[homeStyles.workoutVisual, compactLayout && homeStyles.workoutVisualCompact]}>
              <ExerciseVisual exerciseId={heroVisual.exerciseId} style={homeStyles.workoutVisualImage} />
            </View> : null}
          </View>
          <View style={homeStyles.workoutMetaRow}>
            {duration ? <Text style={homeStyles.metaPill}>{duration} min</Text> : null}
            {exerciseCount ? <Text style={homeStyles.metaPill}>{exerciseCount} exercises</Text> : null}
          </View>
          <View style={homeStyles.workoutAction}>
            <DesignPrimaryButton accessibilityLabel={heroActionAccessibilityLabel} onPress={startOrContinue}>
              {heroActionLabel.replace('  →', '')}
            </DesignPrimaryButton>
          </View>
        </DesignCard>
      </View>

      <View style={homeStyles.snapshotSection}>
        <View style={homeStyles.sectionHeading}>
          <DesignSectionTitle style={homeStyles.sectionTitle}>Nutrition</DesignSectionTitle>
          <Pressable accessibilityRole="button" accessibilityLabel="Open nutrition details" onPress={() => router.push('/(tabs)/nutrition')} style={homeStyles.sectionAction}>
            <Text style={homeStyles.sectionActionText}>Details</Text>
          </Pressable>
        </View>
        <View style={homeStyles.summaryPanel}>
          <View style={homeStyles.summaryHeader}>
            <Text style={homeStyles.snapshotLabel}>Calories logged</Text>
            <Text style={homeStyles.calorieTarget}>{nutritionTargets ? `Target · ${formatTarget(nutritionTargets.calories)} kcal` : 'Target unavailable'}</Text>
          </View>
          <Text style={homeStyles.calorieValue}>{nutrition.calories.toLocaleString()}<Text style={homeStyles.calorieUnit}> kcal</Text></Text>
          <View style={homeStyles.macroRow}>
            {[
              { label: 'Protein', value: nutrition.protein },
              { label: 'Carbs', value: nutrition.carbs },
              { label: 'Fat', value: nutrition.fat },
            ].map(macro => <View key={macro.label} style={homeStyles.macroMetric}>
              <Text style={homeStyles.macroLabel}>{macro.label}</Text>
              <Text style={homeStyles.macroValue}>{displayNumber(macro.value)} g</Text>
            </View>)}
          </View>
        </View>
      </View>

      <View style={homeStyles.snapshotSection}>
        <View style={homeStyles.sectionHeading}>
          <DesignSectionTitle style={homeStyles.sectionTitle}>Progress</DesignSectionTitle>
          <Pressable accessibilityRole="button" accessibilityLabel="Open progress" onPress={() => router.push('/(tabs)/progress')} style={homeStyles.sectionAction}>
            <Text style={homeStyles.sectionActionText}>Details</Text>
          </Pressable>
        </View>
        <View style={homeStyles.progressRow}>
          <View style={homeStyles.progressMetric}>
            <Text style={homeStyles.progressValue}>{streak}</Text>
            <Text style={homeStyles.progressLabel}>Day streak</Text>
          </View>
          <View style={homeStyles.progressDivider} />
          <View style={homeStyles.progressMetric}>
            <Text style={homeStyles.progressValue}>{monthlyWorkouts}</Text>
            <Text style={homeStyles.progressLabel}>Workouts this month</Text>
          </View>
        </View>
      </View>

      {showRecommendation && recommendationWorkout && recommendationPlanDay ? <View style={homeStyles.recommendSection}>
        <View style={homeStyles.sectionHeading}>
          <DesignSectionTitle style={homeStyles.sectionTitle}>Next up</DesignSectionTitle>
          <Text style={homeStyles.sectionMeta}>Planned</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${recommendationWorkout.name}`} onPress={() => router.push({ pathname: '/plan/day/[day]', params: { day: String(recommendationPlanDay.weekday) } })} style={homeStyles.recommendRow}>
          <View style={homeStyles.recommendCopy}>
            <Text style={homeStyles.recommendTitle}>{recommendationWorkout.name}</Text>
            <Text style={homeStyles.recommendMeta}>{planDayName(recommendationPlanDay)} · {recommendationWorkout.duration} min</Text>
          </View>
          {recommendationVisual ? <View style={homeStyles.recommendVisual}>
            <ExerciseVisual exerciseId={recommendationVisual.exerciseId} style={homeStyles.recommendVisualImage} />
          </View> : null}
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={designColors.textMuted} />
        </Pressable>
      </View> : null}

    </View>
  </Screen>;
}

const homeStyles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: designColors.background },
  page: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingBottom: designSpacing.xl },
  greeting: { paddingTop: designSpacing.sm, paddingBottom: designSpacing.md },
  greetingTitle: { fontSize: 28, lineHeight: 34, marginBottom: 0 },
  greetingDate: { marginTop: designSpacing.xs },
  focusBlock: {
    paddingVertical: designSpacing.md,
    marginBottom: designSpacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: designColors.line,
  },
  focusLabel: { color: designColors.textSecondary, textTransform: 'uppercase' },
  focusValue: { color: designColors.ink, fontFamily: 'BricolageExtraBold', fontSize: 22, lineHeight: 28, marginTop: designSpacing.xs },
  workoutSection: { marginBottom: designSpacing.lg },
  sectionTitle: { color: designColors.ink },
  sectionHeading: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: designSpacing.sm },
  sectionAction: { minWidth: 44, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center', paddingLeft: designSpacing.sm },
  sectionActionText: { color: designColors.accent, fontFamily: 'InterSemiBold', fontSize: 12 },
  sectionMeta: { color: designColors.textSecondary, fontFamily: 'InterSemiBold', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  workoutCard: {
    backgroundColor: designColors.surface,
    borderRadius: designRadii.lg,
    borderWidth: 1,
    borderColor: designColors.line,
    padding: designSpacing.lg,
    overflow: 'hidden',
  },
  workoutCardCompact: { padding: designSpacing.md },
  workoutTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: designSpacing.md,
    minHeight: 96,
  },
  workoutTopCompact: { minHeight: 0, alignItems: 'center' },
  workoutText: { flex: 1, minWidth: 0 },
  workoutStatus: { color: designColors.textSecondary, textTransform: 'uppercase' },
  workoutTitle: { color: designColors.ink, fontFamily: 'BricolageExtraBold', fontSize: 24, lineHeight: 30, marginTop: designSpacing.xs },
  workoutMeta: { ...designTypography.bodySmall, color: designColors.textSecondary, marginTop: designSpacing.xs },
  workoutVisual: {
    width: 88,
    height: 88,
    borderRadius: designRadii.md,
    backgroundColor: designColors.accentSubtle,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: designColors.line,
  },
  workoutVisualCompact: { width: 78, height: 78 },
  workoutVisualImage: { width: '100%', height: '100%' },
  workoutMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: designSpacing.sm, marginTop: designSpacing.md },
  metaPill: {
    paddingHorizontal: designSpacing.sm,
    paddingVertical: designSpacing.xs,
    borderRadius: designRadii.pill,
    backgroundColor: designColors.surfaceSubtle,
    borderWidth: 1,
    borderColor: designColors.line,
    color: designColors.textSecondary,
    fontFamily: 'InterSemiBold',
    fontSize: 11,
    lineHeight: 16,
  },
  workoutAction: { marginTop: designSpacing.md },
  snapshotSection: { marginTop: designSpacing.lg },
  summaryPanel: {
    backgroundColor: designColors.surface,
    borderColor: designColors.line,
    borderWidth: 1,
    borderRadius: designRadii.md,
    padding: designSpacing.lg,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: designSpacing.sm },
  snapshotLabel: { color: designColors.textSecondary, fontFamily: 'InterSemiBold', fontSize: 11 },
  calorieValue: { color: designColors.ink, fontFamily: 'BricolageBold', fontSize: 28, lineHeight: 34, marginTop: designSpacing.sm },
  calorieUnit: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 13 },
  calorieTarget: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: 'right' },
  macroRow: { flexDirection: 'row', gap: designSpacing.md, marginTop: designSpacing.md },
  macroMetric: { flex: 1, minWidth: 0, borderTopWidth: 1, borderColor: designColors.line, paddingTop: designSpacing.sm },
  macroLabel: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 11 },
  macroValue: { color: designColors.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginTop: designSpacing.xs },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: designSpacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: designColors.line,
  },
  progressMetric: { flex: 1, minWidth: 0 },
  progressValue: { color: designColors.ink, fontFamily: 'BricolageBold', fontSize: 22, lineHeight: 28 },
  progressLabel: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs },
  progressDivider: { width: 1, height: 38, backgroundColor: designColors.line, marginHorizontal: designSpacing.md },
  recommendSection: { marginTop: designSpacing.lg },
  recommendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: designSpacing.md,
    borderWidth: 1,
    borderColor: designColors.line,
    borderRadius: designRadii.md,
    padding: designSpacing.md,
    backgroundColor: designColors.surface,
  },
  recommendCopy: { flex: 1, minWidth: 0 },
  recommendTitle: { color: designColors.ink, fontFamily: 'InterSemiBold', fontSize: 15 },
  recommendMeta: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs },
  recommendVisual: {
    width: 56,
    height: 56,
    borderRadius: designRadii.sm,
    backgroundColor: designColors.accentSubtle,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: designColors.line,
  },
  recommendVisualImage: { width: '100%', height: '100%' },
  recentSection: { marginTop: designSpacing.lg },
  recentRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: designSpacing.md, borderTopWidth: 1, borderColor: designColors.line },
  recentCopy: { flex: 1, minWidth: 0, paddingVertical: designSpacing.sm },
  recentTitle: { color: designColors.ink, fontFamily: 'InterSemiBold', fontSize: 14 },
  recentMeta: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs },
  emptyRecent: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 13, lineHeight: 19, paddingVertical: designSpacing.md, borderTopWidth: 1, borderColor: designColors.line },
});

export function PlanScreen() {
  const { state } = useSteadiifit(); const progress = planWeekProgress(state.plan, state.history); const today = (new Date().getDay() + 6) % 7;
  if (!state.plan.length) return <Screen><Heading>My Plan</Heading><Empty title="No plan yet" detail="Choose your goal and schedule to build a weekly plan." /><Action title="Customize plan" onPress={() => router.push('/plan/customize')} /></Screen>;
  const durationPreference = state.duration === 75 ? '75+ min target' : `${state.duration} min target`;
  return <Screen><View style={s.planHeader}><View style={{ flex: 1 }}><Eyebrow>YOUR TRAINING, YOUR WAY</Eyebrow><Heading>My Plan</Heading><Copy>A personalized plan shaped around your routine.</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Customize plan" onPress={() => router.push('/plan/customize')} style={s.customizeIcon}><SymbolView name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }} size={20} weight="medium" tintColor={C.ink} /></Pressable></View>
    <Card style={s.planSummary}>
      <View style={s.goalSummaryHeader}>
        <View style={s.goalSummaryCopy}>
          <Text style={s.goalSummaryTitle}>{state.goal}</Text>
          <Copy style={s.goalSummaryMeta}>{state.frequency} training days · {durationPreference} · {state.trainingFocus}</Copy>
        </View>
        <Pill>WEEK {currentPlanWeek(state.planStartedAt)}</Pill>
      </View>
      <View style={s.goalWeekProgress}>
        <View style={[s.planMeter, s.goalWeekTrack]}><View style={[s.planMeterFill, { width: `${Math.round(progress.ratio * 100)}%` }]} /></View>
        <Copy style={s.goalWeekCaption}>{progress.completed} / {progress.planned} workouts completed this week</Copy>
      </View>
    </Card>
    <SectionTitle title="This week" action="Customize" onPress={() => router.push('/plan/customize')} />
    {state.plan.slice().sort((a, b) => a.weekday - b.weekday).map(day => { const status = planDayStatus(day, state.history); const rest = !day.workoutId; const title = planDayName(day); const exerciseCount = plannedExercises(day).length; const visualExerciseId = rest ? undefined : plannedExercises(day).find(item => Boolean(exerciseVisualForId(item.exerciseId)))?.exerciseId; return <Card key={day.id} style={{ ...s.planDayCard, ...(day.weekday === today && !rest ? s.planDayToday : {}) }} onPress={() => router.push({ pathname: '/plan/day/[day]', params: { day: String(day.weekday) } })}><Text style={s.day}>{weekday[day.weekday]}</Text>{visualExerciseId ? <ExerciseVisual exerciseId={visualExerciseId} style={s.planDayImage} /> : null}<View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{title}</Text><Copy>{rest ? 'Rest and recover' : `${planDayFocus(day)} · ${planDayDuration(day)} min · ${exerciseCount} exercises`}</Copy></View><View style={s.planDayRight}><Pill green={status === 'Completed'}>{status.toUpperCase()}</Pill><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={C.muted} /></View></Card>; })}
  </Screen>;
}

export function CustomizePlanScreen() {
  const { state, regeneratePlan } = useSteadiifit();
  const [goal, setGoal] = useState<Goal>(state.goal); const [frequency, setFrequency] = useState(state.frequency); const [duration, setDuration] = useState(state.duration); const [equipment, setEquipment] = useState(state.equipment); const [focus, setFocus] = useState<TrainingFocus>(state.trainingFocus);
  const save = () => { regeneratePlan({ goal, experience: state.experience, frequency, equipment, duration, focus }); router.back(); };
  const choose = <T extends string | number,>(title: string, values: T[], selected: T, setValue: (value: T) => void) => <><SectionTitle title={title} />{values.map(value => <Option key={String(value)} title={String(value)} selected={selected === value} onPress={() => setValue(value)} />)}</>;
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
    {rest ? <><Card style={{ marginTop: 14 }}><Text style={s.cardTitle}>Rest and recover</Text><Copy>Your next planned training day is already on your weekly schedule.</Copy></Card></> : <>
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
  const workoutCards = useMemo(() => {
    let previousVisualId: string | undefined;
    return filtered.map(workout => {
      const visual = exerciseVisualForWorkout(workout, previousVisualId);
      if (visual) previousVisualId = visual.exerciseId;
      return { workout, visual };
    });
  }, [filtered]);
  return <Screen><Heading>Workouts</Heading><Copy>Find a session that fits your plan.</Copy>
    <SectionTitle title="Today's recommendation" /><Card style={s.recommend} onPress={() => pushWorkout(featured.id)}><Pill>RECOMMENDED</Pill><Text style={[s.cardTitle, { marginTop: 9 }]}>{featured.name}</Text><Copy>{featured.duration} min · {featured.focus}</Copy></Card>
    <SectionTitle title="Workout library" /><TextInput value={search} onChangeText={setSearch} placeholder="Search workouts" placeholderTextColor={C.muted} style={uiStyles.input} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{categories.map(item => <Pressable key={item} onPress={() => setCategory(item)} style={[s.chip, category === item && s.chipActive]}><Text style={[s.chipText, category === item && s.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {workoutCards.length ? workoutCards.map(({ workout, visual }) => <Card key={workout.id} style={s.workoutDiscoveryCard} onPress={() => pushWorkout(workout.id)}>
      <View style={s.workoutDiscoveryRow}>
        <View style={s.workoutVisualPanel}>{visual ? <ExerciseVisual exerciseId={visual.exerciseId} style={s.workoutVisualImage} /> : <Text numberOfLines={2} style={s.workoutVisualFallback}>{workout.focus}</Text>}</View>
        <View style={s.workoutDiscoveryInfo}>
          <Text numberOfLines={2} style={s.cardTitle}>{workout.name}</Text>
          <View style={s.workoutMeta}><Pill>{workout.difficulty}</Pill><Pill>{workout.duration} min</Pill></View>
          <Copy numberOfLines={3} style={s.workoutDescription}>{workout.description}</Copy>
        </View>
      </View>
    </Card>) : <Empty title="No workouts found" detail="Try changing your search or category." />}
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
  const { width } = useWindowDimensions();
  const wide = width >= 820;
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
  const visual = current ? exerciseVisualForId(current.exerciseId) : undefined;
  const nextSetLabel = current && session.setIndex + 1 < current.sets.length
    ? `Set ${session.setIndex + 2} of ${current.sets.length}`
    : session.exerciseIndex + 1 < session.exercises.length
      ? `Next exercise · ${exerciseById(session.exercises[session.exerciseIndex + 1].exerciseId).name}`
      : 'Finish workout';
  const workoutProgress = Math.min(100, (session.exerciseIndex + session.setIndex / Math.max(1, current?.sets.length ?? 1)) / Math.max(1, session.exercises.length)) * 100;
  const atEnd = !current || session.exerciseIndex >= session.exercises.length;
  const moveOn = () => { if (atEnd) { router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); return; } const lastSet = session.setIndex >= current.sets.length - 1; const lastExercise = session.exerciseIndex >= session.exercises.length - 1; if (lastSet && lastExercise) router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } }); else advanceWorkout(); };
  const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
  const modal = sheet !== null;
  const pauseSession = () => { if (!session.paused) togglePause(); setSheet('pause'); };
  const confirmExit = () => { if (!session.paused) togglePause(); setSheet('exit'); };
  return <Screen>
    <TopBar title={workoutName} onBack={confirmExit} right={<Pressable accessibilityRole="button" accessibilityLabel="Pause workout" onPress={pauseSession} style={s.sessionPauseButton}><SymbolView name={{ ios: 'pause.fill', android: 'pause', web: 'pause' }} size={18} weight="medium" tintColor={C.ink} /></Pressable>} />
    <View style={s.activeWorkoutBody}>
      <View style={s.activeSessionMeta}>
        <Text style={s.activeElapsed}>{formatTime(session.elapsedSeconds)} <Text style={s.activeStatus}>· {session.paused ? 'PAUSED' : 'IN PROGRESS'}</Text></Text>
        <Text style={s.activePosition}>{atEnd ? 'WORKOUT COMPLETE' : `EXERCISE ${session.exerciseIndex + 1} OF ${session.exercises.length}`}</Text>
      </View>
      <View style={[s.progressTrack, s.activeProgressTrack]}><View style={[s.progressFill, { width: `${workoutProgress}%` }]} /></View>
      {!atEnd ? session.restActive ? <View style={s.restFocus}>
        <Eyebrow>REST TIMER</Eyebrow>
        <Text style={s.restFocusTime}>{formatTime(session.restSeconds ?? 0)}</Text>
        <View style={s.restNext}>
          <Eyebrow>UP NEXT</Eyebrow>
          <Text style={s.restNextTitle}>{nextSetLabel}</Text>
          {nextSetLabel.startsWith('Set ') ? <Copy>{exercise.name} · {current.targetReps} {current.repUnit}</Copy> : null}
        </View>
        <View style={s.restControls}>
          <Pressable accessibilityRole="button" onPress={() => setRest(Math.max(0, (session.restSeconds ?? 0) - 15), true)} style={s.restControl}><Text style={s.restLink}>−15 sec</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setRest((session.restSeconds ?? 0) + 15, true)} style={s.restControl}><Text style={s.restLink}>+15 sec</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setRest(0, false)} style={s.restControl}><Text style={s.restLink}>Skip rest</Text></Pressable>
        </View>
        <Action title={`Resting · ${formatTime(session.restSeconds ?? 0)}`} disabled={session.paused || (currentSet?.completed && session.restActive)} onPress={() => { if (currentSet && !currentSet.completed) completeSet(); else moveOn(); }} />
        <View style={s.sessionActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/exercises', params: { mode: 'replace' } })} style={s.sessionAction}><Text style={s.sessionActionText}>Replace exercise</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSheet('skip')} style={s.sessionAction}><Text style={s.sessionActionText}>Skip exercise</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/exercises', params: { mode: 'add' } })} style={s.sessionAction}><Text style={s.sessionActionText}>Add exercise</Text></Pressable>
        </View>
      </View> : <View style={[s.activeWorkoutMain, wide && s.activeWorkoutMainWide]}>
        <View style={[s.activeExerciseColumn, wide && s.activeExerciseColumnWide]}>
          <Text style={s.activeExerciseName}>{exercise.name}</Text>
          <Copy style={s.activePrescription}>{current.targetSets} sets · {current.targetReps} {current.repUnit}</Copy>
          <View style={[s.activeVisualFrame, { aspectRatio: visual?.orientation === 'landscape' ? 1.55 : 1.25 }, wide && s.activeVisualFrameWide]}>
            {visual ? <ExerciseVisual exerciseId={current.exerciseId} style={s.activeExerciseImage} /> : <Text style={s.activeVisualFallback}>{exercise.muscle} · {exercise.equipment}</Text>}
          </View>
        </View>
        <View style={[s.activeSetColumn, wide && s.activeSetColumnWide]}>
          <SectionTitle title="Current set" action={`${session.setIndex + 1} of ${current.sets.length}`} />
          {currentSet ? <Pressable accessibilityRole="button" onPress={() => !currentSet.completed && updateSet(convertWeight(currentSet.weight, session.units, state.units), currentSet.reps)} style={[s.loggedSet, s.loggedSetCurrent, currentSet.completed && s.loggedSetDone]}><Text style={s.loggedSetLabel}>{currentSet.completed ? '✓' : `SET ${session.setIndex + 1}`}</Text><Text style={s.loggedSetValue}>{currentSet.weight ? `${formatWeight(currentSet.weight, session.units, state.units)} ${state.units}` : 'Bodyweight'} × {currentSet.reps} {current.repUnit}</Text></Pressable> : null}
          {currentSet && !currentSet.completed && <View style={s.adjustCard}><Text style={s.adjustHeading}>Adjust this set</Text><View style={s.adjustRow}>{[['Weight', convertWeight(currentSet.weight, session.units, state.units), (n: number) => updateSet(n, currentSet.reps)], [current.repUnit === 'reps' ? 'Reps' : 'Duration', currentSet.reps, (n: number) => updateSet(convertWeight(currentSet.weight, session.units, state.units), n)]].map(([label, value, update] : any, itemIndex) => <View key={label} style={s.adjustField}><Text style={s.adjustLabel}>{label} {itemIndex === 0 ? `(${state.units})` : current.repUnit !== 'reps' ? `(${current.repUnit})` : ''}</Text><View style={s.stepper}><Pressable accessibilityRole="button" style={s.stepperButton} onPress={() => update(Math.max(0, Number(value) - (itemIndex === 0 ? (state.units === 'kg' ? 2.5 : 5) : current.repUnit === 'sec' ? 5 : 1)))}><Text style={s.stepperText}>−</Text></Pressable><Text style={s.stepValue}>{itemIndex === 0 ? formatWeight(Number(value), state.units, state.units) : value}</Text><Pressable accessibilityRole="button" style={s.stepperButton} onPress={() => update(Number(value) + (itemIndex === 0 ? (state.units === 'kg' ? 2.5 : 5) : current.repUnit === 'sec' ? 5 : 1))}><Text style={s.stepperText}>+</Text></Pressable></View></View>)}</View></View>}
          <Action title={currentSet?.completed ? (session.restActive ? `Resting · ${formatTime(session.restSeconds ?? 0)}` : session.setIndex + 1 < current.sets.length ? 'Next set' : session.exerciseIndex + 1 < session.exercises.length ? 'Next exercise' : 'Finish workout') : 'Complete set'} disabled={session.paused || (currentSet?.completed && session.restActive)} onPress={() => { if (currentSet && !currentSet.completed) completeSet(); else moveOn(); }} />
          {session.restSeconds !== null && <View style={s.restInline}>
            <Text style={s.restInlineStatus}>{session.restSeconds === 0 ? 'REST COMPLETE' : 'REST'}</Text>
            <Text style={s.restInlineTime}>{formatTime(session.restSeconds)}</Text>
            <View style={s.restControls}>
              <Pressable accessibilityRole="button" onPress={() => setRest(Math.max(0, (session.restSeconds ?? 0) - 15), true)} style={s.restControl}><Text style={s.restLink}>−15 sec</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setRest((session.restSeconds ?? 0) + 15, true)} style={s.restControl}><Text style={s.restLink}>+15 sec</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setRest(0, false)} style={s.restControl}><Text style={s.restLink}>Skip rest</Text></Pressable>
            </View>
          </View>}
          <SectionTitle title="Set log" />
          {current.sets.map((set, setIndex) => { if (setIndex === session.setIndex) return null; const shownWeight = convertWeight(set.weight, session.units, state.units); return <Pressable key={set.id} accessibilityRole="button" onPress={() => !set.completed && updateSet(shownWeight, set.reps)} style={[s.loggedSet, set.completed && s.loggedSetDone]}><Text style={s.loggedSetLabel}>{set.completed ? '✓' : `SET ${setIndex + 1}`}</Text><Text style={s.loggedSetValue}>{set.weight ? `${formatWeight(set.weight, session.units, state.units)} ${state.units}` : 'Bodyweight'} × {set.reps} {current.repUnit}</Text></Pressable>; })}
          <View style={s.sessionActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/exercises', params: { mode: 'replace' } })} style={s.sessionAction}><Text style={s.sessionActionText}>Replace exercise</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSheet('skip')} style={s.sessionAction}><Text style={s.sessionActionText}>Skip exercise</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/exercises', params: { mode: 'add' } })} style={s.sessionAction}><Text style={s.sessionActionText}>Add exercise</Text></Pressable>
          </View>
        </View>
      </View> : <View style={s.activeFinish}>
        <Heading>All exercises done</Heading>
        <Copy>Review your session and save it to your workout history.</Copy>
        <Action title="Finish workout" onPress={() => router.replace({ pathname: '/complete/[id]', params: { id: session.workoutId } })} />
      </View>}
    </View>
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
  return <Screen style={s.complete}>
    <View style={s.completionContent}>
      <View style={s.completionMark}>
        <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={21} weight="semibold" tintColor={designColors.success} />
      </View>
      <DesignScreenTitle style={s.completionTitle}>Workout complete</DesignScreenTitle>
      <Text style={s.completionWorkout} adjustsFontSizeToFit numberOfLines={2}>{session?.name ?? workout.name}</Text>

      <View style={s.completionDuration}>
        <Text style={s.completionDurationValue}>{session?.duration ?? 0}</Text>
        <Text style={s.completionDurationUnit}>MIN</Text>
      </View>
      <DesignCaption style={s.completionDurationLabel}>DURATION</DesignCaption>

      <View style={s.completionMetrics}>
        <View style={s.completionMetric}>
          <Text style={s.completionMetricValue} adjustsFontSizeToFit numberOfLines={1}>{exercisesDone}</Text>
          <DesignCaption style={s.completionMetricLabel}>EXERCISES</DesignCaption>
        </View>
        <View style={s.completionMetricDivider} />
        <View style={s.completionMetric}>
          <Text style={s.completionMetricValue} adjustsFontSizeToFit numberOfLines={1}>{setCount}</Text>
          <DesignCaption style={s.completionMetricLabel}>SETS</DesignCaption>
        </View>
        <View style={s.completionMetricDivider} />
        <View style={s.completionMetric}>
          <Text style={s.completionMetricValue} adjustsFontSizeToFit numberOfLines={1}>{Math.round(sessionVolume).toLocaleString()}</Text>
          <DesignCaption style={s.completionMetricLabel}>{state.units.toUpperCase()} VOLUME</DesignCaption>
        </View>
      </View>

      {session?.personalRecord ? <View style={s.completionRecord}>
        <SymbolView name={{ ios: 'star', android: 'star_border', web: 'star' }} size={16} weight="medium" tintColor={designColors.success} />
        <DesignBodyText style={s.completionRecordText}>A personal best was set during this workout.</DesignBodyText>
      </View> : null}
      <DesignBodyText style={s.completionSaved}>Your session is saved in workout history and your progress has been updated.</DesignBodyText>

      <View style={s.completionActions}>
        <DesignPrimaryButton accessibilityLabel="Back to Home" onPress={() => router.replace('/(tabs)/home')}>Back to Home</DesignPrimaryButton>
        <Action title="View workout history" secondary onPress={() => router.replace('/history')} />
      </View>
    </View>
  </Screen>;
}

export function WorkoutHistoryScreen() {
  const { state } = useSteadiifit(); const [filter, setFilter] = useState<'All' | 'This week' | 'This month'>('All'); const now = new Date();
  const sorted = sortWorkoutsNewest(state.history, now);
  const visible = sorted.filter(item => { const date = workoutTimestamp(item, now); if (filter === 'This week') return date >= startOfWeek(now).getTime() && date <= now.getTime(); if (filter === 'This month') return date >= new Date(now.getFullYear(), now.getMonth(), 1).getTime() && date <= now.getTime(); return true; });
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const groups: { key: string; label: string; items: typeof visible }[] = [];
  for (const item of visible) {
    const timestamp = workoutTimestamp(item, now);
    const date = timestamp ? new Date(timestamp) : null;
    const key = date?.toDateString() ?? 'date-unavailable';
    const label = !date ? formatDate(timestamp) : date.toDateString() === now.toDateString() ? 'Today' : date.toDateString() === yesterday.toDateString() ? 'Yesterday' : formatDate(timestamp);
    const previousGroup = groups[groups.length - 1];
    if (previousGroup?.key === key) previousGroup.items.push(item);
    else groups.push({ key, label, items: [item] });
  }
  return <Screen style={s.historyScreen}>
    <TopBar title="Workout History" />
    <View style={s.historyContent}>
      <View style={s.historyFilters}>
        {(['All', 'This week', 'This month'] as const).map(choice => {
          const selected = filter === choice;
          return <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setFilter(choice)} style={[s.historyFilter, selected && s.historyFilterSelected]}>
            <Text style={[s.historyFilterText, selected && s.historyFilterTextSelected]}>{choice}</Text>
          </Pressable>;
        })}
      </View>
      {visible.length ? groups.map(group => <View key={group.key}>
        <DesignCaption style={s.historyGroupTitle}>{group.label}</DesignCaption>
        {group.items.map(item => {
          const stats = calculateWorkoutStats(item, state.units);
          return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}, ${formatDate(workoutTimestamp(item, now))}, ${item.duration} minutes`} onPress={() => openHistoryItem(item.id)} style={({ pressed }) => [s.historyRow, pressed && s.historyRowPressed]}>
            <View style={s.historyRowContent}>
              <Text style={s.historyRowTitle}>{item.name}</Text>
              <Text style={s.historyRowMeta}>{stats.exerciseCount} exercises · {stats.completedSets} sets · {Math.round(stats.volume).toLocaleString()} {state.units}</Text>
            </View>
            <View style={s.historyRowAside}>
              {item.personalRecord ? <Text style={s.historyRecord}>PR</Text> : null}
              <Text style={s.historyDuration}>{item.duration} min</Text>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={designColors.textMuted} />
          </Pressable>;
        })}
      </View>) : <Empty title={state.history.length ? 'No workouts in this period' : 'No completed workouts yet'} detail={state.history.length ? 'Try another time filter to see your training.' : 'Complete a workout and your history will appear here.'} />}
    </View>
  </Screen>;
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
  return <Screen style={s.nutritionScreen}>
    <TopBar title="Exercises" right={<Text style={s.favoriteCount}>{state.favoriteExerciseIds.length} saved</Text>} />
    {selectionMode ? <View style={s.exerciseSelectionBanner}>
      <Eyebrow>{mode === 'replace' ? 'REPLACE PLANNED MOVEMENT' : planSelection ? 'ADD TO PLANNED WORKOUT' : 'ADD TO THIS WORKOUT'}</Eyebrow>
      <Text style={s.exerciseSelectionTitle}>{mode === 'replace' ? `Replace ${currentId ? exerciseById(currentId).name : 'exercise'}` : 'Choose an exercise'}</Text>
      <Copy>{planSelection ? `Options are limited to ${state.equipment} equipment${mode === 'replace' && currentMuscle ? ` and movements for ${currentMuscle.toLowerCase()}` : ''}.` : mode === 'replace' ? 'Choose a movement to take its place. Your other sets stay saved.' : 'Your new movement will be added to the end of this session.'}</Copy>
    </View> : null}
    <View style={s.searchRow}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} weight="medium" tintColor={C.muted} />
      <TextInput accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search exercises, muscles, equipment" placeholderTextColor={C.muted} style={s.exerciseSearch} />
      {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8} style={s.clearSearch}><SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} weight="medium" tintColor={C.muted} /></Pressable> : null}
    </View>
    <View style={s.exerciseToolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} onPress={() => setFiltersOpen(true)} style={[s.filterButton, activeFilterCount > 0 && s.filterButtonActive]}>
        <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'tune', web: 'tune' }} size={16} weight="medium" tintColor={activeFilterCount ? '#FFF' : C.ink} />
        <Text style={[s.filterButtonText, activeFilterCount > 0 && s.filterButtonTextActive]}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={favoritesOnly ? 'Show all exercises' : 'Show favorites only'} accessibilityState={{ selected: favoritesOnly }} onPress={() => setFavoritesOnly(value => !value)} style={[s.favoriteToggle, favoritesOnly && s.favoriteToggleActive]}>
        <SymbolView name={{ ios: favoritesOnly ? 'heart.fill' : 'heart', android: favoritesOnly ? 'favorite' : 'favorite_border', web: favoritesOnly ? 'favorite' : 'favorite_border' }} size={16} weight="medium" tintColor={favoritesOnly ? '#FFF' : C.accent} />
        <Text style={[s.favoriteToggleText, favoritesOnly && s.favoriteToggleTextActive]}>Favorites</Text>
      </Pressable>
      <Text style={s.resultCount}>{matches.length} found</Text>
    </View>
    {(query || muscle || equipment || difficulty || category || favoritesOnly) ? <View style={s.selectedFilters}>
      <Text style={s.selectedFilterSummary} numberOfLines={2}>{[query ? `“${query}”` : '', muscle, equipment, difficulty, category, favoritesOnly ? 'Favorites' : ''].filter(Boolean).join(' · ')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear search and filters" onPress={clearFilters} hitSlop={8}><Text style={s.clearFilters}>Clear</Text></Pressable>
    </View> : null}
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
  const { width } = useWindowDimensions();
  const exercise = exercises.find(item => item.id === id); const { state, toggleFavorite, startSingleExercise, replaceExercise } = useSteadiifit();
  if (!exercise) return <Screen><TopBar title="Exercise details" /><Empty title="Exercise not found" detail="This movement is not in the exercise library." /><Action title="Browse exercises" onPress={() => router.replace('/exercises')} /></Screen>;
  const previous = state.history.find(session => session.exercises.some(item => item.exerciseId === exercise.id && item.sets.length > 0));
  const previousExercise = previous?.exercises.find(item => item.exerciseId === exercise.id && item.sets.length > 0);
  const previousSets = previousExercise?.sets ?? [];
  const previousUnit = previous?.units ?? 'kg';
  const bestWeight = previousSets.reduce((best, set) => Math.max(best, convertWeight(set.weight, previousUnit, state.units)), 0);
  const bestReps = previousSets.reduce((best, set) => Math.max(best, set.reps), 0);
  const visual = exerciseVisualForId(exercise.id);
  const active = state.activeWorkout; const activeExercise = active?.exercises[active.exerciseIndex];
  const favorite = state.favoriteExerciseIds.includes(exercise.id);
  const wide = width >= 820;
  const timeUnit = exercise.repRange.toLowerCase().includes('min') ? 'min' : exercise.repRange.toLowerCase().includes('sec') ? 'sec' : 'reps';
  const start = () => {
    if (active) {
      if (activeExercise?.exerciseId !== exercise.id) replaceExercise(exercise.id);
      router.replace({ pathname: '/active/[id]', params: { id: active.workoutId } });
      return;
    }
    startSingleExercise(exercise.id);
    router.push({ pathname: '/active/[id]', params: { id: `exercise-${exercise.id}` } });
  };
  return <Screen style={s.nutritionScreen}>
    <TopBar title="Exercise details" right={<Pressable accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'} accessibilityState={{ selected: favorite }} onPress={() => toggleFavorite(exercise.id)} style={exerciseDetailsStyles.favoriteButton}><SymbolView name={{ ios: favorite ? 'heart.fill' : 'heart', android: favorite ? 'favorite' : 'favorite_border', web: favorite ? 'favorite' : 'favorite_border' }} size={19} weight="medium" tintColor={favorite ? designColors.accent : designColors.textMuted} /></Pressable>} />
    <View style={[exerciseDetailsStyles.layout, wide && exerciseDetailsStyles.layoutWide]}>
      <View style={wide && exerciseDetailsStyles.visualColumnWide}>
        {visual ? (
          <View style={[exerciseDetailsStyles.visualFrame, { aspectRatio: visual.orientation === 'landscape' ? 1.7 : 1.3 }]}>
            <ExerciseVisual exerciseId={exercise.id} style={exerciseDetailsStyles.visualImage} />
          </View>
        ) : (
          <View style={[s.demoHero, exerciseDetailsStyles.visualFallback, wide && exerciseDetailsStyles.visualFallbackWide]}>
            <View style={s.demoBar}><View style={s.demoPlate} /><View style={s.demoGrip} /><View style={s.demoPlate} /></View>
            <Text style={s.demoKicker}>MOVEMENT PREVIEW</Text>
            <Text style={s.demoLabel}>{exercise.demo}</Text>
            <Copy style={s.demoCopy}>A visual guide for {exercise.name.toLowerCase()}.</Copy>
          </View>
        )}
      </View>

      <View style={[exerciseDetailsStyles.detailsColumn, wide && exerciseDetailsStyles.detailsColumnWide]}>
        <View style={exerciseDetailsStyles.identity}>
          <DesignCaption style={exerciseDetailsStyles.identityKicker}>{exercise.category} · {exercise.difficulty}</DesignCaption>
          <Text style={exerciseDetailsStyles.exerciseName}>{exercise.name}</Text>
          <View style={exerciseDetailsStyles.metadataRow}>
            <View style={exerciseDetailsStyles.metadataItem}>
              <DesignCaption style={exerciseDetailsStyles.metadataLabel}>PRIMARY MUSCLES</DesignCaption>
              <Text style={exerciseDetailsStyles.metadataValue}>{exercise.primaryMuscles.join(', ')}</Text>
            </View>
            <View style={exerciseDetailsStyles.metadataDivider} />
            <View style={exerciseDetailsStyles.metadataItem}>
              <DesignCaption style={exerciseDetailsStyles.metadataLabel}>EQUIPMENT</DesignCaption>
              <Text style={exerciseDetailsStyles.metadataValue}>{exercise.equipment}</Text>
            </View>
          </View>
          {exercise.secondaryMuscles.length ? <Text style={exerciseDetailsStyles.secondaryMuscles}>Also works · {exercise.secondaryMuscles.join(', ')}</Text> : null}
        </View>

        <View style={exerciseDetailsStyles.prescriptionPanel}>
          <DesignCaption style={exerciseDetailsStyles.prescriptionEyebrow}>WORKOUT PRESCRIPTION</DesignCaption>
          <View style={exerciseDetailsStyles.prescriptionMetrics}>
            <View style={exerciseDetailsStyles.prescriptionMetric}>
              <Text style={exerciseDetailsStyles.prescriptionValue}>{exercise.sets}</Text>
              <DesignCaption style={exerciseDetailsStyles.prescriptionLabel}>Sets</DesignCaption>
            </View>
            <View style={exerciseDetailsStyles.prescriptionDivider} />
            <View style={[exerciseDetailsStyles.prescriptionMetric, exerciseDetailsStyles.prescriptionMetricWide]}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={exerciseDetailsStyles.prescriptionValue}>{exercise.repRange}</Text>
              <DesignCaption style={exerciseDetailsStyles.prescriptionLabel}>Reps / time</DesignCaption>
            </View>
            <View style={exerciseDetailsStyles.prescriptionDivider} />
            <View style={exerciseDetailsStyles.prescriptionMetric}>
              <Text style={exerciseDetailsStyles.prescriptionValue}>{exercise.restSeconds}<Text style={exerciseDetailsStyles.prescriptionUnit}>s</Text></Text>
              <DesignCaption style={exerciseDetailsStyles.prescriptionLabel}>Rest</DesignCaption>
            </View>
          </View>
        </View>

        <View style={exerciseDetailsStyles.guidanceSection}>
          <View style={exerciseDetailsStyles.sectionHeadingRow}>
            <DesignSectionTitle>Form cues</DesignSectionTitle>
            <DesignCaption>{exercise.formTips.length} tips</DesignCaption>
          </View>
          {exercise.formTips.map(tip => (
            <View key={tip} style={exerciseDetailsStyles.formTipRow}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={15} weight="semibold" tintColor={designColors.success} />
              <DesignBodyText style={exerciseDetailsStyles.formTipText}>{tip}</DesignBodyText>
            </View>
          ))}
          <View style={exerciseDetailsStyles.disclosures}>
            <ExerciseDisclosure title="How to perform">{exercise.instructions.map((instruction, index) => <View key={instruction} style={s.instructionRow}><Text style={s.instructionNumber}>{String(index + 1).padStart(2, '0')}</Text><Copy style={s.instructionText}>{instruction}</Copy></View>)}</ExerciseDisclosure>
            <ExerciseDisclosure title="Common mistakes">{exercise.commonMistakes.map(mistake => <View key={mistake} style={s.mistakeRow}><Text style={s.mistakeMark}>•</Text><Copy style={s.instructionText}>{mistake}</Copy></View>)}</ExerciseDisclosure>
          </View>
        </View>

        <View style={exerciseDetailsStyles.previousSection}>
          <View style={exerciseDetailsStyles.sectionHeadingRow}>
            <DesignSectionTitle>Previous performance</DesignSectionTitle>
            {previous && previousExercise ? <DesignCaption>{previous.date.toUpperCase()}</DesignCaption> : null}
          </View>
          {previous && previousExercise ? <>
            <View style={exerciseDetailsStyles.previousSetList}>
              {previousSets.map((set, index) => <Text key={`${previous.id}-${index}`} style={exerciseDetailsStyles.previousSetValue}>{set.weight ? `${formatWeight(set.weight, previousUnit, state.units)} ${state.units}` : 'Bodyweight'} × {set.reps} {timeUnit}</Text>)}
            </View>
            <View style={exerciseDetailsStyles.previousMeta}>
              <Text style={exerciseDetailsStyles.previousMetaText}>Best weight · <Text style={exerciseDetailsStyles.previousMetaValue}>{bestWeight ? `${formatWeight(bestWeight, state.units, state.units)} ${state.units}` : 'Bodyweight'}</Text></Text>
              <Text style={exerciseDetailsStyles.previousMetaText}>Best {timeUnit === 'min' ? 'time' : timeUnit === 'sec' ? 'hold' : 'reps'} · <Text style={exerciseDetailsStyles.previousMetaValue}>{bestReps}{timeUnit === 'min' ? ' min' : timeUnit === 'sec' ? ' sec' : ''}</Text></Text>
            </View>
            <DesignCaption style={exerciseDetailsStyles.lastTrained}>Last trained {previous.date}</DesignCaption>
          </> : <DesignBodyText style={exerciseDetailsStyles.previousEmpty}>No previous performance. Complete this exercise to start tracking your progress.</DesignBodyText>}
        </View>

        <DesignPrimaryButton accessibilityLabel={active ? 'Use in active workout' : 'Start workout'} onPress={start}>
          {active ? 'Use in active workout' : 'Start workout'}
        </DesignPrimaryButton>
      </View>
    </View>
  </Screen>;
}

const exerciseDetailsStyles = StyleSheet.create({
  layout: { gap: designSpacing.lg },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: designSpacing.three },
  visualColumnWide: { width: '43%', maxWidth: 440 },
  detailsColumn: { minWidth: 0, gap: designSpacing.lg },
  detailsColumnWide: { flex: 1 },
  visualFrame: { width: '100%', alignSelf: 'center', borderRadius: designRadii.lg, backgroundColor: designColors.surfaceSubtle, overflow: 'hidden', maxHeight: 340 },
  visualImage: { width: '100%', height: '100%' },
  visualFallback: { width: '100%', height: 230, maxWidth: 440, alignSelf: 'center', marginBottom: 0, borderRadius: designRadii.lg },
  visualFallbackWide: { height: 320 },
  favoriteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: designRadii.full, backgroundColor: designColors.surfaceSubtle },
  identity: { gap: designSpacing.sm },
  identityKicker: { color: designColors.accent, textTransform: 'uppercase' },
  exerciseName: { color: designColors.textPrimary, fontFamily: 'BricolageExtraBold', fontSize: 30, lineHeight: 35 },
  metadataRow: { flexDirection: 'row', alignItems: 'stretch', gap: designSpacing.md, borderTopWidth: 1, borderColor: designColors.line, paddingTop: designSpacing.md, marginTop: designSpacing.xs },
  metadataItem: { flex: 1, minWidth: 0, gap: designSpacing.xs },
  metadataDivider: { width: 1, backgroundColor: designColors.line },
  metadataLabel: { color: designColors.textMuted, textTransform: 'uppercase' },
  metadataValue: { color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 13, lineHeight: 18 },
  secondaryMuscles: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 17 },
  prescriptionPanel: { borderWidth: 1, borderColor: designColors.borderStrong, borderRadius: designRadii.md, backgroundColor: designColors.surfaceSubtle, paddingHorizontal: designSpacing.lg, paddingVertical: designSpacing.md },
  prescriptionEyebrow: { color: designColors.textMuted, textTransform: 'uppercase' },
  prescriptionMetrics: { flexDirection: 'row', alignItems: 'stretch', marginTop: designSpacing.sm },
  prescriptionMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: designSpacing.xs },
  prescriptionMetricWide: { flex: 1.4 },
  prescriptionDivider: { width: 1, backgroundColor: designColors.borderStrong, marginVertical: designSpacing.xs },
  prescriptionValue: { color: designColors.textPrimary, fontFamily: 'BricolageExtraBold', fontSize: 25, lineHeight: 30, textAlign: 'center' },
  prescriptionUnit: { fontFamily: 'InterSemiBold', fontSize: 15 },
  prescriptionLabel: { color: designColors.textMuted, marginTop: designSpacing.xs },
  guidanceSection: { gap: designSpacing.sm },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: designSpacing.sm },
  formTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: designSpacing.sm, paddingVertical: designSpacing.xs },
  formTipText: { flex: 1, color: designColors.textSecondary, fontSize: 13, lineHeight: 19 },
  disclosures: { marginTop: designSpacing.xs },
  previousSection: { borderTopWidth: 1, borderColor: designColors.line, paddingTop: designSpacing.md },
  previousSetList: { flexDirection: 'row', flexWrap: 'wrap', gap: designSpacing.md, marginTop: designSpacing.sm },
  previousSetValue: { color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 13, lineHeight: 19 },
  previousMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: designSpacing.md, marginTop: designSpacing.sm },
  previousMetaText: { color: designColors.textMuted, fontFamily: 'InterRegular', fontSize: 11 },
  previousMetaValue: { color: designColors.textPrimary, fontFamily: 'InterSemiBold' },
  lastTrained: { marginTop: designSpacing.xs },
  previousEmpty: { color: designColors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: designSpacing.sm },
});

export function ProgressScreen() {
  const { state } = useSteadiifit();
  const now = new Date();
  const records = calculatePersonalRecords(state.history, now, state.units);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const nextMonthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  const monthWorkoutCount = state.history.filter(item => {
    const timestamp = workoutTimestamp(item, now);
    return timestamp >= monthStart.getTime() && timestamp < nextMonthStart.getTime();
  }).length;
  const weekdayOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCellCount = Math.ceil((weekdayOffset + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const dayNumber = index - weekdayOffset + 1;
    return dayNumber > 0 && dayNumber <= daysInMonth
      ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber)
      : null;
  });
  const completedDateKeys = new Set(state.history.map(item => new Date(workoutTimestamp(item, now)).toDateString()));
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayKey = localDateKey(now);
  const nutritionHistory = [...new Set(state.foodEntries.map(entry => entry.date))].filter(date => date < todayKey).sort((a, b) => b.localeCompare(a)).slice(0, 3);
  const nutritionDateLabel = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: year !== now.getFullYear() ? 'numeric' : undefined,
    });
  };
  const exercisesWithHistory = [...new Set(state.history.flatMap(item =>
    item.exercises.filter(exercise => exercise.sets.some(set => set.completed !== false)).map(exercise => exercise.exerciseId),
  ))];
  const recent = sortWorkoutsNewest(state.history, now).slice(0, 3);
  const weightEntries = sortedBodyWeight(state.bodyWeightEntries);
  const currentWeight = weightEntries[0];
  const change = bodyWeightChange(state.bodyWeightEntries);
  const showPreviousMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const showNextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  const canShowNextMonth = calendarMonth < currentMonthStart;
  const statCards = [
    { label: 'Current streak', value: `${calculateWorkoutStreak(state.history, now)}d`, foot: 'Training days' },
    { label: 'This month', value: `${monthWorkoutCount}`, foot: `${monthWorkoutCount === 1 ? 'workout' : 'workouts'}` },
    { label: 'Total workouts', value: `${calculateTotalWorkouts(state.history)}`, foot: 'Logged sessions' },
    { label: 'Volume', value: `${Math.round(calculateTotalVolume(state.history, state.units)).toLocaleString()}`, foot: state.units },
  ];

  return (
    <Screen style={n.progressScreen}>
      <PrimaryHeader title="Progress" />
      <View style={n.progressPage}>
        <View style={n.progressHeaderBlock}>
          <Text style={n.progressHeaderTitle}>Your training at a glance</Text>
          <DesignBodyText style={n.progressHeaderMeta}>Consistency, strength, and bodyweight all in one place.</DesignBodyText>
        </View>

        <View style={n.metricGrid}>
          {statCards.map(card => (
            <DesignCard key={card.label} style={n.metricCard}>
              <DesignCaption style={n.metricLabel}>{card.label}</DesignCaption>
              <Text style={n.metricValue}>{card.value}</Text>
              <Text style={n.metricFoot}>{card.foot}</Text>
            </DesignCard>
          ))}
        </View>

        <DesignCard style={n.calendarCard}>
          <View style={n.calendarHeader}>
            <View>
              <DesignCaption style={n.calendarEyebrow}>Activity</DesignCaption>
              <Text style={n.calendarTitle}>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            </View>
            <View style={n.progressMonthControls}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={showPreviousMonth} style={n.progressMonthControl}>
                <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} weight="medium" tintColor={C.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityState={{ disabled: !canShowNextMonth }}
                disabled={!canShowNextMonth}
                onPress={showNextMonth}
                style={[n.progressMonthControl, !canShowNextMonth && n.progressMonthControlDisabled]}
              >
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} weight="medium" tintColor={C.ink} />
              </Pressable>
            </View>
          </View>

          <View style={n.monthCalendarGrid}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
              <Text key={`${label}-${index}`} style={n.monthWeekday}>{label}</Text>
            ))}
            {calendarCells.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={n.monthDayCell} />;
              const completed = completedDateKeys.has(date.toDateString());
              const isToday = date.toDateString() === now.toDateString();
              return (
                <View key={date.toISOString()} style={[n.monthDayCell, isToday && n.monthDayToday]}>
                  <Text style={[n.monthDayNumber, isToday && n.monthDayNumberToday]}>{date.getDate()}</Text>
                  {completed ? <View style={[n.monthActivityDot, isToday && n.monthActivityDotToday]} /> : null}
                </View>
              );
            })}
          </View>

          <Text style={n.monthSummary}>
            {monthWorkoutCount} {monthWorkoutCount === 1 ? 'workout' : 'workouts'} completed this month
          </Text>
        </DesignCard>

        {!state.history.length ? (
          <View style={n.emptyStateCard}>
            <Text style={n.emptyStateTitle}>Your progress starts here</Text>
            <DesignBodyText style={n.emptyStateText}>Complete a workout and your consistency, strength, and bodyweight history will appear here.</DesignBodyText>
          </View>
        ) : (
          <>
            <View style={n.progressSectionHeader}>
              <DesignSectionTitle>Recent activity</DesignSectionTitle>
              <Pressable accessibilityRole="button" accessibilityLabel="Open your workout history" onPress={() => router.push('/history')} style={n.progressSectionAction}>
                <Text style={n.progressSectionActionText}>History</Text>
              </Pressable>
            </View>

            <View style={n.listCard}>
              {recent.map(item => {
                const stats = calculateWorkoutStats(item, state.units);
                return (
                  <Pressable key={item.id} accessibilityRole="button" onPress={() => openHistoryItem(item.id)} style={n.listRow}>
                    <View style={n.listCopy}>
                      <Text style={n.listTitle}>{item.name}</Text>
                      <Text style={n.listMeta}>{formatDate(workoutTimestamp(item, now))} · {item.duration} min · {stats.exerciseCount} exercises</Text>
                    </View>
                    <Text style={n.listValue}>{Math.round(stats.volume).toLocaleString()} {state.units}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={n.progressSectionHeader}>
              <DesignSectionTitle>Strength progress</DesignSectionTitle>
            </View>
            {exercisesWithHistory.length ? (
              <View style={n.listCard}>
                {exercisesWithHistory.map(id => {
                  const exercise = exerciseById(id);
                  const progress = calculateExerciseProgress(state.history, id, now, state.units);
                  if (!progress) return null;
                  return (
                    <Pressable key={id} accessibilityRole="button" onPress={() => router.push({ pathname: '/progress/exercise/[id]', params: { id } })} style={n.listRow}>
                      <View style={n.listCopy}>
                        <Text style={n.listTitle}>{exercise.name}</Text>
                        <Text style={n.listMeta}>Best {progress.bestWeight > 0 ? `${progress.bestWeight.toFixed(1).replace(/\.0$/, '')} ${state.units}` : 'Bodyweight'} × {progress.bestReps} reps · {progress.sessions} sessions</Text>
                      </View>
                      <Text style={n.listValue}>{Math.round(progress.totalVolume).toLocaleString()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={n.emptyStateInline}>
                <DesignBodyText style={n.emptyStateText}>Logged exercise performances will be tracked here.</DesignBodyText>
              </View>
            )}

            <View style={n.progressSectionHeader}>
              <DesignSectionTitle>Personal records</DesignSectionTitle>
            </View>
            {records.length ? (
              <View style={n.listCard}>
                {records.map(record => (
                  <View key={record.exerciseId} style={n.listRow}>
                    <View style={n.listCopy}>
                      <Text style={n.listTitle}>{exerciseById(record.exerciseId).name}</Text>
                      <Text style={n.listMeta}>{formatWeight(record.weight, state.units, state.units)} {state.units} × {record.reps} reps · {formatDate(record.date)}</Text>
                    </View>
                    <Text style={n.recordBadge}>BEST</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={n.emptyStateInline}>
                <DesignBodyText style={n.emptyStateText}>Complete a weighted set to establish your first personal record.</DesignBodyText>
              </View>
            )}
          </>
        )}

        <View style={n.progressSectionHeader}>
          <DesignSectionTitle>Body weight</DesignSectionTitle>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/progress/body-weight')} style={n.featureCard}>
          <View style={n.featureHeader}>
            <Text style={n.featureTitle}>{currentWeight ? `${formatWeight(currentWeight.weight, currentWeight.units, state.units)} ${state.units}` : 'No weight entries yet'}</Text>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={C.accent} />
          </View>
          <Text style={n.featureMeta}>
            {currentWeight
              ? change === null
                ? 'Current body weight · log another entry to see a change'
                : `${change > 0 ? '+' : ''}${formatWeight(change, currentWeight.units, state.units)} ${state.units} since previous entry`
              : 'Log a body weight to start a personal trend.'}
          </Text>
        </Pressable>

        <View style={n.progressSectionHeader}>
          <DesignSectionTitle>Nutrition history</DesignSectionTitle>
        </View>
        {nutritionHistory.length ? (
          <View style={n.listCard}>
            {nutritionHistory.map(date => {
              const totals = nutritionTotals(state.foodEntries, date);
              return (
                <View key={date} style={n.listRow}>
                  <View style={n.listCopy}>
                    <Text style={n.listTitle}>{nutritionDateLabel(date)}</Text>
                    <Text style={n.listMeta}>{totals.meals} {totals.meals === 1 ? 'food entry' : 'food entries'} · Protein {displayNumber(totals.protein)}g · Carbs {displayNumber(totals.carbs)}g · Fat {displayNumber(totals.fat)}g</Text>
                  </View>
                  <Text style={n.listValue}>{totals.calories.toLocaleString()} kcal</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={n.emptyStateInline}>
            <DesignBodyText style={n.emptyStateText}>Past daily totals will appear here after you log food on another day.</DesignBodyText>
          </View>
        )}
      </View>
    </Screen>
  );
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
  return <Screen><TopBar title="Body weight" /><Heading>Body weight</Heading><Copy>Track your check-ins over time. Values are shown in your selected unit.</Copy>{entries[0] ? <Card style={{ marginTop: 12 }}><Eyebrow>CURRENT</Eyebrow><Text style={s.chartValue}>{formatWeight(entries[0].weight, entries[0].units, state.units)} {state.units}</Text><Copy>{change === null ? 'Log another entry to see your change.' : `${change > 0 ? '+' : ''}${formatWeight(change, entries[0].units, state.units)} ${state.units} since previous entry`}</Copy></Card> : <Empty title="No weight entries yet" detail="Log your first check-in to start a personal body weight history." />}<SectionTitle title="Log a weight" /><TextInput accessibilityLabel={`Body weight in ${state.units}`} keyboardType="decimal-pad" value={value} onChangeText={setValue} placeholder={`Weight in ${state.units}`} placeholderTextColor={C.muted} style={uiStyles.input} /><Action title="Save weight" disabled={!Number.isFinite(Number(value.replace(',', '.'))) || Number(value.replace(',', '.')) <= 0} onPress={save} /><SectionTitle title="Previous entries" />{entries.length ? entries.map(entry => <Card key={entry.id}><View style={s.historyCardTop}><Text style={[s.cardTitle, { flex: 1 }]}>{formatDate(entry.recordedAt)}</Text><Text style={s.weightValue}>{formatWeight(entry.weight, entry.units, state.units)} {state.units}</Text></View></Card>) : <Empty title="Nothing logged yet" detail="Your previous entries will be listed here." />}</Screen>;
}

function ProgressStat({ label, value }: { label: string; value: string }) { return <View style={s.progressStat}><Text style={s.progressStatValue} numberOfLines={1}>{value}</Text><Text style={s.progressStatLabel}>{label}</Text></View>; }
function formatDate(timestamp: number) { return timestamp ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : 'Date unavailable'; }

const meals: FoodMeal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const numberValue = (value: string) => Number(value.trim().replace(',', '.'));
const displayNumber = (value: number) => Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1).replace(/\.0$/, '');

type NutritionStatus = 'normal' | 'approaching' | 'atTarget' | 'aboveTarget' | 'wellAbove';
function nutritionStatus(value: number, target: NutritionTargetValue | undefined): NutritionStatus {
  if (!target || targetMidpoint(target) <= 0) return 'normal';
  const ratio = value / targetMidpoint(target);
  if (ratio < 0.8) return 'normal';
  if (ratio < 0.95) return 'approaching';
  if (ratio <= 1.05) return 'atTarget';
  if (ratio <= 1.2) return 'aboveTarget';
  return 'wellAbove';
}

const nutritionStatusStyle = (status: NutritionStatus) => {
  if (status === 'approaching') return { borderColor: '#D9C6A8', backgroundColor: '#FBF7F1', fill: '#B78A53', text: '#8A653A' };
  if (status === 'atTarget') return { borderColor: '#BFD5C3', backgroundColor: '#F2F7F2', fill: C.green, text: '#477252' };
  if (status === 'aboveTarget') return { borderColor: '#D9C6A8', backgroundColor: '#FBF7F1', fill: '#B78A53', text: '#8A653A' };
  if (status === 'wellAbove') return { borderColor: '#D7B7B2', backgroundColor: '#FBF2F1', fill: '#B65B50', text: '#A04435' };
  return { borderColor: C.line, backgroundColor: C.surface, fill: C.accent, text: C.muted };
};

function nutritionStatusLabel(status: NutritionStatus): string {
  if (status === 'approaching') return 'Approaching target';
  if (status === 'atTarget') return 'At target';
  if (status === 'aboveTarget' || status === 'wellAbove') return 'Above target';
  return 'Normal';
}

const n = StyleSheet.create({
  homeHeroBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  homeHeroBodyMobile: { gap: 8 },
  homeHeroText: { flex: 1, minWidth: 0 },
  homeHeroVisual: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  homeHero: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  homeHeroVisualWide: { width: '36%', maxWidth: 380, height: 246 },
  homeHeroVisualMobile: { width: '48%', maxWidth: 180, height: 182 },
  homeHeroVisualImage: { width: '100%', height: '100%' },
  screen: { maxWidth: 1280 },
  summary: { gap: 20, alignItems: 'stretch', marginTop: 8, marginBottom: 10 },
  calorieCard: { minHeight: 250, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, borderRadius: 16 },
  calorieCardMobile: { minHeight: 195, paddingHorizontal: 20, paddingVertical: 20 },
  calorieValue: { fontSize: 38, lineHeight: 44 },
  calorieTrack: { height: 11, marginTop: 14 },
  calorieFill: { height: 11 },
  macroPanel: { minHeight: 250, paddingHorizontal: 24, paddingVertical: 18, justifyContent: 'space-around', borderRadius: 16 },
  macroPanelMobile: { minHeight: 230, paddingHorizontal: 20, paddingVertical: 15 },
  macroRow: { paddingVertical: 12 },
  macroName: { fontSize: 14 },
  macroTotal: { fontSize: 14 },
  macroTrack: { height: 7, marginTop: 9 },
  macroFill: { height: 7 },
  macroStatus: { fontSize: 10, marginTop: 6 },
  nutritionHeaderBlock: { paddingTop: 4, paddingBottom: 10 },
  nutritionHeaderDate: { color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 },
  nutritionSummaryCard: { borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 18, paddingVertical: 18 },
  nutritionSummaryTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  nutritionSummaryText: { flex: 1, minWidth: 0 },
  nutritionSummaryLabel: { color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7 },
  nutritionSummaryValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 38, lineHeight: 42, marginTop: 8 },
  nutritionSummaryValueUnit: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 14 },
  nutritionSummaryMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 10 },
  nutritionSummaryTrack: { height: 9, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  nutritionSummaryProgress: { height: 9, borderRadius: 999 },
  nutritionSummarySecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  nutritionSummaryStatus: { fontFamily: 'InterSemiBold', fontSize: 11 },
  nutritionSummaryStatusContext: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11 },
  nutritionAddFoodButton: { minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.background },
  nutritionAddFoodText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 },
  nutritionMacroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  nutritionMacroCard: { flexBasis: '31%', flexGrow: 1, minWidth: 92, borderWidth: 1, borderColor: C.line, borderRadius: 16, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 12 },
  nutritionMacroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  nutritionMacroName: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 },
  nutritionMacroValue: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 },
  nutritionMacroTarget: { color: C.muted, fontFamily: 'InterRegular', fontSize: 10, marginTop: 8 },
  nutritionMacroTrack: { height: 6, borderRadius: 999, backgroundColor: C.line, overflow: 'hidden', marginTop: 9 },
  nutritionMacroFill: { height: 6, borderRadius: 999 },
  nutritionMacroStatus: { fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 6 },
  nutritionTargetCard: { marginTop: 14, paddingVertical: 14 },
  nutritionNoteRow: { marginTop: 14, paddingHorizontal: 4 },
  nutritionNoteText: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 17 },
  nutritionSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  nutritionSectionTitle: { color: C.ink },
  nutritionSectionAction: { minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  nutritionSectionActionText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 },
  nutritionMealGroup: { marginTop: 2, marginBottom: 10 },
  nutritionMealHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  nutritionMealTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 20 },
  nutritionMealAddButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  nutritionMealAddText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 11 },
  nutritionFoodItem: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 12, marginTop: 8 },
  nutritionFoodMain: { flex: 1, minWidth: 0 },
  nutritionFoodName: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  nutritionFoodMetaText: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: 4 },
  nutritionFoodInlineValues: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 4, marginRight: 2 },
  nutritionFoodMicro: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 },
  nutritionFoodActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 2 },
  nutritionFoodLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 11 },
  nutritionFoodDelete: { color: C.muted, fontFamily: 'InterBold', fontSize: 20, minWidth: 20, textAlign: 'center' },
  nutritionEmptyMealState: { borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.surface, paddingVertical: 14, paddingHorizontal: 12, marginTop: 8 },
  nutritionEmptyMealText: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12 },
  nutritionInsightCard: { paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, backgroundColor: C.wash, borderColor: C.wash, borderRadius: 12 },
  nutritionInsightMarker: { width: 3, height: 24, borderRadius: 2, backgroundColor: C.accent },
  nutritionCoachCard: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 14 },
  nutritionCoachTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13 },
  nutritionCoachMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 17, marginTop: 4 },
  trainFeatureGrid: { flexDirection: 'column', gap: 8 },
  trainFeatureGridWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  trainFeatureColumn: { minWidth: 0 },
  trainFeatureColumnWide: { flex: 1 },
  trainTodayCard: { backgroundColor: C.ink, borderColor: C.ink, padding: 17, marginBottom: 0 },
  trainTodayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trainTodayInfo: { flex: 1, minWidth: 0 },
  trainTodayTitle: { color: '#FFF', fontFamily: 'BricolageBold', fontSize: 25, lineHeight: 30, marginBottom: 5 },
  trainTodayMeta: { color: '#D2CEC3', fontSize: 12, lineHeight: 18 },
  trainTodayVisual: { width: '38%', maxWidth: 240, height: 210, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  trainTodayVisualMobile: { width: '44%', maxWidth: 160, height: 166 },
  trainTodayVisualImage: { width: '100%', height: '100%' },
  quickStartList: { gap: 10, paddingBottom: 2 },
  quickStartCard: { width: 138, minHeight: 137, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  quickStartVisual: { height: 62, borderRadius: 9, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', padding: 5, marginBottom: 7 },
  quickStartImage: { width: '100%', height: '100%' },
  quickStartFallback: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  quickStartTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14 },
  quickStartMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 10, marginTop: 2 },
  trainRecommendedCard: { padding: 10, marginBottom: 8, borderRadius: 14 },
  trainRecommendedRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11 },
  trainRecommendedVisual: { width: 82, height: 82, borderRadius: 10, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', padding: 6 },
  trainRecommendedImage: { width: '100%', height: '100%' },
  trainRecommendedFallback: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  trainRecommendedInfo: { flex: 1, minWidth: 0 },
  trainRecommendedTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 3 },
  trainRecommendedMeta: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 },
  trainRecommendedDescription: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 15, marginTop: 4 },
  trainDestinationRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  trainDestinationText: { flex: 1, minWidth: 0 },
  trainDestinationTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14 },
  trainDestinationMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, marginTop: 3 },
  trainScreen: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingTop: 18, paddingBottom: 42 },
  trainPageContent: { width: '100%' },
  headerBlock: { paddingTop: 4, paddingBottom: 10 },
  headerEyebrow: { color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerTitle: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 28, lineHeight: 34, marginTop: 4 },
  headerMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: { marginTop: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: C.ink },
  sectionAction: { minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  sectionActionText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 },
  sectionMeta: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroCard: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  heroCardCompact: { padding: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: 96 },
  heroTopCompact: { minHeight: 0, alignItems: 'flex-start' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: { color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 24, lineHeight: 30, marginTop: 6 },
  heroMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroVisual: { width: 90, height: 90, borderRadius: 16, backgroundColor: C.wash, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  heroVisualCompact: { width: 78, height: 78 },
  heroVisualImage: { width: '100%', height: '100%' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  metaPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.background, color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 },
  heroActionWrap: { marginTop: 16 },
  weekSelector: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  weekDayChoice: { flex: 1, minWidth: 0, minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.background },
  weekDayChoiceToday: { borderColor: '#C8A987' },
  weekDayChoiceSelected: { backgroundColor: C.accent, borderColor: C.accent },
  weekDayChoiceCompleted: { backgroundColor: '#EEF5F0', borderColor: '#D6E5DA' },
  weekDayChoiceRest: { backgroundColor: '#F7F5F0', borderColor: '#EAE6DD' },
  weekDayName: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 },
  weekDayIndicator: { width: 24, height: 20, alignItems: 'center', justifyContent: 'center' },
  weekDayIndicatorToday: { borderRadius: 10, backgroundColor: '#F4EDE3' },
  weekDayIndicatorSelected: { backgroundColor: 'rgba(255,255,255,0.16)' },
  weekDayIndicatorCompleted: { borderRadius: 10, backgroundColor: '#3F7A4E' },
  weekDayMarkText: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12 },
  weekDayMarkCompleted: { color: '#FFF' },
  weekDayNumber: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 },
  weekDayTextSelected: { color: '#FFF' },
  selectedDayPanel: { flexDirection: 'column', gap: 12, marginTop: 14, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  selectedDayText: { flex: 1, minWidth: 0 },
  selectedDayEyebrow: { color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  selectedDayTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 22, lineHeight: 28, marginTop: 4 },
  selectedDayMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  emptyState: { paddingVertical: 14, paddingHorizontal: 6 },
  emptyTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 22, lineHeight: 28 },
  emptyText: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 12 },
  destinationGroup: { flexDirection: 'column', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' },
  destinationGroupCompact: { borderRadius: 14 },
  destinationTile: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  destinationTileCompact: { paddingHorizontal: 12 },
  destinationIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.wash },
  destinationText: { flex: 1, minWidth: 0 },
  destinationTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13 },
  destinationMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 15, marginTop: 3 },
  destinationArrow: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 20 },
  recentList: { borderWidth: 1, borderColor: C.line, borderRadius: 16, backgroundColor: C.surface, overflow: 'hidden' },
  recentRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  recentCopy: { flex: 1, minWidth: 0 },
  recentTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13 },
  recentMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, marginTop: 4 },
  progressScreen: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingTop: 18, paddingBottom: 42 },
  progressPage: { width: '100%', gap: 18 },
  progressHeaderBlock: { paddingTop: 4, paddingBottom: 2 },
  progressHeaderEyebrow: { color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 },
  progressHeaderTitle: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 28, lineHeight: 34, marginTop: 4 },
  progressHeaderMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flexBasis: '48%', minWidth: 150, flexGrow: 1, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  metricLabel: { color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  metricValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 22, lineHeight: 28, marginTop: 8 },
  metricFoot: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: 4 },
  calendarCard: { paddingHorizontal: 16, paddingVertical: 15, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calendarEyebrow: { color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  calendarTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 20, lineHeight: 26, marginTop: 4 },
  progressMonthControls: { flexDirection: 'row', gap: 6 },
  progressMonthControl: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: C.wash },
  progressMonthControlDisabled: { opacity: 0.35 },
  progressMonthControlText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 22, lineHeight: 25 },
  monthCalendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, paddingVertical: 7 },
  monthDayCell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 9 },
  monthDayToday: { backgroundColor: C.wash, borderWidth: 1, borderColor: C.accent },
  monthDayNumber: { color: C.ink, fontFamily: 'InterRegular', fontSize: 12 },
  monthDayNumberToday: { fontFamily: 'InterBold', color: C.accent },
  monthActivityDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  monthActivityDotToday: { backgroundColor: C.ink },
  monthSummary: { textAlign: 'center', color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11, marginTop: 10 },
  progressSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  progressSectionAction: { minHeight: 28, alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  progressSectionActionText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 },
  listCard: { borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, lineHeight: 18 },
  listMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  listValue: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 },
  recordBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#EAF3EC', color: '#3F7A4E', fontFamily: 'InterSemiBold', fontSize: 10, textAlign: 'center', overflow: 'hidden' },
  featureCard: { borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 14 },
  featureHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  featureTitle: { flex: 1, color: C.ink, fontFamily: 'BricolageBold', fontSize: 20, lineHeight: 26 },
  featureArrow: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 20 },
  featureMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  emptyStateCard: { borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 18 },
  emptyStateInline: { borderWidth: 1, borderColor: C.line, borderRadius: 16, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 12 },
  emptyStateTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 22, lineHeight: 28 },
  emptyStateText: { color: C.muted, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  monthCalendar: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 15, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  monthCalendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  monthTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 20 },
  monthControlsOld: { flexDirection: 'row', gap: 6 },
  monthControlOld: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: C.wash },
  monthControlDisabledOld: { opacity: 0.35 },
  monthControlTextOld: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 22, lineHeight: 25 },
  monthCalendarGridOld: { flexDirection: 'row', flexWrap: 'wrap' },
  monthWeekdayOld: { width: `${100 / 7}%`, textAlign: 'center', color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, paddingVertical: 7 },
  monthDayCellOld: { width: `${100 / 7}%`, height: 43, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 9 },
  monthDayTodayOld: { backgroundColor: C.wash, borderWidth: 1, borderColor: C.accent },
  monthDayNumberOld: { color: C.ink, fontFamily: 'InterRegular', fontSize: 12 },
  monthDayNumberTodayOld: { fontFamily: 'InterBold', color: C.accent },
  monthActivityDotOld: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  monthActivityDotTodayOld: { backgroundColor: C.ink },
  monthSummaryOld: { textAlign: 'center', fontSize: 11, marginTop: 9 },
});

export function NutritionScreen() {
  const { width } = useWindowDimensions();
  const { state, personalInformation, removeFood } = useSteadiifit();
  const [entryToDelete, setEntryToDelete] = useState<NutritionEntry | null>(null);
  const entries = state.foodEntries.filter(item => { const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; return item.date === date; });
  const totals = nutritionTotals(state.foodEntries);
  const estimate = calculateNutritionTargets({ dateOfBirth: personalInformation.dateOfBirth, heightCm: personalInformation.heightCm,
    bodyWeightEntries: state.bodyWeightEntries, goal: state.goal, trainingFrequency: state.frequency,
    workoutDurationMinutes: state.duration, trainingFocus: state.trainingFocus });
  const targets = estimate.targets;
  const missingFields = estimate.missingInformation;
  const missingMessage = missingFields.length === 1 ? `Add your ${missingFields[0]}` : `Add your ${missingFields.slice(0, -1).join(', ')} and ${missingFields[missingFields.length - 1]}`;
  const insights = !entries.length ? ['You haven’t logged any food today.'] : [
    targets ? totals.protein >= targets.protein ? 'Protein target is complete for today.' : `${displayNumber(Math.max(0, targets.protein - totals.protein))}g of protein left to reach today’s target.` : `${missingMessage} in Personal Information to calculate nutrition targets.`,
    `You’ve logged ${totals.meals} ${totals.meals === 1 ? 'food item' : 'food items'} today.`
  ];
  const caloriesStatus = nutritionStatus(totals.calories, targets?.calories); const caloriesTone = nutritionStatusStyle(caloriesStatus);
  const remainingCalories = targets ? Math.max(0, targetMidpoint(targets.calories) - totals.calories) : 0;
  const calorieProgress = targets ? Math.min(100, Math.round((totals.calories / targetMidpoint(targets.calories)) * 100)) : 0;
  const calorieLabel = targets ? (remainingCalories > 0 ? `${displayNumber(remainingCalories)} kcal left` : totals.calories > targetMidpoint(targets.calories) ? `${displayNumber(totals.calories - targetMidpoint(targets.calories))} kcal above target` : 'At target') : 'Target unavailable';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const addMeal = (meal: FoodMeal) => router.push({ pathname: '/nutrition/add', params: { meal } });
  const macroCards = [
    { label: 'Protein', value: totals.protein, target: targets?.protein },
    { label: 'Carbs', value: totals.carbs, target: targets?.carbohydrates },
    { label: 'Fat', value: totals.fat, target: targets?.fat },
  ];

  return (
    <Screen style={{ ...s.nutritionScreen, ...n.screen }}>
      <PrimaryHeader title="Nutrition" />
      <View style={n.nutritionHeaderBlock}>
        <DesignCaption style={n.nutritionHeaderDate}>{todayLabel.toUpperCase()}</DesignCaption>
      </View>

      <View style={n.nutritionSummaryCard}>
        <View style={n.nutritionSummaryTopRow}>
          <View style={n.nutritionSummaryText}>
            <DesignCaption style={n.nutritionSummaryLabel}>Consumed</DesignCaption>
            <Text style={n.nutritionSummaryValue}>{totals.calories.toLocaleString()}<Text style={n.nutritionSummaryValueUnit}> kcal</Text></Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Add food" onPress={() => router.push('/nutrition/add')} style={n.nutritionAddFoodButton}>
            <Text style={n.nutritionAddFoodText}>+ Add food</Text>
          </Pressable>
        </View>

        <Text style={n.nutritionSummaryMeta}>
          {targets ? `${formatTarget(targets.calories)} kcal target` : 'Target unavailable for today'}
          {targets && remainingCalories > 0 ? ` · ${displayNumber(remainingCalories)} kcal left` : ''}
          {targets && remainingCalories <= 0 && totals.calories > targetMidpoint(targets.calories) ? ` · ${displayNumber(totals.calories - targetMidpoint(targets.calories))} kcal above target` : ''}
        </Text>

        <View style={[n.nutritionSummaryTrack, { backgroundColor: caloriesTone.backgroundColor }]}>
          <View style={[n.nutritionSummaryProgress, { backgroundColor: caloriesTone.fill, width: `${targets ? calorieProgress : 0}%` }]} />
        </View>

        <View style={n.nutritionSummarySecondary}>
          <Text style={[n.nutritionSummaryStatus, { color: caloriesTone.text }]}> {targets ? nutritionStatusLabel(caloriesStatus) : 'Need personal info for targets'} </Text>
          <Text style={n.nutritionSummaryStatusContext}>{targets ? `${calorieLabel}` : 'Add personal info'} </Text>
        </View>
      </View>

      <View style={n.nutritionMacroGrid}>
        {macroCards.map(({ label, value, target }) => {
          const status = nutritionStatus(value, target);
          const tone = nutritionStatusStyle(status);
          const midpoint = target ? targetMidpoint(target) : 0;
          const fill = target && midpoint > 0 ? Math.min(100, Math.round((value / midpoint) * 100)) : 0;
          return (
            <View key={label} style={n.nutritionMacroCard}>
              <View style={n.nutritionMacroHeader}>
                <Text style={n.nutritionMacroName}>{label}</Text>
                <Text style={n.nutritionMacroValue}>{displayNumber(value)} g</Text>
              </View>
              <Text style={n.nutritionMacroTarget}>{target ? `${formatTarget(target)} target` : 'No target'}</Text>
              <View style={n.nutritionMacroTrack}>
                <View style={[n.nutritionMacroFill, { width: `${fill}%`, backgroundColor: tone.fill }]} />
              </View>
              <Text style={[n.nutritionMacroStatus, { color: tone.text }]}>{target ? nutritionStatusLabel(status) : 'Target unavailable'}</Text>
            </View>
          );
        })}
      </View>

      {!targets ? (
        <Card style={n.nutritionTargetCard}>
          <Text style={s.cardTitle}>Complete Personal Information for targets</Text>
          <Copy>{missingMessage} in Personal Information to calculate your calorie and macro targets. No default targets are substituted.</Copy>
          <Action title="Personal Information" secondary onPress={() => router.push('/profile/personal-information')} />
        </Card>
      ) : (
        <View style={n.nutritionNoteRow}>
          <Text style={n.nutritionNoteText}>Estimated from your profile and training goal. Sex is not collected, so calorie targets are shown as a range.</Text>
        </View>
      )}

      <View style={n.nutritionSectionHeader}>
        <DesignSectionTitle style={n.nutritionSectionTitle}>Meals</DesignSectionTitle>
        <Pressable accessibilityRole="button" accessibilityLabel="Add food" onPress={() => router.push('/nutrition/add')} style={n.nutritionSectionAction}>
          <Text style={n.nutritionSectionActionText}>+ Add</Text>
        </Pressable>
      </View>

      {meals.map(meal => {
        const mealEntries = entries.filter(entry => entry.meal === meal);
        return (
          <View key={meal} style={n.nutritionMealGroup}>
            <View style={n.nutritionMealHeading}>
              <Text style={n.nutritionMealTitle}>{meal}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Add ${meal}`} onPress={() => addMeal(meal)} hitSlop={8} style={n.nutritionMealAddButton}>
                <Text style={n.nutritionMealAddText}>Add</Text>
              </Pressable>
            </View>

            {mealEntries.length ? (
              mealEntries.map(entry => (
                <View key={entry.id} style={n.nutritionFoodItem}>
                  <View style={n.nutritionFoodMain}>
                    <Text style={n.nutritionFoodName} numberOfLines={2}>{entry.name}</Text>
                    <Text style={n.nutritionFoodMetaText}>{entry.quantity !== undefined ? `${displayNumber(entry.quantity)} ${entry.servingUnit ?? 'servings'} · ` : entry.servingUnit ? `${entry.servingUnit} · ` : ''}{entry.calories} kcal</Text>
                  </View>
                  <View style={n.nutritionFoodInlineValues}>
                    <Text style={n.nutritionFoodMicro}>{displayNumber(entry.protein)}P</Text>
                    <Text style={n.nutritionFoodMicro}>{displayNumber(entry.carbs)}C</Text>
                    <Text style={n.nutritionFoodMicro}>{displayNumber(entry.fat)}F</Text>
                  </View>
                  <View style={n.nutritionFoodActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.name}`} onPress={() => router.push({ pathname: '/nutrition/add', params: { entryId: entry.id } })} hitSlop={8}>
                      <Text style={n.nutritionFoodLink}>Edit</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.name}`} onPress={() => setEntryToDelete(entry)} hitSlop={10}>
                      <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} weight="medium" tintColor={C.muted} />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <View style={n.nutritionEmptyMealState}>
                <Text style={n.nutritionEmptyMealText}>Nothing logged yet.</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={n.nutritionSectionHeader}>
        <DesignSectionTitle style={n.nutritionSectionTitle}>What next</DesignSectionTitle>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask Steadiifit about nutrition" onPress={() => router.push('/coach')} style={n.nutritionSectionAction}>
          <Text style={n.nutritionSectionActionText}>Coach</Text>
        </Pressable>
      </View>

      {insights.map((insight, index) => (
        <Card key={index} style={n.nutritionInsightCard}>
          <View style={n.nutritionInsightMarker} />
          <Copy style={{ flex: 1 }}>{insight}</Copy>
        </Card>
      ))}

      <Pressable accessibilityRole="button" accessibilityLabel="Ask Steadiifit about today’s nutrition" onPress={() => router.push('/coach')} style={n.nutritionCoachCard}>
        <Text style={n.nutritionCoachTitle}>Ask Steadiifit about today’s nutrition</Text>
        <Text style={n.nutritionCoachMeta}>Protein, meal timing, or what to add next.</Text>
      </Pressable>

      <Modal visible={Boolean(entryToDelete)} transparent animationType="fade" onRequestClose={() => setEntryToDelete(null)}>
        <View style={s.modalShade}>
          <View style={s.confirmCard}>
            <Eyebrow>PLEASE CONFIRM</Eyebrow>
            <Heading size={22}>Delete food entry?</Heading>
            <Copy>Remove {entryToDelete?.name} from your nutrition log?</Copy>
            <Pressable accessibilityRole="button" onPress={() => { if (entryToDelete) removeFood(entryToDelete.id); setEntryToDelete(null); }} style={s.destructiveAction}>
              <Text style={s.destructiveText}>Delete entry</Text>
            </Pressable>
            <Action title="Cancel" secondary onPress={() => setEntryToDelete(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

export function AddFoodScreen() {
  const { state, addFood, updateFood } = useSteadiifit();
  const params = useLocalSearchParams<{ entryId?: string | string[]; reuseId?: string | string[]; meal?: string | string[] }>();
  const entryId = Array.isArray(params.entryId) ? params.entryId[0] : params.entryId;
  const reuseId = Array.isArray(params.reuseId) ? params.reuseId[0] : params.reuseId;
  const requestedMeal = Array.isArray(params.meal) ? params.meal[0] : params.meal;
  const startingMeal = meals.find(item => item === requestedMeal) ?? 'Breakfast';
  const sourceId = entryId || reuseId;
  const sourceEntry = sourceId ? state.foodEntries.find(entry => entry.id === sourceId) : undefined;
  const isEditing = Boolean(entryId && sourceEntry);
  const [name, setName] = useState(''); const [meal, setMeal] = useState<FoodMeal>(startingMeal);
  const [fields, setFields] = useState({ calories: '', protein: '', carbs: '', fat: '' }); const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(''); const [servingUnit, setServingUnit] = useState('');
  const [initializedSourceId, setInitializedSourceId] = useState('');
  useEffect(() => {
    if (!sourceEntry || !sourceId || initializedSourceId === sourceId) return;
    setName(sourceEntry.name); setMeal(sourceEntry.meal);
    setFields({ calories: String(sourceEntry.calories), protein: String(sourceEntry.protein), carbs: String(sourceEntry.carbs), fat: String(sourceEntry.fat) });
    setQuantity(sourceEntry.quantity === undefined ? '' : String(sourceEntry.quantity)); setServingUnit(sourceEntry.servingUnit ?? '');
    setInitializedSourceId(sourceId);
  }, [sourceEntry, sourceId, initializedSourceId]);
  const update = (key: keyof typeof fields, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  const save = () => {
    const values = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() === '' ? 0 : numberValue(value)])) as Record<keyof typeof fields, number>;
    if (!name.trim()) { setError('Enter a food name to continue.'); return; }
    if (Object.values(values).some(value => !Number.isFinite(value) || value < 0)) { setError('Nutrition values must be valid non-negative numbers.'); return; }
    if (values.calories > 10000 || values.protein > 1000 || values.carbs > 1000 || values.fat > 1000) { setError('That value looks unusually high. Check the serving values and try again.'); return; }
    if (quantity.trim() && (!Number.isFinite(numberValue(quantity)) || numberValue(quantity) <= 0)) { setError('Quantity must be a positive number.'); return; }
    const serving = { ...(quantity.trim() ? { quantity: numberValue(quantity) } : {}), ...(servingUnit.trim() ? { servingUnit: servingUnit.trim() } : {}) };
    if (isEditing && sourceEntry) updateFood({ ...sourceEntry, name: name.trim(), meal, ...values,
      quantity: quantity.trim() ? numberValue(quantity) : undefined,
      servingUnit: servingUnit.trim() || undefined });
    else addFood({ name: name.trim(), meal, ...values, ...serving });
    router.replace('/nutrition');
  };
  const valid = name.trim().length > 0 && Object.values(fields).every(value => value.trim() === '' || (Number.isFinite(numberValue(value)) && numberValue(value) >= 0 && !/[eE+-]/.test(value))) && (!quantity.trim() || (Number.isFinite(numberValue(quantity)) && numberValue(quantity) > 0 && !/[eE+-]/.test(quantity)));
  const field = (label: string, key: keyof typeof fields, unit: string) => <View style={s.foodField}><Text style={s.foodLabel}>{label} <Text style={s.fieldUnit}>({unit})</Text></Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={fields[key]} onChangeText={value => update(key, value)} placeholder="0" placeholderTextColor={C.muted} style={uiStyles.input} maxLength={7} /></View>;
  const suggestions = recentFoods(state.foodEntries.filter(entry => entry.meal === meal), 4);
  const chooseSuggestion = (entry: NutritionEntry) => {
    setName(entry.name); setMeal(entry.meal);
    setFields({ calories: String(entry.calories), protein: String(entry.protein), carbs: String(entry.carbs), fat: String(entry.fat) });
    setQuantity(entry.quantity === undefined ? '' : String(entry.quantity)); setServingUnit(entry.servingUnit ?? ''); setError('');
  };
  return <Screen><TopBar title={isEditing ? 'Edit food' : 'Add food'} /><Eyebrow>FOOD LOG</Eyebrow><Heading>{isEditing ? 'Edit entry' : reuseId && sourceEntry ? 'Quick re-add' : 'Add a meal'}</Heading>
    <Copy>{isEditing ? 'Update this entry in your nutrition log.' : reuseId && sourceEntry ? 'Confirm or adjust this saved food before adding it today.' : 'Nutrition values are estimates entered by you; Steadiifit does not analyze arbitrary dishes.'}</Copy>
    <SectionTitle title="Food name" /><TextInput accessibilityLabel="Food name" value={name} onChangeText={setName} maxLength={40} placeholder="e.g. Greek yogurt" placeholderTextColor={C.muted} style={uiStyles.input} />
    {!isEditing ? <View style={s.mealSuggestions}><Copy>{suggestions.length ? `Previously logged for ${meal}` : `No saved ${meal.toLowerCase()} foods yet`}</Copy><View style={s.suggestionChips}>{suggestions.map(({ entry }) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Use ${entry.name}, ${entry.calories} calories`} onPress={() => chooseSuggestion(entry)} style={s.suggestionChip}><Text numberOfLines={1} style={s.suggestionChipTitle}>{entry.name}</Text><Text style={s.suggestionChipMeta}>{entry.calories} kcal</Text></Pressable>)}</View></View> : null}
    <SectionTitle title="Serving (optional)" /><View style={{ flexDirection: 'row', gap: 8 }}><TextInput accessibilityLabel="Quantity" value={quantity} onChangeText={setQuantity} placeholder="Quantity" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={[uiStyles.input, { flex: 1 }]} maxLength={8} /><TextInput accessibilityLabel="Serving unit" value={servingUnit} onChangeText={setServingUnit} placeholder="g, scoop, plate" placeholderTextColor={C.muted} style={[uiStyles.input, { flex: 2 }]} maxLength={30} /></View>
    <SectionTitle title="Estimated nutrition for this entry" /><View style={s.foodFields}>{field('Calories', 'calories', 'kcal')}{field('Protein', 'protein', 'g')}{field('Carbs', 'carbs', 'g')}{field('Fat', 'fat', 'g')}</View>
    {error ? <Copy style={s.formError}>{error}</Copy> : null}<Action title={isEditing ? 'Save changes' : 'Add food'} disabled={!valid} onPress={save} /><Action title="Cancel" secondary onPress={() => router.back()} />
  </Screen>;
}

const quickPrompts = ["What's my workout today?", 'How is my progress?', 'How much protein do I have left?', 'Explain my plan'];
const coachGreeting = "Hey! I'm your Steadiifit Coach. I can help you understand your workouts, progress, and nutrition. I'm a local demo assistant, not a medical professional.";
const coachUi = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 7 },
  workspace: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  contextPanel: { backgroundColor: designColors.surfaceSubtle, borderWidth: 1, borderColor: designColors.line, borderRadius: designRadii.bg, paddingHorizontal: designSpacing.md, paddingVertical: designSpacing.sm, marginBottom: designSpacing.sm },
  contextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearButton: { minWidth: 48, minHeight: 40, alignItems: 'flex-end', justifyContent: 'center' },
  clearText: { color: designColors.accent, fontFamily: 'InterSemiBold', fontSize: 12 },
  contextRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: designSpacing.sm },
  contextLabel: { width: 82, color: designColors.textMuted, fontFamily: 'InterSemiBold', fontSize: 10 },
  contextValue: { flex: 1, minWidth: 0, color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 11, lineHeight: 16, textAlign: 'right' },
  guidance: { borderLeftWidth: 2, borderLeftColor: designColors.accent, paddingLeft: designSpacing.md, paddingVertical: designSpacing.xs, marginBottom: designSpacing.sm },
  guidanceText: { color: designColors.textSecondary, fontFamily: 'InterRegular', fontSize: 12, lineHeight: 18 },
  promptSection: { marginBottom: designSpacing.xs },
  promptLabel: { color: designColors.textMuted, fontFamily: 'InterBold', fontSize: 10, marginBottom: designSpacing.xs },
  promptRow: { gap: designSpacing.sm, paddingVertical: 2 },
  promptChip: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderColor: designColors.line, borderRadius: designRadii.sm, backgroundColor: designColors.surface, paddingHorizontal: designSpacing.md },
  promptText: { color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 11 },
  chatScroll: { flex: 1, minHeight: 100 },
  chatMessages: { paddingVertical: designSpacing.sm, gap: designSpacing.sm, flexGrow: 1, justifyContent: 'flex-end' },
  chatBubble: { maxWidth: '94%', paddingHorizontal: designSpacing.md, paddingVertical: designSpacing.sm, borderRadius: designRadii.md },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: designColors.surfaceSubtle, borderWidth: 1, borderColor: designColors.line },
  userBubble: { alignSelf: 'flex-end', backgroundColor: designColors.ink },
  chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: designSpacing.sm, borderWidth: 1, borderColor: designColors.line, borderRadius: designRadii.md, backgroundColor: designColors.surface, padding: designSpacing.xs },
  chatInput: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 100, paddingHorizontal: designSpacing.sm, paddingTop: designSpacing.sm, paddingBottom: designSpacing.sm, color: designColors.textPrimary, fontFamily: 'InterRegular', fontSize: 13 },
  sendButton: { width: 44, height: 44, borderRadius: designRadii.sm, backgroundColor: designColors.ink, alignItems: 'center', justifyContent: 'center' },
});
export function CoachScreen() {
  const { state, appendCoachMessage, clearCoachMessages } = useSteadiifit();
  const coachContext = useMemo(() => deriveCoachContext(state), [state]);
  const todayPlanSummary = coachContext.todayWorkout
    ? coachContext.todayWorkout.workoutId
      ? `${planDayName(coachContext.todayWorkout)} · ${plannedExercises(coachContext.todayWorkout).length} exercises`
      : 'Planned rest day'
    : coachContext.workoutPlan.length ? 'No workout scheduled today' : 'No weekly plan yet';
  const nutritionSummary = `${coachContext.nutritionToday.calories} kcal · ${Math.round(coachContext.nutritionToday.protein)}g protein logged`;
  const [input, setInput] = useState(''); const [typing, setTyping] = useState(false); const [prompt, setPrompt] = useState(''); const scrollRef = useRef<ScrollView>(null); const responseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (responseTimeout.current) clearTimeout(responseTimeout.current); }, []);
  const submit = (value = input) => { const text = value.trim(); if (!text || typing) return; appendCoachMessage({ role: 'user', text }); setInput(''); setTyping(true); setPrompt(text); responseTimeout.current = setTimeout(() => { appendCoachMessage({ role: 'assistant', text: localCoachResponse(text, state, deriveCoachContext(state)) }); setTyping(false); }, 420); };
  const messages = state.coachMessages;
  return <KeyboardAvoidingView style={s.coachRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
      <View style={[s.coachContainer, coachUi.container]}><View style={coachUi.workspace}>
        <PrimaryHeader title="AI Coach" />
        <View style={coachUi.contextPanel}>
          <View style={coachUi.contextHeader}>
            <Eyebrow>YOUR CONTEXT</Eyebrow>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear conversation" onPress={() => { if (responseTimeout.current) clearTimeout(responseTimeout.current); setTyping(false); clearCoachMessages(); }} style={coachUi.clearButton}><Text style={coachUi.clearText}>Clear</Text></Pressable>
          </View>
          <View style={coachUi.contextRow}><Text style={coachUi.contextLabel}>TODAY</Text><Text numberOfLines={2} style={coachUi.contextValue}>{todayPlanSummary}</Text></View>
          <View style={coachUi.contextRow}><Text style={coachUi.contextLabel}>GOAL</Text><Text numberOfLines={1} style={coachUi.contextValue}>{coachContext.userGoal}</Text></View>
          <View style={coachUi.contextRow}><Text style={coachUi.contextLabel}>NUTRITION</Text><Text numberOfLines={1} style={coachUi.contextValue}>{nutritionSummary}</Text></View>
        </View>
        {!messages.length ? <View style={coachUi.guidance}><Text style={coachUi.guidanceText}>{coachGreeting}</Text></View> : null}
        <View style={coachUi.promptSection}>
          <Text style={coachUi.promptLabel}>QUICK QUESTIONS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={coachUi.promptRow}>{quickPrompts.map(item => <Pressable key={item} accessibilityRole="button" onPress={() => submit(item)} style={coachUi.promptChip}><Text style={coachUi.promptText}>{item}</Text></Pressable>)}</ScrollView>
        </View>
        <ScrollView ref={scrollRef} style={coachUi.chatScroll} contentContainerStyle={coachUi.chatMessages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map(message => <View key={message.id} style={[coachUi.chatBubble, message.role === 'user' ? coachUi.userBubble : coachUi.assistantBubble]}><Text style={[s.chatText, message.role === 'user' && s.userChatText]}>{message.text}</Text></View>)}
        {typing ? <View accessibilityLabel={`Coach is responding to ${prompt}`} style={[coachUi.chatBubble, coachUi.assistantBubble, s.typingBubble]}><ActivityIndicator size="small" color={C.accent} /><Text style={s.chatTyping}>Thinking locally…</Text></View> : null}
        </ScrollView>
        <View style={coachUi.chatInputRow}><TextInput accessibilityLabel="Message your coach" value={input} onChangeText={setInput} onSubmitEditing={() => submit()} returnKeyType="send" placeholder="Ask about your training…" placeholderTextColor={C.muted} style={coachUi.chatInput} multiline maxLength={500} blurOnSubmit /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!input.trim() || typing} onPress={() => submit()} style={[coachUi.sendButton, (!input.trim() || typing) && { opacity: 0.45 }]}><Text style={s.sendButtonText}>↑</Text></Pressable></View>
      <Copy style={s.localNote}>Local demo responses · Not medical advice</Copy>
      </View></View>
  </KeyboardAvoidingView>;
}

const profileUi = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: designSpacing.md, paddingTop: designSpacing.sm, paddingBottom: designSpacing.xl },
  avatar: { width: 54, height: 54, borderRadius: designRadii.full, backgroundColor: designColors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: designColors.textInverse, fontFamily: 'InterBold', fontSize: 15 },
  identityText: { flex: 1, minWidth: 0 },
  name: { color: designColors.textPrimary, fontFamily: 'BricolageExtraBold', fontSize: 25, lineHeight: 31 },
  accountType: { color: designColors.textSecondary, fontSize: 12, marginTop: designSpacing.xs },
  controlList: { borderTopWidth: 1, borderColor: designColors.line },
  controlRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: designSpacing.md, borderBottomWidth: 1, borderColor: designColors.line, paddingVertical: designSpacing.sm },
  controlIcon: { width: 40, height: 40, borderRadius: designRadii.md, backgroundColor: designColors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  controlCopy: { flex: 1, minWidth: 0 },
  controlTitle: { color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 14 },
  controlDescription: { color: designColors.textMuted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs },
  accountSection: { marginTop: designSpacing.md },
});

export function ProfileScreen() {
  const { state } = useSteadiifit();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const logOut = async () => {
    setSigningOut(true);
    setSignOutError('');
    try {
      const result = await signOut();
      if (result.error) setSignOutError(result.error.message);
    } catch {
      setSignOutError('Could not log out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };
  return <Screen style={profileUi.content}>
    <PrimaryHeader title="Profile" />
    <View style={profileUi.identity}>
      <View style={profileUi.avatar}><Text style={profileUi.avatarText}>{(state.name.trim().slice(0, 2) || 'A').toUpperCase()}</Text></View>
      <View style={profileUi.identityText}>
        <Text style={profileUi.name} numberOfLines={2} adjustsFontSizeToFit>{state.name || 'Athlete'}</Text>
        <Text style={profileUi.accountType}>Personal account</Text>
      </View>
    </View>
    <View style={profileUi.controlList}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile/personal-information')} style={({ pressed }) => [profileUi.controlRow, pressed && { opacity: 0.68 }]}>
        <View style={profileUi.controlIcon}><SymbolView name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }} size={19} weight="medium" tintColor={designColors.accent} /></View>
        <View style={profileUi.controlCopy}><Text style={profileUi.controlTitle}>Personal Information</Text><Text style={profileUi.controlDescription}>Name, date of birth, height, current weight, and units</Text></View>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={designColors.textMuted} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [profileUi.controlRow, pressed && { opacity: 0.68 }]}>
        <View style={profileUi.controlIcon}><SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} size={19} weight="medium" tintColor={designColors.accent} /></View>
        <View style={profileUi.controlCopy}><Text style={profileUi.controlTitle}>Settings</Text><Text style={profileUi.controlDescription}>Units, workout behavior, and local data</Text></View>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} weight="medium" tintColor={designColors.textMuted} />
      </Pressable>
    </View>
    <View style={profileUi.accountSection}>
      <SectionTitle title="Account" />
      <Action title={signingOut ? 'Logging out…' : 'Log out'} secondary disabled={signingOut} onPress={() => void logOut()} />
      {signOutError ? <Copy>{signOutError}</Copy> : null}
    </View>
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

export function PersonalInformationScreen() {
  const { state, personalInformation, profileLoaded, savePersonalInformation } = useSteadiifit();
  const latestWeight = sortedBodyWeight(state.bodyWeightEntries)[0];
  const [name, setName] = useState(state.name);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCmDraft, setHeightCmDraft] = useState('');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [units, setUnits] = useState<WeightUnit>(state.units);
  const [newWeight, setNewWeight] = useState('');

  useEffect(() => {
    if (!profileLoaded) return;
    setName(state.name);
    setDateOfBirth(personalInformation.dateOfBirth ?? '');
    const cm = personalInformation.heightCm;
    setHeightCmDraft(cm === null ? '' : String(cm));
    if (cm !== null) {
      const totalInches = cm / 2.54;
      const wholeFeet = Math.floor(totalInches / 12);
      setFeet(String(wholeFeet));
      setInches(String(Number((totalInches - wholeFeet * 12).toFixed(1))));
    } else {
      setFeet(''); setInches('');
    }
    setUnits(state.units);
  }, [profileLoaded]);

  const changeUnits = (next: WeightUnit) => {
    if (next === units) return;
    const amount = Number(newWeight.replace(',', '.'));
    if (newWeight.trim() && Number.isFinite(amount)) setNewWeight(String(Number(convertWeight(amount, units, next).toFixed(1))));
    if (next === 'lb') {
      const cm = Number(heightCmDraft.replace(',', '.'));
      if (heightCmDraft.trim() && Number.isFinite(cm)) {
        const totalInches = cm / 2.54;
        const wholeFeet = Math.floor(totalInches / 12);
        setFeet(String(wholeFeet));
        setInches(String(Number((totalInches - wholeFeet * 12).toFixed(1))));
      }
    } else {
      const feetValue = Number(feet.replace(',', '.'));
      const inchesValue = Number(inches.replace(',', '.'));
      if ((feet.trim() || inches.trim()) && Number.isFinite(feetValue) && Number.isFinite(inchesValue)) {
        setHeightCmDraft(String(Number(((feetValue * 12 + inchesValue) * 2.54).toFixed(1))));
      }
    }
    setUnits(next);
  };

  const parsedDate = dateOfBirth.trim();
  const dateValid = !parsedDate || isValidDateOfBirth(parsedDate);
  const metricHeight = Number(heightCmDraft.replace(',', '.'));
  const imperialHeight = (Number(feet.replace(',', '.')) * 12 + Number(inches.replace(',', '.'))) * 2.54;
  const hasHeight = units === 'kg' ? heightCmDraft.trim().length > 0 : feet.trim().length > 0 || inches.trim().length > 0;
  const heightCm = hasHeight ? (units === 'kg' ? metricHeight : imperialHeight) : null;
  const heightValid = heightCm === null || (Number.isFinite(heightCm) && heightCm >= 50 && heightCm <= 280);
  const parsedWeight = Number(newWeight.replace(',', '.'));
  const weightValid = !newWeight.trim() || (Number.isFinite(parsedWeight) && parsedWeight > 0 && parsedWeight <= (units === 'kg' ? 500 : 1102));
  const save = () => {
    if (!dateValid || !heightValid || !weightValid) return;
    savePersonalInformation({
      name,
      dateOfBirth: parsedDate || null,
      heightCm: heightCm === null ? null : Number(heightCm.toFixed(1)),
      units,
      weight: newWeight.trim() ? parsedWeight : null,
    });
    router.back();
  };

  return <Screen>
    <TopBar title="Personal Information" />
    <Eyebrow>YOUR DETAILS</Eyebrow><Heading>Personal Information</Heading>
    <SectionTitle title="Name" /><TextInput accessibilityLabel="Name" value={name} onChangeText={setName} maxLength={40} placeholder="Your name" placeholderTextColor={C.muted} style={uiStyles.input} />
    <SectionTitle title="Date of birth" /><TextInput accessibilityLabel="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation" style={uiStyles.input} />
    {!dateValid ? <Copy>Enter a valid date in YYYY-MM-DD format.</Copy> : null}
    <SectionTitle title="Unit system" />
    <View style={{ marginTop: 2 }}><Option title="Metric · kg / cm" selected={units === 'kg'} onPress={() => changeUnits('kg')} /><Option title="Imperial · lb / ft" selected={units === 'lb'} onPress={() => changeUnits('lb')} /></View>
    <SectionTitle title="Height" />
    {units === 'kg' ? <TextInput accessibilityLabel="Height in centimeters" value={heightCmDraft} onChangeText={setHeightCmDraft} placeholder="Height in cm" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={uiStyles.input} /> : <View style={{ flexDirection: 'row', gap: 10 }}><TextInput accessibilityLabel="Height in feet" value={feet} onChangeText={setFeet} placeholder="Feet" placeholderTextColor={C.muted} keyboardType="number-pad" style={[uiStyles.input, { flex: 1 }]} /><TextInput accessibilityLabel="Height in inches" value={inches} onChangeText={setInches} placeholder="Inches" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={[uiStyles.input, { flex: 1 }]} /></View>}
    {!heightValid ? <Copy>Enter a height between 50 cm and 280 cm.</Copy> : null}
    <SectionTitle title="Current weight" />
    <Card><Text style={s.cardTitle}>{latestWeight ? `${formatWeight(latestWeight.weight, latestWeight.units, units)} ${units}` : 'Not logged yet'}</Text><Copy>The latest bodyweight entry is shown here. New measurements are added to your history.</Copy></Card>
    <SectionTitle title={`Add a weight (${units})`} /><TextInput accessibilityLabel={`New weight in ${units}`} value={newWeight} onChangeText={setNewWeight} placeholder={`Weight in ${units}`} placeholderTextColor={C.muted} keyboardType="decimal-pad" style={uiStyles.input} />
    {!weightValid ? <Copy>Enter a valid positive weight.</Copy> : null}
    <Action title="Save personal information" disabled={!dateValid || !heightValid || !weightValid} onPress={save} />
  </Screen>;
}

const settingsUi = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: designSpacing.xxl },
  group: { borderTopWidth: 1, borderColor: designColors.line },
  preferenceRow: { paddingVertical: designSpacing.md, borderBottomWidth: 1, borderColor: designColors.line },
  preferenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: designSpacing.md },
  preferenceTitle: { color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 14 },
  preferenceDescription: { color: designColors.textMuted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs },
  durationChoices: { flexDirection: 'row', gap: designSpacing.sm, marginTop: designSpacing.md },
  durationChoice: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: designColors.line, borderRadius: designRadii.sm, backgroundColor: designColors.surface },
  durationChoiceSelected: { borderColor: designColors.accent, backgroundColor: designColors.accentSubtle },
  durationChoiceText: { color: designColors.textSecondary, fontFamily: 'InterSemiBold', fontSize: 12 },
  durationChoiceTextSelected: { color: designColors.accent, fontFamily: 'InterBold' },
  toggleRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: designSpacing.md, paddingVertical: designSpacing.sm, borderBottomWidth: 1, borderColor: designColors.line },
  toggleCopy: { flex: 1, minWidth: 0 },
  localNote: { color: designColors.textMuted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 17, marginBottom: designSpacing.md },
  dataList: { borderTopWidth: 1, borderColor: designColors.line },
  dataRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: designSpacing.md, paddingVertical: designSpacing.sm, borderBottomWidth: 1, borderColor: designColors.line },
  dataRowCopy: { flex: 1, minWidth: 0 },
  dataTitle: { color: designColors.textPrimary, fontFamily: 'InterSemiBold', fontSize: 13 },
  dataDescription: { color: designColors.textMuted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs },
  dataActionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  resetRow: { backgroundColor: designColors.errorSubtle, paddingHorizontal: designSpacing.sm, borderRadius: designRadii.sm, borderBottomWidth: 0, marginTop: designSpacing.md },
});

type ConfirmAction = { title: string; message: string; confirm: string; onConfirm: () => void };
export function SettingsScreen() {
  const { state, updateWorkoutSettings, clearWorkoutHistory, clearNutritionData, resetPlan, resetAppData } = useSteadiifit();
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const confirm = (value: ConfirmAction) => setConfirmation(value);
  const finish = () => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); };
  const toggle = (enabled: boolean) => <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} accessibilityLabel="Automatically start rest timer" onPress={() => updateWorkoutSettings({ autoStartRest: !enabled })} style={[s.switch, enabled && s.switchOn]}><View style={[s.switchThumb, enabled && s.switchThumbOn]} /></Pressable>;
  return <Screen style={settingsUi.content}>
    <PrimaryHeader title="Settings" />
    <SectionTitle title="Workout" />
    <View style={settingsUi.group}>
      <View style={settingsUi.preferenceRow}>
        <Text style={settingsUi.preferenceTitle}>Rest timer duration</Text>
        <Text style={settingsUi.preferenceDescription}>Used between sets. You can still adjust or skip each rest.</Text>
        <View style={settingsUi.durationChoices}>{[60, 90, 120].map(seconds => {
          const selected = state.workoutSettings.defaultRestSeconds === seconds;
          return <Pressable key={seconds} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => updateWorkoutSettings({ defaultRestSeconds: seconds })} style={[settingsUi.durationChoice, selected && settingsUi.durationChoiceSelected]}>
            <Text style={[settingsUi.durationChoiceText, selected && settingsUi.durationChoiceTextSelected]}>{seconds}s</Text>
          </Pressable>;
        })}</View>
      </View>
      <View style={settingsUi.toggleRow}>
        <View style={settingsUi.toggleCopy}><Text style={settingsUi.preferenceTitle}>Automatically start rest timer</Text><Text style={settingsUi.preferenceDescription}>Start countdown after each completed set.</Text></View>
        {toggle(state.workoutSettings.autoStartRest)}
      </View>
    </View>
    <SectionTitle title="Local data" />
    <Text style={settingsUi.localNote}>Some app state stays local. Nutrition entries sync to your signed-in account and load again on restart.</Text>
    <View style={settingsUi.dataList}>
      <Pressable accessibilityRole="button" accessibilityLabel="Regenerate plan" onPress={() => confirm({ title: 'Regenerate your plan?', message: 'Your current weekly plan and exercise edits will be replaced using your saved preferences. Workout history will remain.', confirm: 'Regenerate plan', onConfirm: resetPlan })} style={({ pressed }) => [settingsUi.dataRow, pressed && { opacity: 0.68 }]}>
        <View style={settingsUi.dataRowCopy}><Text style={settingsUi.dataTitle}>Reset plan</Text><Text style={settingsUi.dataDescription}>Regenerate this week from your current preferences. Workout history and progress are kept.</Text></View>
        <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={19} weight="medium" tintColor={designColors.textMuted} style={settingsUi.dataActionIcon} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear workout history" onPress={() => confirm({ title: 'Clear workout history?', message: 'This removes all completed workouts from this in-memory app session. Workout statistics and PRs based on them will disappear. Body-weight entries will remain.', confirm: 'Clear history', onConfirm: clearWorkoutHistory })} style={({ pressed }) => [settingsUi.dataRow, pressed && { opacity: 0.68 }]}>
        <View style={settingsUi.dataRowCopy}><Text style={settingsUi.dataTitle}>Clear workout history</Text><Text style={settingsUi.dataDescription}>Remove completed workouts and progress calculated from those sessions. Body-weight entries are kept.</Text></View>
        <SymbolView name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }} size={19} weight="medium" tintColor={designColors.textMuted} style={settingsUi.dataActionIcon} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear nutrition data" onPress={() => confirm({ title: 'Clear nutrition data?', message: 'This permanently deletes all nutrition entries saved to your account and clears them from the current session.', confirm: 'Clear nutrition', onConfirm: clearNutritionData })} style={({ pressed }) => [settingsUi.dataRow, pressed && { opacity: 0.68 }]}>
        <View style={settingsUi.dataRowCopy}><Text style={settingsUi.dataTitle}>Clear nutrition data</Text><Text style={settingsUi.dataDescription}>Remove all food entries saved to your account.</Text></View>
        <SymbolView name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }} size={19} weight="medium" tintColor={designColors.textMuted} style={settingsUi.dataActionIcon} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset all app data" onPress={() => confirm({ title: 'Reset all app data?', message: 'This clears all current in-memory app data, including your profile settings, active workout, workout history, body weight, nutrition, favorites, and Coach conversation. The app will return to onboarding. This cannot be undone in the current session.', confirm: 'Reset all data', onConfirm: () => { resetAppData(); router.replace('/onboarding'); } })} style={({ pressed }) => [settingsUi.dataRow, settingsUi.resetRow, pressed && { opacity: 0.78 }]}>
        <View style={settingsUi.dataRowCopy}><Text style={settingsUi.dataTitle}>Reset app data</Text><Text style={settingsUi.dataDescription}>Return profile, plan, workouts, favorites, body weight, nutrition, chat, and workout settings to the fresh demo state.</Text></View>
        <SymbolView name={{ ios: 'exclamationmark.triangle', android: 'warning_amber', web: 'warning_amber' }} size={19} weight="medium" tintColor={designColors.error} style={settingsUi.dataActionIcon} />
      </Pressable>
    </View>
    <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}><View style={s.modalShade}><View style={s.confirmCard}><Eyebrow>PLEASE CONFIRM</Eyebrow><Heading size={22}>{confirmation?.title}</Heading><Copy>{confirmation?.message}</Copy><Pressable accessibilityRole="button" onPress={finish} style={s.destructiveAction}><Text style={s.destructiveText}>{confirmation?.confirm}</Text></Pressable><Action title="Cancel" secondary onPress={() => setConfirmation(null)} /></View></View></Modal>
  </Screen>;
}

export function AboutScreen() {
  const version = Constants.expoConfig?.version;
  return <Screen><PrimaryHeader title="About" /><Eyebrow>STEADIIFIT</Eyebrow><Heading>Your personalized fitness companion.</Heading><Copy>A focused place to plan workouts, track progress, and build consistent habits.</Copy><Card style={s.aboutBrand}><Text style={s.brand}>Steadiifit</Text><Copy style={{ marginTop: 8 }}>Version {version ?? 'Unavailable'}</Copy><Copy style={s.aboutFootnote}>Frontend demo · Your app data stays in this session and is not synced.</Copy></Card><SectionTitle title="Privacy" /><Card><Text style={s.cardTitle}>Privacy information</Text><Copy>A privacy policy will be available if cloud services are introduced. This frontend demo does not connect to a backend or sync your data.</Copy></Card><SectionTitle title="Terms" /><Card><Text style={s.cardTitle}>Terms of use</Text><Copy>Terms of use have not been published for this frontend demo.</Copy></Card></Screen>;
}

const s = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: 'space-between', paddingTop: 70, paddingBottom: 24 }, welcomeBrand: { marginTop: 90, gap: 9 },
  progressTrack: { height: 5, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden', marginBottom: 19 }, progressFill: { height: 5, backgroundColor: C.ink },
  loading: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryHeader: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, headerAvatar: { borderRadius: 20, backgroundColor: C.ink }, hamburger: { width: 20, height: 16, justifyContent: 'space-between', paddingVertical: 1 }, hamburgerLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: C.ink }, primaryHeaderTitle: { flex: 1, textAlign: 'center', color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 }, drawerShade: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(21,20,15,0.42)' }, drawerPanel: { width: 310, maxWidth: '84%', height: '100%', backgroundColor: C.background, paddingTop: 22, paddingHorizontal: 18 }, drawerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 5, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }, drawerClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, drawerCloseText: { color: C.muted, fontSize: 27, lineHeight: 30 }, drawerItem: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: C.line, paddingHorizontal: 5 }, drawerItemText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14 }, brand: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink }, avatarBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, avatarLabel: { color: '#FFF', fontFamily: 'InterBold', fontSize: 16 },
  cardTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 5 }, statsRow: { flexDirection: 'row', gap: 8, marginTop: 9 }, stat: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 14 }, statValue: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 }, statLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 3 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }, day: { color: C.muted, fontSize: 11, fontWeight: '700', width: 34 }, planDayImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: C.wash }, chevron: { color: C.muted, fontSize: 22 }, recommend: { backgroundColor: '#FBF7F1', borderColor: '#D8C4AD', paddingVertical: 13 }, workoutDiscoveryCard: { padding: 10 }, workoutDiscoveryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 }, workoutVisualPanel: { width: 96, height: 104, borderRadius: 12, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', padding: 7 }, workoutVisualImage: { width: '100%', height: '100%' }, workoutVisualFallback: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, lineHeight: 14, textAlign: 'center' }, workoutDiscoveryInfo: { flex: 1, minWidth: 0, justifyContent: 'center' }, workoutMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, workoutDescription: { fontSize: 12, lineHeight: 17, marginTop: 6 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, chips: { gap: 7, paddingBottom: 12 }, chip: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: C.ink, borderColor: C.ink }, chipText: { color: C.ink, fontSize: 12, fontWeight: '600' }, chipTextActive: { color: '#FFF' }, prescription: { marginTop: 9, color: C.accent, fontSize: 12, fontWeight: '700' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, customizeIcon: { width: 42, height: 42, borderWidth: 1, borderColor: C.line, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface }, customizeIconText: { fontSize: 22, color: C.ink, lineHeight: 24, marginTop: -8 }, planSummary: { width: '100%', maxWidth: 780, alignSelf: 'center', marginTop: 16, padding: designSpacing.lg, backgroundColor: designColors.surfaceSubtle, borderColor: designColors.line, borderRadius: designRadii.bg }, goalSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: designSpacing.md }, goalSummaryCopy: { flex: 1, minWidth: 0 }, goalSummaryTitle: { color: designColors.textPrimary, fontFamily: 'BricolageExtraBold', fontSize: 22, lineHeight: 28 }, goalSummaryMeta: { fontSize: 12, lineHeight: 18, marginTop: designSpacing.xs }, goalWeekProgress: { borderTopWidth: 1, borderColor: designColors.line, marginTop: designSpacing.lg, paddingTop: designSpacing.md }, goalWeekTrack: { marginTop: 0 }, goalWeekCaption: { fontSize: 11, lineHeight: 16, marginTop: designSpacing.sm }, planMeter: { height: 6, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 14 }, planMeterFill: { height: 6, borderRadius: 4, backgroundColor: C.accent }, planDayCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 }, planDayToday: { borderColor: C.accent, backgroundColor: '#FBF7F1' }, planDayRight: { alignItems: 'flex-end', gap: 5 }, planExerciseActions: { flexDirection: 'row', gap: 18, marginTop: 10 }, planExerciseLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, paddingVertical: 4 },
  setRow: { flexDirection: 'row', gap: 7 }, setButton: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, setButtonDone: { backgroundColor: C.green, borderColor: C.green }, setButtonText: { color: C.ink, fontSize: 11, fontWeight: '700' },
  homeHero: { backgroundColor: C.ink, borderColor: C.ink, marginTop: 1, marginBottom: 15, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderRadius: 20, overflow: 'hidden' }, homeHeroImage: { borderRadius: 20, opacity: 0.32 }, homeHeroDate: { color: '#D2CEC3', fontFamily: 'InterSemiBold', fontSize: 12, marginTop: 1 }, homeHeroTitle: { color: '#FFF', fontFamily: 'BricolageExtraBold', fontSize: 31, lineHeight: 36, marginTop: 13 }, homeHeroMeta: { color: '#D2CEC3', fontFamily: 'InterRegular', fontSize: 13, lineHeight: 19, marginTop: 7 }, homeHeroAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 12, marginTop: 18, paddingHorizontal: 16 }, homeHeroActionText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 14 },
  sessionPauseButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, sessionMenu: { fontSize: 20, color: C.ink, paddingHorizontal: 8 },
  activeWorkoutBody: { width: '100%', maxWidth: 860, alignSelf: 'center' }, activeSessionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 1, marginBottom: 10 }, activeElapsed: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 }, activeStatus: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 }, activePosition: { color: C.muted, fontFamily: 'InterBold', fontSize: 10, textAlign: 'right' }, activeProgressTrack: { height: 3, marginBottom: 20 },
  activeWorkoutMain: { width: '100%' }, activeWorkoutMainWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 }, activeExerciseColumn: { width: '100%', minWidth: 0 }, activeExerciseColumnWide: { width: '42%', maxWidth: 390 }, activeSetColumn: { minWidth: 0 }, activeSetColumnWide: { flex: 1 }, activeExerciseName: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 31, lineHeight: 37, marginBottom: 4 }, activePrescription: { marginBottom: 1 }, activeVisualFrame: { width: '100%', maxHeight: 190, minHeight: 150, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 14, backgroundColor: C.wash, marginTop: 13, marginBottom: 4 }, activeVisualFrameWide: { maxHeight: 310, minHeight: 220 }, activeExerciseImage: { width: '100%', height: '100%' }, activeVisualFallback: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  loggedSet: { minHeight: 46, borderBottomWidth: 1, borderColor: C.line, paddingHorizontal: 11, marginBottom: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, loggedSetCurrent: { borderBottomWidth: 0, borderRadius: 10, backgroundColor: '#FBF7F1', marginBottom: 6 }, loggedSetDone: { opacity: 0.52, borderBottomWidth: 0 }, loggedSetLabel: { color: C.muted, fontFamily: 'InterBold', fontSize: 11 }, loggedSetValue: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13, textAlign: 'right' },
  adjustCard: { marginTop: 8, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderColor: C.line }, adjustHeading: { color: C.ink, fontFamily: 'InterBold', fontSize: 13, marginBottom: 10 }, adjustRow: { flexDirection: 'row', gap: 10 }, adjustField: { flex: 1, minWidth: 0 }, adjustLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11, marginBottom: 6 }, stepper: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }, stepperButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, stepperText: { color: C.ink, fontSize: 22 }, stepValue: { color: C.ink, fontFamily: 'InterBold', fontSize: 14 },
  restFocus: { width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', paddingTop: 12 }, restFocusTime: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 58, lineHeight: 66, marginTop: 6, marginBottom: 19 }, restNext: { width: '100%', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 15, marginBottom: 9 }, restNextTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 20, lineHeight: 26, marginBottom: 4 }, restControls: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', gap: 5, marginTop: 4, marginBottom: 4 }, restControl: { minHeight: 44, minWidth: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, restInline: { borderTopWidth: 1, borderColor: C.line, alignItems: 'center', paddingTop: 10, marginTop: 9 }, restInlineStatus: { color: C.muted, fontFamily: 'InterBold', fontSize: 10 }, restInlineTime: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 22, marginTop: 1 }, restLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, paddingVertical: 7 }, sessionActions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 8 }, sessionAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, sessionActionText: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11 }, activeFinish: { width: '100%', maxWidth: 500, alignSelf: 'center', marginTop: 18 },
  modalShade: { flex: 1, backgroundColor: 'rgba(21,20,15,0.45)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: C.background, padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }, exerciseOption: { paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line },
  complete: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: designSpacing.xxl }, completionContent: { width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center' }, completionMark: { width: 48, height: 48, borderRadius: designRadii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: designColors.successSubtle, marginBottom: designSpacing.lg }, completionEyebrow: { color: designColors.success, fontFamily: 'InterSemiBold', textTransform: 'uppercase', marginBottom: designSpacing.xs }, completionTitle: { textAlign: 'center', marginBottom: designSpacing.xs }, completionWorkout: { maxWidth: '100%', color: designColors.textSecondary, fontFamily: 'InterSemiBold', fontSize: 18, lineHeight: 24, textAlign: 'center' }, completionDuration: { flexDirection: 'row', alignItems: 'baseline', gap: designSpacing.sm, marginTop: designSpacing.xxl }, completionDurationValue: { color: designColors.textPrimary, fontFamily: 'BricolageExtraBold', fontSize: 44, lineHeight: 50 }, completionDurationUnit: { color: designColors.textMuted, fontFamily: 'InterBold', fontSize: 12 }, completionDurationLabel: { color: designColors.textMuted, textTransform: 'uppercase', marginTop: designSpacing.xs }, completionMetrics: { width: '100%', flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: designColors.line, paddingVertical: designSpacing.lg, marginTop: designSpacing.xl }, completionMetric: { flex: 1, minWidth: 0, alignItems: 'center', gap: designSpacing.xs }, completionMetricValue: { width: '100%', color: designColors.textPrimary, fontFamily: 'BricolageBold', fontSize: 22, textAlign: 'center' }, completionMetricLabel: { color: designColors.textMuted, fontSize: 9, textAlign: 'center', textTransform: 'uppercase' }, completionMetricDivider: { width: 1, height: 34, backgroundColor: designColors.line }, completionRecord: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: designSpacing.sm, marginTop: designSpacing.lg }, completionRecordText: { color: designColors.success, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center' }, completionSaved: { maxWidth: 400, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: designSpacing.lg }, completionActions: { width: '100%', gap: designSpacing.sm, marginTop: designSpacing.xl },
  demo: { height: 145, borderRadius: 16, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 15 }, demoText: { color: C.accent, fontWeight: '600', fontSize: 12 },
  favoriteCount: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 }, exerciseSelectionBanner: { backgroundColor: '#FBF7F1', borderWidth: 1, borderColor: '#D8C4AD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 }, exerciseSelectionTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 19, lineHeight: 24, marginBottom: 4 },
  searchRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.surface, paddingHorizontal: 14, marginTop: 4, marginBottom: 10 }, exerciseSearch: { flex: 1, minWidth: 0, height: 50, paddingVertical: 0, color: C.ink, fontFamily: 'InterRegular', fontSize: 14 }, clearSearch: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  exerciseToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }, filterButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11 }, filterButtonActive: { backgroundColor: C.ink, borderColor: C.ink }, filterButtonText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, filterButtonTextActive: { color: '#FFF' }, favoriteToggle: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11 }, favoriteToggleActive: { backgroundColor: C.ink, borderColor: C.ink }, favoriteToggleText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, favoriteToggleTextActive: { color: '#FFF' }, resultCount: { flex: 1, minWidth: 0, textAlign: 'right', color: C.muted, fontFamily: 'InterRegular', fontSize: 11 }, selectedFilters: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, selectedFilterSummary: { flex: 1, minWidth: 0, color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16 }, clearFilters: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, paddingVertical: 7, paddingLeft: 5 },
  filterSheet: { backgroundColor: C.background, padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }, filterChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4, marginBottom: 16 }, filterChoice: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 2 }, filterChoiceActive: { backgroundColor: C.ink, borderColor: C.ink }, filterChoiceText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, filterChoiceTextActive: { color: '#FFF' },
  detailFavorite: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center' }, detailFavoriteIcon: { color: C.accent, fontSize: 20 }, demoHero: { height: 210, borderRadius: 20, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', marginBottom: 19, overflow: 'hidden' }, exerciseIllustrationFrame: { width: '100%', maxWidth: 560, alignSelf: 'center', borderRadius: 20, backgroundColor: C.wash, overflow: 'hidden', marginBottom: 19 }, exerciseIllustrationLandscape: { aspectRatio: 1.7, maxHeight: 225 }, exerciseIllustrationPortrait: { width: '88%', aspectRatio: 1.25, maxHeight: 300 }, exerciseIllustrationImage: { width: '100%', height: '100%' }, demoBar: { height: 8, width: 160, backgroundColor: C.accent, borderRadius: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, demoGrip: { height: 22, width: 52, backgroundColor: C.ink, borderRadius: 5 }, demoPlate: { width: 22, height: 58, borderRadius: 7, backgroundColor: C.ink }, demoKicker: { color: C.muted, fontFamily: 'InterBold', fontSize: 9, letterSpacing: 1.1 }, demoLabel: { color: C.accent, fontFamily: 'InterBold', fontSize: 13, marginTop: 5 }, demoCopy: { fontSize: 11, marginTop: 3 }, detailInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailInfo: { width: '48%', marginBottom: 0, flexGrow: 1 }, detailFormTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 }, detailFormTipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  instructionRow: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line }, instructionNumber: { color: C.accent, fontFamily: 'BricolageBold', fontSize: 16, width: 26 }, instructionText: { flex: 1 }, tipCard: { flexDirection: 'row', gap: 9, paddingVertical: 12 }, tipMark: { color: C.green, fontFamily: 'InterBold', fontSize: 15 }, tipCopy: { flex: 1 }, mistakeRow: { flexDirection: 'row', gap: 9, paddingVertical: 7 }, mistakeMark: { color: C.accent, fontSize: 17 }, performanceSet: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, paddingVertical: 4 }, performanceMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, performanceValue: { color: C.ink, fontFamily: 'InterBold' },
  chartValue: { color: C.ink, fontSize: 23, fontWeight: '800', marginTop: 4 }, chartBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 12 }, bar: { width: 16, backgroundColor: C.accent, borderRadius: 5 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, progressStat: { width: '48%', flexGrow: 1, minHeight: 75, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 15, padding: 13, justifyContent: 'center' }, progressStatValue: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink }, progressStatLabel: { fontFamily: 'InterRegular', color: C.muted, fontSize: 11, marginTop: 4 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between' }, weekDay: { alignItems: 'center', gap: 7, flex: 1 }, weekDot: { width: 27, height: 27, borderRadius: 14, backgroundColor: C.background, borderColor: C.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, weekDotDone: { backgroundColor: C.green, borderColor: C.green }, weekCheck: { color: C.muted, fontSize: 12, fontFamily: 'InterBold' }, weekLabel: { color: C.muted, fontSize: 10, fontFamily: 'InterSemiBold' },
  historyScreen: { paddingBottom: designSpacing.xxl }, historyContent: { width: '100%', maxWidth: 780, alignSelf: 'center' }, historyFilters: { flexDirection: 'row', borderBottomWidth: 1, borderColor: designColors.line, marginBottom: designSpacing.sm }, historyFilter: { flex: 1, minWidth: 0, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: designSpacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' }, historyFilterSelected: { borderBottomColor: designColors.accent }, historyFilterText: { color: designColors.textMuted, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center' }, historyFilterTextSelected: { color: designColors.textPrimary, fontFamily: 'InterBold' }, historyGroupTitle: { color: designColors.textMuted, fontFamily: 'InterBold', marginTop: designSpacing.lg, marginBottom: designSpacing.xs }, historyRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: designSpacing.sm, borderBottomWidth: 1, borderColor: designColors.line, paddingVertical: designSpacing.md }, historyRowPressed: { opacity: 0.68 }, historyRowContent: { flex: 1, minWidth: 0 }, historyRowTitle: { color: designColors.textPrimary, fontFamily: 'BricolageBold', fontSize: 15, lineHeight: 21 }, historyRowMeta: { color: designColors.textMuted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 16, marginTop: designSpacing.xs }, historyRowAside: { alignItems: 'flex-end', gap: designSpacing.xs }, historyRecord: { color: designColors.success, fontFamily: 'InterBold', fontSize: 10 }, historyDuration: { color: designColors.textSecondary, fontFamily: 'InterSemiBold', fontSize: 12 },
  historyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, linkArrow: { color: C.accent, fontSize: 24, lineHeight: 25 }, weightValue: { color: C.ink, fontFamily: 'InterBold', fontSize: 14 }, chartArea: { minHeight: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 4, borderBottomWidth: 1, borderBottomColor: C.line, marginTop: 18, paddingHorizontal: 3 }, chartColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' }, chartPoint: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 9, marginBottom: 4 }, chartBar: { width: '55%', maxWidth: 28, minWidth: 10, backgroundColor: C.accent, borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartDate: { color: C.muted, fontFamily: 'InterRegular', fontSize: 9, marginTop: 5, marginBottom: 4 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 13 }, profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }, profileValue: { color: C.ink, fontSize: 13, fontWeight: '700' }, unitRow: { flexDirection: 'row', gap: 8, marginTop: 12 }, unit: { minWidth: 54, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, borderRadius: 16 }, unitSelected: { backgroundColor: C.ink, borderColor: C.ink }, unitText: { color: C.ink, textAlign: 'center', fontWeight: '700' },
  profileHero: { marginTop: 6, padding: 18 }, profileHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, profileName: { marginBottom: 3 }, profileLinkCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }, settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  unitChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, unitChoice: { flexGrow: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9 }, unitChoiceActive: { backgroundColor: C.ink, borderColor: C.ink }, unitChoiceText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center' }, unitChoiceTextActive: { color: '#FFF' }, restChoice: { minWidth: 68, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9 }, switch: { width: 52, height: 32, borderRadius: 16, backgroundColor: C.line, padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: C.green }, switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: 'flex-start' }, switchThumbOn: { alignSelf: 'flex-end' }, dataNotice: { fontSize: 12, marginBottom: 10 }, resetCard: { borderColor: '#D8B7A8', backgroundColor: '#FBF5F1' }, confirmCard: { backgroundColor: C.background, padding: 22, paddingBottom: 18, borderRadius: 22, marginHorizontal: 20, width: '90%', maxWidth: 430, alignSelf: 'center' }, destructiveAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A04435', borderRadius: 14, marginTop: 16, marginBottom: 8, paddingHorizontal: 16 }, destructiveText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 14 }, aboutBrand: { marginTop: 20, paddingVertical: 22 }, aboutFootnote: { fontSize: 11, marginTop: 13 },
  homeNutritionCard: { marginBottom: 0, borderColor: '#D8C4AD', backgroundColor: '#FBF7F1', padding: 14 }, homeCaloriesLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, homeCaloriesValueLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5 }, homeCalories: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 27, lineHeight: 32 }, homeCaloriesTarget: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12 }, homeNutritionCaption: { color: C.muted, fontFamily: 'InterBold', fontSize: 10, marginBottom: 1 }, homeNutritionPercent: { color: C.accent, fontFamily: 'InterBold', fontSize: 12 }, homeCalorieTrack: { height: 7, borderRadius: 5, backgroundColor: '#E5D9C9', overflow: 'hidden', marginTop: 9 }, homeCalorieFill: { height: 7, borderRadius: 5, backgroundColor: C.accent }, homeMacroList: { borderTopWidth: 1, borderTopColor: '#E5D9C9', marginTop: 10, paddingTop: 5 }, homeMacro: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, homeMacroLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 }, homeMacroValue: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11, textAlign: 'right' }, homeProgressRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.wash, borderRadius: 14, paddingHorizontal: 17, paddingVertical: 13 }, homeProgressMetric: { flex: 1 }, homeProgressValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 26 }, homeProgressLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11, marginTop: 1 }, homeMetricDivider: { width: 1, height: 38, backgroundColor: '#D8CFC1', marginHorizontal: 15 }, homeRecentCard: { paddingVertical: 14, marginBottom: 0 }, homeRecentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, homeRecentTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 4 }, homeRecentMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11 }, nutritionHistoryCalories: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, nutritionHistoryEmpty: { marginTop: 6, marginBottom: 10 },
  nutritionScreen: { width: '100%', maxWidth: 1000, alignSelf: 'center' }, nutritionSummary: { flexDirection: 'row', alignItems: 'stretch', gap: 10 }, nutritionSummaryNarrow: { flexDirection: 'column' }, nutritionSummaryChildNarrow: { flex: undefined, width: '100%' }, calorieCard: { flex: 1.15, minWidth: 0, marginTop: 0, marginBottom: 0, backgroundColor: C.surface, paddingVertical: 13 }, nutritionMacroPanel: { flex: 1, minWidth: 0, justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }, nutritionMacroRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line }, nutritionMacroRowLast: { borderBottomWidth: 0 }, nutritionMacroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, nutritionMacroName: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, nutritionMacroTotal: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'right' }, nutritionMacroTrack: { height: 5, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 6 }, nutritionMacroFill: { height: 5, borderRadius: 4 }, nutritionMacroStatus: { fontFamily: 'InterSemiBold', fontSize: 9, marginTop: 4 }, nutritionMealGroup: { marginTop: 5, marginBottom: 3 }, nutritionMealHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 7 }, nutritionMealTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 19 }, nutritionMealAdd: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }, nutritionMealAddText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 }, foodCard: { paddingVertical: 10, marginBottom: 6, borderRadius: 12 }, macroCard: { flexGrow: 1, width: '48%', minWidth: '47%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 11 }, macroHead: { gap: 4 }, macroTotal: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, macroTrack: { height: 6, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 8 }, macroFill: { height: 6, borderRadius: 4 }, macroRemaining: { fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 7 }, calorieHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, calorieValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 25, marginTop: 2 }, calorieTarget: { color: C.muted, fontFamily: 'InterRegular', fontSize: 13 }, calorieGlyph: { fontSize: 30, color: C.accent }, calorieTrack: { height: 7, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden', marginTop: 9 }, calorieFill: { height: 7, borderRadius: 5, backgroundColor: C.accent }, targetNote: { marginTop: 10, backgroundColor: '#FBF7F1', borderColor: '#D8C4AD' }, targetDisclaimer: { fontSize: 10, marginTop: 5 }, nutritionCoachLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 13, padding: 6 }, foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, removeFood: { color: C.muted, fontSize: 24, paddingHorizontal: 5 }, insightCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13 }, insightMark: { color: C.accent, fontSize: 16 }, mealSuggestions: { marginTop: 3, marginBottom: 3 }, suggestionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }, suggestionChip: { maxWidth: '48%', borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 7 }, suggestionChipTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, suggestionChipMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 9, marginTop: 2 }, foodFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, foodField: { width: '48%', flexGrow: 1 }, foodLabel: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, marginBottom: 5 }, fieldUnit: { color: C.muted, fontFamily: 'InterRegular' }, formError: { color: '#A04435', marginTop: 8 },
  coachRoot: { flex: 1, backgroundColor: C.background }, coachContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 7 }, coachIntroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, coachClear: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, padding: 7 }, chatScroll: { flex: 1, minHeight: 150 }, chatMessages: { paddingVertical: 8, gap: 9, flexGrow: 1, justifyContent: 'flex-end' }, chatBubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 17 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 5 }, userBubble: { alignSelf: 'flex-end', backgroundColor: C.ink, borderBottomRightRadius: 5 }, chatText: { color: C.ink, fontFamily: 'InterRegular', fontSize: 13, lineHeight: 19 }, userChatText: { color: '#FFF' }, typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 }, chatTyping: { color: C.muted, fontSize: 11 }, promptRow: { gap: 7, paddingVertical: 8 }, promptChip: { borderRadius: 18, backgroundColor: C.wash, paddingHorizontal: 11, paddingVertical: 8 }, promptText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 17, backgroundColor: C.surface, padding: 7 }, chatInput: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 9, paddingTop: 9, paddingBottom: 8, color: C.ink, fontFamily: 'InterRegular', fontSize: 13 }, sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, sendButtonText: { color: '#FFF', fontSize: 23, lineHeight: 25 }, localNote: { textAlign: 'center', fontSize: 9, marginTop: 5 },
});
