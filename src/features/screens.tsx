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
import { ExerciseCard } from '@/components/exercises/ExerciseCard';
import { ExerciseVisual } from '@/components/exercises/ExerciseVisual';
import { ExerciseGuidanceVisual } from '@/components/exercises/ExerciseGuidanceVisual';
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
  const [trainContentWidth, setTrainContentWidth] = useState(0);
  const today = (new Date().getDay() + 6) % 7;
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
  const selectedActionLabel = selectedIsActive ? 'Resume workout  →' : selectedPlanDay?.workoutId ? 'View workout  →' : selectedPlanDay ? 'View weekly plan  →' : 'Set up plan  →';
  const latestWorkout = sortWorkoutsNewest(state.history)[0];
  const recentWorkouts = sortWorkoutsNewest(state.history).slice(0, 2);
  const weekStart = startOfWeek(new Date());
  const destinations = [
    { title: 'My Plan', detail: 'Manage your detailed weekly schedule', route: '/(tabs)/plan' as const, symbol: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
    { title: 'Workouts', detail: 'Browse the full workout catalog', route: '/(tabs)/workouts' as const, symbol: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' } },
    { title: 'Exercise Library', detail: 'Browse movements, equipment and muscle groups', route: '/exercises' as const, symbol: { ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' } },
  ] as const;
  return <Screen style={n.trainScreen}>
    <PrimaryHeader title="Train" />
    <View onLayout={event => setTrainContentWidth(event.nativeEvent.layout.width)} style={n.trainPageContent}>
    <View style={n.trainIntro}>
      <Heading size={28}>Train</Heading>
      <Copy>Plan your week, choose a workout, or find an exercise.</Copy>
    </View>
    <View style={n.weekSection}>
      <View style={n.weekSectionHeading}><View><Eyebrow>YOUR SCHEDULE</Eyebrow><Text style={n.weekSectionTitle}>Weekly plan</Text></View><Text style={n.weekRange}>THIS WEEK</Text></View>
    {state.plan.length ? <>
      <View style={n.weekSelector}>
        {weekdayLabels.map((label, weekdayIndex) => {
          const day = state.plan.find(item => item.weekday === weekdayIndex);
          const status = day ? planDayStatus(day, state.history) : undefined;
          const active = Boolean(day?.workoutId && weekdayIndex === today && state.activeWorkout);
          const completed = status === 'Completed';
          const current = weekdayIndex === today;
          let mark = '·';
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
      <View style={n.selectedDayPanel}>
        <View style={n.selectedDayText}>
          <Eyebrow>{dayName(selectedWeekday).toUpperCase()}{selectedIsToday ? ' · TODAY' : ''}{selectedStatus === 'Completed' ? ' · COMPLETED' : ''}</Eyebrow>
          <Text style={n.selectedDayTitle}>{selectedIsActive ? state.activeWorkout?.workoutName : selectedTitle}</Text>
          <Copy style={n.selectedDayMeta}>{selectedIsActive ? 'Workout in progress · Resume when ready' : selectedStatus === 'Completed' ? `Completed${futureWorkout ? ` · Next ${planDayName(futureWorkout)}` : ''}` : selectedStatus === 'Skipped' ? `Not completed · ${selectedDetail}` : selectedDetail}</Copy>
        </View>
        <Pressable accessibilityRole="button" onPress={selectedAction} style={n.selectedDayAction}><Text style={n.selectedDayActionText}>{selectedActionLabel}</Text></Pressable>
      </View>
    </> : <View style={n.weekEmpty}>
      <Text style={n.selectedDayTitle}>No weekly plan yet</Text>
      <Copy>Set up your schedule to see your training week here.</Copy>
      <Action title="Set up plan  →" onPress={() => router.push('/plan/customize')} />
    </View>}
    </View>

    <SectionTitle title="Training" />
    <View style={[n.destinationGroup, trainContentWidth >= 700 && n.destinationGroupWide]}>
      {destinations.map(item => <Pressable key={item.title} accessibilityRole="button" onPress={() => router.push(item.route)} style={[n.destinationTile, trainContentWidth >= 700 && n.destinationTileWide]}>
        <View style={n.destinationIcon}><SymbolView name={item.symbol} size={19} weight="medium" tintColor={C.accent} /></View>
        <View style={n.destinationText}><Text style={n.destinationTitle}>{item.title}</Text><Text numberOfLines={2} style={n.destinationMeta}>{item.detail}</Text></View>
        <Text style={n.destinationArrow}>›</Text>
      </Pressable>)}
    </View>

    {latestWorkout ? <>
      <SectionTitle title="Recent training" action="History" onPress={() => router.push('/history')} />
      <View style={n.recentTrainList}>{recentWorkouts.map(workout => {
        const setCount = workout.exercises.reduce((total, item) => total + item.sets.length, 0);
        return <Pressable key={workout.id} accessibilityRole="button" onPress={() => openHistoryItem(workout.id)} style={n.recentTrainRow}>
          <View style={n.recentTrainCopy}><Text numberOfLines={1} style={n.recentTrainTitle}>{workout.name}</Text><Text style={n.recentTrainMeta}>{formatDate(workoutTimestamp(workout))} · {setCount} {setCount === 1 ? 'set' : 'sets'}</Text></View>
          <Text style={n.destinationArrow}>›</Text>
        </Pressable>;
      })}</View>
    </> : null}
    </View>
  </Screen>;
}

export function HomeScreen() {
  const { state, personalInformation, startPlanWorkout } = useSteadiifit();
  const [heroContentWidth, setHeroContentWidth] = useState(0);
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
  const isRestDay = !todayPlanDay?.workoutId && !activeWorkout;
  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  let workoutFocus: string | undefined;
  if (activeWorkout && activeMatchesPlan && todayPlanDay) workoutFocus = planDayFocus(todayPlanDay);
  else if (activeWorkout) workoutFocus = activeTemplate?.focus ?? 'Session in progress';
  else if (todayPlanDay?.workoutId) workoutFocus = planDayFocus(todayPlanDay);
  const exerciseCount = activeWorkout?.exercises.length ?? (todayPlanDay?.workoutId ? plannedExercises(todayPlanDay).length : 0);
  let duration: number | undefined;
  if (activeWorkout && activeMatchesPlan && todayPlanDay) duration = planDayDuration(todayPlanDay);
  else if (activeWorkout) duration = activeTemplate?.duration;
  else if (todayPlanDay?.workoutId) duration = planDayDuration(todayPlanDay);
  const todayStatus = todayPlanDay?.workoutId ? planDayStatus(todayPlanDay, state.history, now) : undefined;
  const heroEyebrow = activeWorkout ? 'WORKOUT IN PROGRESS'
    : todayPlanDay?.workoutId ? 'TODAY’S PLAN'
      : isRestDay ? 'RECOVERY DAY' : 'YOUR TRAINING PLAN';
  const heroTitle = activeWorkout ? workoutName
    : todayPlanDay?.workoutId ? planWorkoutName
      : isRestDay ? 'Rest and recover' : 'Plan your training';
  const heroMeta = workoutName
    ? `${workoutFocus}${duration ? ` · ${duration} min` : ''}${exerciseCount ? ` · ${exerciseCount} exercises` : ''}`
    : isRestDay && nextPlanDay ? `Next workout · ${new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((nextPlanDay.weekday - today + 7) % 7 || 7)).toLocaleDateString('en-US', { weekday: 'long' })}`
      : !state.plan.length ? 'Set up a weekly plan that fits your routine.' : 'Your scheduled session is complete for today.';
  const canStartToday = Boolean(todayPlanDay?.workoutId && todayStatus !== 'Completed');
  const heroActionLabel = activeWorkout ? 'Continue workout  →'
    : canStartToday ? 'Start workout  →'
      : todayPlanDay?.workoutId ? 'View today’s plan  →'
        : state.plan.length ? 'View training plan  →' : 'Set up plan  →';
  const heroActionAccessibilityLabel = activeWorkout ? 'Continue active workout'
    : canStartToday ? 'Start today’s workout'
      : state.plan.length ? 'View training plan' : 'Set up training plan';
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
  const latestWorkout = sortWorkoutsNewest(state.history, now)[0];
  const streak = calculateWorkoutStreak(state.history, now);
  const monthlyWorkouts = calculateMonthlyWorkoutCount(state.history, now);
  const calorieProgress = nutritionTargets ? Math.min(100, Math.round(nutrition.calories / targetMidpoint(nutritionTargets.calories) * 100)) : 0;
  const heroExerciseId = activeWorkout
    ? activeWorkout.exercises[activeWorkout.exerciseIndex]?.exerciseId
    : todayPlanDay?.workoutId
      ? exerciseVisualForWorkout(workoutById(todayPlanDay.workoutId))?.exerciseId
      : undefined;
  const heroVisual = exerciseVisualForId(heroExerciseId);
  return <Screen>
    <PrimaryHeader title="SteadiFit" />
    <Card style={{ ...s.homeHero, ...n.homeHero }}>
      <View onLayout={event => setHeroContentWidth(event.nativeEvent.layout.width)} style={[n.homeHeroBody, heroContentWidth > 0 && heroContentWidth < 520 && n.homeHeroBodyMobile]}>
        <View style={n.homeHeroText}>
          <Eyebrow>{heroEyebrow}</Eyebrow>
          <Text style={s.homeHeroDate}>{dayLabel}</Text>
          <Text style={s.homeHeroTitle}>{heroTitle}</Text>
          <Text style={s.homeHeroMeta} numberOfLines={2}>{heroMeta}</Text>
        </View>
        {heroVisual ? <View style={[n.homeHeroVisual, heroContentWidth > 0 && heroContentWidth < 520 ? n.homeHeroVisualMobile : n.homeHeroVisualWide]}><ExerciseVisual exerciseId={heroVisual.exerciseId} style={n.homeHeroVisualImage} /></View> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={heroActionAccessibilityLabel} onPress={startOrContinue} style={s.homeHeroAction}>
        <Text style={s.homeHeroActionText}>{heroActionLabel}</Text>
      </Pressable>
    </Card>
    <SectionTitle title="Nutrition today" />
    <Card onPress={() => router.push('/(tabs)/nutrition')} style={s.homeNutritionCard}>
      <View style={s.homeCaloriesLine}><View><Text style={s.homeNutritionCaption}>CALORIES</Text><View style={s.homeCaloriesValueLine}><Text style={s.homeCalories}>{nutrition.calories.toLocaleString()}</Text><Text style={s.homeCaloriesTarget}>/ {nutritionTargets ? formatTarget(nutritionTargets.calories) : '—'} kcal</Text></View></View><Text style={s.homeNutritionPercent}>{nutritionTargets ? `${calorieProgress}%` : '—'}</Text></View>
      <View style={s.homeCalorieTrack}><View style={[s.homeCalorieFill, { width: `${calorieProgress}%` }]} /></View>
      <View style={s.homeMacroList}>
        {[
          { label: 'Protein', value: nutrition.protein, target: nutritionTargets?.protein },
          { label: 'Carbs', value: nutrition.carbs, target: nutritionTargets?.carbohydrates },
          { label: 'Fat', value: nutrition.fat, target: nutritionTargets?.fat },
        ].map(macro => <View key={macro.label} style={s.homeMacro}>
          <Text style={s.homeMacroLabel}>{macro.label}</Text>
          <Text style={s.homeMacroValue}>{displayNumber(macro.value)} / {macro.target === undefined ? '—' : formatTarget(macro.target)} g</Text>
        </View>)}
      </View>
    </Card>
    <SectionTitle title="Consistency" />
    <View style={s.homeProgressRow}>
      <View style={s.homeProgressMetric}><Text style={s.homeProgressValue}>{streak}</Text><Text style={s.homeProgressLabel}>day streak</Text></View>
      <View style={s.homeMetricDivider} />
      <View style={s.homeProgressMetric}><Text style={s.homeProgressValue}>{monthlyWorkouts}</Text><Text style={s.homeProgressLabel}>workouts this month</Text></View>
    </View>
    {latestWorkout ? <>
      <SectionTitle title="Recent workout" action="History" onPress={() => router.push('/history')} />
      <Card onPress={() => openHistoryItem(latestWorkout.id)} style={s.homeRecentCard}>
        <View style={s.homeRecentTop}><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={s.homeRecentTitle}>{latestWorkout.name}</Text><Text style={s.homeRecentMeta}>{formatDate(workoutTimestamp(latestWorkout, now))} · {latestWorkout.duration} min</Text></View><Text style={s.chevron}>›</Text></View>
      </Card>
    </> : null}
  </Screen>;
}

export function PlanScreen() {
  const { state } = useSteadiifit(); const progress = planWeekProgress(state.plan, state.history); const today = (new Date().getDay() + 6) % 7;
  if (!state.plan.length) return <Screen><Heading>My Plan</Heading><Empty title="No plan yet" detail="Choose your goal and schedule to build a weekly plan." /><Action title="Customize plan" onPress={() => router.push('/plan/customize')} /></Screen>;
  const durationPreference = state.duration === 75 ? '75+ min target' : `${state.duration} min target`;
  return <Screen><View style={s.planHeader}><View style={{ flex: 1 }}><Eyebrow>YOUR TRAINING, YOUR WAY</Eyebrow><Heading>My Plan</Heading><Copy>A personalized plan shaped around your routine.</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Customize plan" onPress={() => router.push('/plan/customize')} style={s.customizeIcon}><Text style={s.customizeIconText}>···</Text></Pressable></View>
    <Card style={s.planSummary}><View style={s.planSummaryTop}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{state.goal}</Text><Copy>{state.frequency} training days · {durationPreference} · {state.trainingFocus}</Copy></View><Pill>WEEK {currentPlanWeek(state.planStartedAt)}</Pill></View><View style={s.planMeter}><View style={[s.planMeterFill, { width: `${Math.round(progress.ratio * 100)}%` }]} /></View><Copy style={{ marginTop: 8 }}>{progress.completed} / {progress.planned} workouts completed this week</Copy></Card>
    <SectionTitle title="This week" action="Customize" onPress={() => router.push('/plan/customize')} />
    {state.plan.slice().sort((a, b) => a.weekday - b.weekday).map(day => { const status = planDayStatus(day, state.history); const rest = !day.workoutId; const title = planDayName(day); const exerciseCount = plannedExercises(day).length; const visualExerciseId = rest ? undefined : plannedExercises(day).find(item => Boolean(exerciseVisualForId(item.exerciseId)))?.exerciseId; return <Card key={day.id} style={{ ...s.planDayCard, ...(day.weekday === today && !rest ? s.planDayToday : {}) }} onPress={() => router.push({ pathname: '/plan/day/[day]', params: { day: String(day.weekday) } })}><Text style={s.day}>{weekday[day.weekday]}</Text>{visualExerciseId ? <ExerciseVisual exerciseId={visualExerciseId} style={s.planDayImage} /> : null}<View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{title}</Text><Copy>{rest ? 'Rest and recover' : `${planDayFocus(day)} · ${planDayDuration(day)} min · ${exerciseCount} exercises`}</Copy></View><View style={s.planDayRight}><Pill green={status === 'Completed'}>{status.toUpperCase()}</Pill><Text style={s.chevron}>›</Text></View></Card>; })}
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
      <ExerciseGuidanceVisual mode="illustration" exerciseId={current.exerciseId} fallbackLabel={`${exercise.muscle} · ${exercise.equipment}`} />
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
  const visual = exerciseVisualForId(exercise.id);
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
    {visual ? <View style={[s.exerciseIllustrationFrame, visual.orientation === 'landscape' ? s.exerciseIllustrationLandscape : s.exerciseIllustrationPortrait]}><ExerciseVisual exerciseId={exercise.id} style={s.exerciseIllustrationImage} /></View> : <View style={s.demoHero}><View style={s.demoBar}><View style={s.demoPlate} /><View style={s.demoGrip} /><View style={s.demoPlate} /></View><Text style={s.demoKicker}>MOVEMENT PREVIEW</Text><Text style={s.demoLabel}>{exercise.demo}</Text><Copy style={s.demoCopy}>A visual guide for {exercise.name.toLowerCase()}.</Copy></View>}
    <Heading>{exercise.name}</Heading><Copy>{exercise.category} · {exercise.difficulty}</Copy>
    <SectionTitle title="Muscles & equipment" /><View style={s.detailInfoGrid}><Card style={s.detailInfo}><Eyebrow>PRIMARY</Eyebrow><Text style={s.cardTitle}>{exercise.primaryMuscles.join(', ')}</Text></Card><Card style={s.detailInfo}><Eyebrow>SECONDARY</Eyebrow><Text style={s.cardTitle}>{exercise.secondaryMuscles.length ? exercise.secondaryMuscles.join(', ') : '—'}</Text></Card><Card style={s.detailInfo}><Eyebrow>EQUIPMENT</Eyebrow><Text style={s.cardTitle}>{exercise.equipment}</Text></Card><Card style={s.detailInfo}><Eyebrow>DIFFICULTY</Eyebrow><Text style={s.cardTitle}>{exercise.difficulty}</Text></Card></View>
    <SectionTitle title="Recommended" /><View style={s.statsRow}><Stat value={`${exercise.sets}`} label="Sets" /><Stat value={exercise.repRange} label="Reps / time" /><Stat value={`${exercise.restSeconds}s`} label="Rest" /></View>
    <SectionTitle title="Form Tips" />{exercise.formTips.map(tip => <View key={tip} style={s.detailFormTip}><Text style={s.tipMark}>✓</Text><Copy style={s.detailFormTipText}>{tip}</Copy></View>)}
    <ExerciseDisclosure title="How to perform">{exercise.instructions.map((instruction, index) => <View key={instruction} style={s.instructionRow}><Text style={s.instructionNumber}>{String(index + 1).padStart(2, '0')}</Text><Copy style={s.instructionText}>{instruction}</Copy></View>)}</ExerciseDisclosure>
    <ExerciseDisclosure title="Common mistakes">{exercise.commonMistakes.map(mistake => <View key={mistake} style={s.mistakeRow}><Text style={s.mistakeMark}>•</Text><Copy style={s.instructionText}>{mistake}</Copy></View>)}</ExerciseDisclosure>
    <SectionTitle title="Previous performance" />{previous && previousExercise ? <Card><Eyebrow>LAST PERFORMANCE · {previous.date.toUpperCase()}</Eyebrow>{previousSets.map((set, index) => <Text key={`${previous.id}-${index}`} style={s.performanceSet}>{set.weight ? `${formatWeight(set.weight, previousUnit, state.units)} ${state.units}` : 'Bodyweight'} × {set.reps} {exercise.repRange.toLowerCase().includes('min') ? 'min' : exercise.repRange.toLowerCase().includes('sec') ? 'sec' : 'reps'}</Text>)}<View style={s.performanceMeta}><Copy>Best weight  <Text style={s.performanceValue}>{bestWeight ? `${formatWeight(bestWeight, state.units, state.units)} ${state.units}` : 'Bodyweight'}</Text></Copy><Copy>Best {exercise.repRange.toLowerCase().includes('min') ? 'time' : exercise.repRange.toLowerCase().includes('sec') ? 'hold' : 'reps'}  <Text style={s.performanceValue}>{bestReps}{exercise.repRange.toLowerCase().includes('min') ? ' min' : exercise.repRange.toLowerCase().includes('sec') ? ' sec' : ''}</Text></Copy></View><Copy style={{ marginTop: 8 }}>Last trained {previous.date}</Copy></Card> : <Empty title="No previous performance" detail="Complete this exercise to start tracking your progress." />}
    <Action title={active ? 'Use in active workout  →' : 'Start Exercise  →'} onPress={start} />
  </Screen>;
}

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

  return <Screen>
    <PrimaryHeader title="Progress" />
    <Copy>Your training, at a glance.</Copy>
    <SectionTitle title="Monthly activity" />
    <View style={n.monthCalendar}>
      <View style={n.monthCalendarHeader}>
        <Text style={n.monthTitle}>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <View style={n.monthControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={showPreviousMonth} style={n.monthControl}>
            <Text style={n.monthControlText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: !canShowNextMonth }}
            disabled={!canShowNextMonth}
            onPress={showNextMonth}
            style={[n.monthControl, !canShowNextMonth && n.monthControlDisabled]}
          >
            <Text style={n.monthControlText}>›</Text>
          </Pressable>
        </View>
      </View>
      <View style={n.monthCalendarGrid}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) =>
          <Text key={`${label}-${index}`} style={n.monthWeekday}>{label}</Text>,
        )}
        {calendarCells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={n.monthDayCell} />;
          const completed = completedDateKeys.has(date.toDateString());
          const isToday = date.toDateString() === now.toDateString();
          return <View key={date.toISOString()} style={[n.monthDayCell, isToday && n.monthDayToday]}>
            <Text style={[n.monthDayNumber, isToday && n.monthDayNumberToday]}>{date.getDate()}</Text>
            {completed ? <View style={[n.monthActivityDot, isToday && n.monthActivityDotToday]} /> : null}
          </View>;
        })}
      </View>
      <Copy style={n.monthSummary}>
        {monthWorkoutCount} {monthWorkoutCount === 1 ? 'workout' : 'workouts'} completed this month
      </Copy>
    </View>
    {!state.history.length ? <Empty
      title="Your progress starts here"
      detail="Complete a workout and your stats, consistency, and strength history will appear here."
    /> : <>
      <View style={s.progressGrid}>
        <ProgressStat label="Current streak" value={`${calculateWorkoutStreak(state.history, now)} days`} />
        <ProgressStat label="This month" value={`${monthWorkoutCount} workouts`} />
        <ProgressStat label="Workouts" value={`${calculateTotalWorkouts(state.history)}`} />
        <ProgressStat label="Training volume" value={`${Math.round(calculateTotalVolume(state.history, state.units)).toLocaleString()} ${state.units}`} />
      </View>
      <SectionTitle title="Recent activity" action="History" onPress={() => router.push('/history')} />
      {recent.map(item => {
        const stats = calculateWorkoutStats(item, state.units);
        return <Card key={item.id} onPress={() => openHistoryItem(item.id)}>
          <Text style={s.cardTitle}>{item.name}</Text>
          <Copy>{formatDate(workoutTimestamp(item, now))} · {item.duration} min · {stats.exerciseCount} exercises</Copy>
          <Copy style={{ marginTop: 4 }}>{Math.round(stats.volume).toLocaleString()} {state.units} volume</Copy>
        </Card>;
      })}
      <SectionTitle title="Strength progress" />
      {exercisesWithHistory.length ? exercisesWithHistory.map(id => {
        const exercise = exerciseById(id);
        const progress = calculateExerciseProgress(state.history, id, now, state.units);
        if (!progress) return null;
        return <Card key={id} onPress={() => router.push({ pathname: '/progress/exercise/[id]', params: { id } })}>
          <View style={s.historyCardTop}>
            <Text style={[s.cardTitle, { flex: 1 }]}>{exercise.name}</Text>
            <Text style={s.linkArrow}>›</Text>
          </View>
          <Copy>Best · {progress.bestWeight > 0 ? `${progress.bestWeight.toFixed(1).replace(/\.0$/, '')} ${state.units}` : 'Bodyweight'} × {progress.bestReps} reps</Copy>
          <Copy style={{ marginTop: 4 }}>{progress.sessions} sessions · {Math.round(progress.totalVolume).toLocaleString()} {state.units} volume · Last {formatDate(progress.lastPerformed)}</Copy>
        </Card>;
      }) : <Empty title="No performance data yet" detail="Logged exercise performances will be tracked here." />}
      <SectionTitle title="Personal records" />
      {records.length ? records.map(record => <Card key={record.exerciseId}>
        <View style={s.historyCardTop}>
          <Text style={[s.cardTitle, { flex: 1 }]}>{exerciseById(record.exerciseId).name}</Text>
          <Pill green>BEST</Pill>
        </View>
        <Copy>{formatWeight(record.weight, state.units, state.units)} {state.units} × {record.reps} reps · {formatDate(record.date)}</Copy>
      </Card>) : <Empty title="No records yet" detail="Complete a weighted set to establish your first personal record." />}
    </>}
    <SectionTitle title="Body weight" />
    <Card onPress={() => router.push('/progress/body-weight')}>
      <View style={s.historyCardTop}>
        <Text style={[s.cardTitle, { flex: 1 }]}>{currentWeight ? `${formatWeight(currentWeight.weight, currentWeight.units, state.units)} ${state.units}` : 'No weight entries yet'}</Text>
        <Text style={s.chevron}>›</Text>
      </View>
      <Copy>{currentWeight ? change === null ? 'Current body weight · log another entry to see a change' : `${change > 0 ? '+' : ''}${formatWeight(change, currentWeight.units, state.units)} ${state.units} since previous entry` : 'Log a body weight to start your personal trend.'}</Copy>
    </Card>
    <SectionTitle title="Nutrition history" />
    {nutritionHistory.length ? nutritionHistory.map(date => {
      const totals = nutritionTotals(state.foodEntries, date);
      return <Card key={date}>
        <View style={s.historyCardTop}>
          <Text style={[s.cardTitle, { flex: 1 }]}>{nutritionDateLabel(date)}</Text>
          <Text style={s.nutritionHistoryCalories}>{totals.calories.toLocaleString()} kcal</Text>
        </View>
        <Copy>{totals.meals} {totals.meals === 1 ? 'food entry' : 'food entries'} · Protein {displayNumber(totals.protein)} g · Carbs {displayNumber(totals.carbs)} g · Fat {displayNumber(totals.fat)} g</Copy>
      </Card>;
    }) : <Copy style={s.nutritionHistoryEmpty}>Past daily totals will appear here after you log food on another day.</Copy>}
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
  mealGroup: { marginTop: 18, marginBottom: 5, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  mealHeading: { minHeight: 58, marginBottom: 12, paddingHorizontal: 2, borderBottomColor: C.line },
  mealTitle: { fontSize: 22 },
  foodCard: { paddingHorizontal: 16, paddingVertical: 16, marginBottom: 8, borderRadius: 12, backgroundColor: C.surface, borderColor: C.line },
  insightCard: { paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6, backgroundColor: C.wash, borderColor: C.wash, borderRadius: 12 },
  insightMarker: { width: 3, height: 24, borderRadius: 2, backgroundColor: C.accent },
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
  trainIntro: { marginTop: 4, marginBottom: 8 },
  weekSection: { marginTop: 11, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  weekSectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  weekSectionTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 23, lineHeight: 28 },
  weekRange: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, paddingBottom: 4 },
  weekSelector: { flexDirection: 'row', justifyContent: 'space-between', gap: 3 },
  weekDayChoice: { flex: 1, minWidth: 0, minHeight: 79, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.background },
  weekDayChoiceToday: { borderColor: '#C8A987' },
  weekDayChoiceSelected: { backgroundColor: C.accent, borderColor: C.accent },
  weekDayChoiceCompleted: { backgroundColor: C.greenWash, borderColor: '#D4E2D6' },
  weekDayChoiceRest: { backgroundColor: '#F7F5F0', borderColor: '#EBE8E0' },
  weekDayName: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 },
  weekDayIndicator: { width: 24, height: 21, alignItems: 'center', justifyContent: 'center' },
  weekDayIndicatorToday: { borderRadius: 10, backgroundColor: '#F4EDE3' },
  weekDayIndicatorSelected: { backgroundColor: 'rgba(255,255,255,0.17)' },
  weekDayIndicatorCompleted: { borderRadius: 10, backgroundColor: C.green },
  weekDayMarkText: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12 },
  weekDayMarkCompleted: { color: '#FFF' },
  weekDayNumber: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 },
  weekDayTextSelected: { color: '#FFF' },
  selectedDayPanel: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: C.wash },
  selectedDayText: { flex: 1, minWidth: 0 },
  selectedDayTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 23, lineHeight: 28, marginBottom: 4 },
  selectedDayMeta: { fontSize: 12, lineHeight: 18 },
  selectedDayAction: { minHeight: 43, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 11, backgroundColor: C.accent },
  selectedDayActionText: { color: '#FFF', fontFamily: 'InterSemiBold', fontSize: 12 },
  weekEmpty: { paddingVertical: 16 },
  destinationGroup: { flexDirection: 'column', borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 14, marginTop: 3 },
  destinationGroupWide: { flexDirection: 'row', gap: 8, padding: 10 },
  destinationTile: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  destinationTileWide: { flex: 1, minWidth: 0, minHeight: 84, paddingHorizontal: 10, borderBottomWidth: 0, borderRadius: 11, backgroundColor: C.background },
  destinationIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.wash },
  destinationText: { flex: 1, minWidth: 0 },
  destinationTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13 },
  destinationMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, lineHeight: 15, marginTop: 3 },
  destinationArrow: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 22, lineHeight: 24 },
  recentTrainList: { borderTopWidth: 1, borderTopColor: C.line },
  recentTrainRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line },
  recentTrainCopy: { flex: 1, minWidth: 0 },
  recentTrainTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 13 },
  recentTrainMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11, marginTop: 4 },
  monthCalendar: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 15, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  monthCalendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  monthTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 20 },
  monthControls: { flexDirection: 'row', gap: 6 },
  monthControl: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: C.wash },
  monthControlDisabled: { opacity: 0.35 },
  monthControlText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 22, lineHeight: 25 },
  monthCalendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, paddingVertical: 7 },
  monthDayCell: { width: `${100 / 7}%`, height: 43, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 9 },
  monthDayToday: { backgroundColor: C.wash, borderWidth: 1, borderColor: C.accent },
  monthDayNumber: { color: C.ink, fontFamily: 'InterRegular', fontSize: 12 },
  monthDayNumberToday: { fontFamily: 'InterBold', color: C.accent },
  monthActivityDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  monthActivityDotToday: { backgroundColor: C.ink },
  monthSummary: { textAlign: 'center', fontSize: 11, marginTop: 9 },
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
  const macro = (label: string, value: number, target: NutritionTargetValue | undefined) => {
    const midpoint = target ? targetMidpoint(target) : 0; const status = nutritionStatus(value, target); const tone = nutritionStatusStyle(status);
    return <View key={label} style={[s.nutritionMacroRow, n.macroRow, label === 'Fat' && s.nutritionMacroRowLast]}><View style={s.nutritionMacroTop}><Text style={[s.nutritionMacroName, n.macroName]}>{label}</Text><Text style={[s.nutritionMacroTotal, n.macroTotal]}>{displayNumber(value)} / {target ? formatTarget(target) : '—'} g</Text></View><View style={[s.nutritionMacroTrack, n.macroTrack]}><View style={[s.nutritionMacroFill, n.macroFill, { backgroundColor: tone.fill, width: `${target && midpoint > 0 ? Math.min(100, Math.round(value / midpoint * 100)) : 0}%` }]} /></View><Text style={[s.nutritionMacroStatus, n.macroStatus, { color: tone.text }]}>{target ? nutritionStatusLabel(status) : 'Target unavailable'}</Text></View>;
  };
  const missingFields = estimate.missingInformation;
  const missingMessage = missingFields.length === 1 ? `Add your ${missingFields[0]}` : `Add your ${missingFields.slice(0, -1).join(', ')} and ${missingFields[missingFields.length - 1]}`;
  const insights = !entries.length ? ['You haven’t logged any food today.'] : [targets ? totals.protein >= targets.protein ? 'Protein target completed.' : `Protein is ${displayNumber(Math.max(0, targets.protein - totals.protein))}g below the target.` : `${missingMessage} in Personal Information to calculate nutrition targets.`, `You've logged ${totals.meals} ${totals.meals === 1 ? 'food item' : 'food items'} today.`];
  const caloriesStatus = nutritionStatus(totals.calories, targets?.calories); const caloriesTone = nutritionStatusStyle(caloriesStatus);
  const addMeal = (meal: FoodMeal) => router.push({ pathname: '/nutrition/add', params: { meal } });
  return <Screen style={{ ...s.nutritionScreen, ...n.screen }}><PrimaryHeader title="Nutrition" /><Eyebrow>TODAY · ESTIMATED TARGETS</Eyebrow>
    <View style={[s.nutritionSummary, width < 620 && s.nutritionSummaryNarrow, n.summary]}>
      <Card style={width < 620
        ? { ...s.calorieCard, ...n.calorieCard, ...n.calorieCardMobile, borderColor: caloriesTone.borderColor, backgroundColor: caloriesTone.backgroundColor, flex: 0, width: '100%' }
        : { ...s.calorieCard, ...n.calorieCard, borderColor: caloriesTone.borderColor, backgroundColor: caloriesTone.backgroundColor }}><View style={s.calorieHeading}><View><Eyebrow>CALORIES</Eyebrow><Text style={[s.calorieValue, n.calorieValue]}>{totals.calories.toLocaleString()}<Text style={s.calorieTarget}> / {targets ? formatTarget(targets.calories) : '—'} kcal</Text></Text></View><Text style={[s.calorieGlyph, { color: caloriesTone.fill }]}>◒</Text></View><View style={[s.calorieTrack, n.calorieTrack]}><View style={[s.calorieFill, n.calorieFill, { backgroundColor: caloriesTone.fill, width: `${targets ? Math.min(100, Math.round(totals.calories / targetMidpoint(targets.calories) * 100)) : 0}%` }]} /></View><Copy style={{ marginTop: 8, color: caloriesTone.text }}>{targets ? nutritionStatusLabel(caloriesStatus) : 'Target unavailable'}</Copy></Card>
      <View style={[s.nutritionMacroPanel, width < 620 && s.nutritionSummaryChildNarrow, n.macroPanel, width < 620 && n.macroPanelMobile]}>{macro('Protein', totals.protein, targets?.protein)}{macro('Carbs', totals.carbs, targets?.carbohydrates)}{macro('Fat', totals.fat, targets?.fat)}</View>
    </View>
    {!targets ? <Card style={s.targetNote}><Text style={s.cardTitle}>Complete Personal Information for targets</Text><Copy>{missingMessage} in Personal Information to calculate your calorie and macro targets. No default targets are substituted.</Copy><Action title="Personal Information" secondary onPress={() => router.push('/profile/personal-information')} /></Card> : <Copy style={s.targetDisclaimer}>Estimated from your profile and training goal. Sex is not collected, so calorie targets show a range.</Copy>}
    <SectionTitle title="Today's meals" />
    {meals.map(meal => { const mealEntries = entries.filter(entry => entry.meal === meal); return <View key={meal} style={[s.nutritionMealGroup, n.mealGroup]}><View style={[s.nutritionMealHeading, n.mealHeading]}><Text style={[s.nutritionMealTitle, n.mealTitle]}>{meal}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Add ${meal}`} onPress={() => addMeal(meal)} hitSlop={8} style={s.nutritionMealAdd}><Text style={s.nutritionMealAddText}>+ Add</Text></Pressable></View>{mealEntries.map(entry => <Card key={entry.id} style={{ ...s.foodCard, ...n.foodCard }}><View style={s.foodRow}><View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{entry.name}</Text><Copy>{entry.quantity !== undefined ? `${displayNumber(entry.quantity)} ${entry.servingUnit ?? 'servings'} · ` : entry.servingUnit ? `${entry.servingUnit} · ` : ''}{entry.calories} kcal · P {displayNumber(entry.protein)}g · C {displayNumber(entry.carbs)}g · F {displayNumber(entry.fat)}g · estimated</Copy></View><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.name}`} onPress={() => router.push({ pathname: '/nutrition/add', params: { entryId: entry.id } })} hitSlop={8}><Text style={s.nutritionCoachLink}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.name}`} onPress={() => setEntryToDelete(entry)} hitSlop={10}><Text style={s.removeFood}>×</Text></Pressable></View></Card>)}</View>; })}
    <SectionTitle title="Nutrition insights" />{insights.map((insight, index) => <Card key={index} style={{ ...s.insightCard, ...n.insightCard }}><View style={n.insightMarker} /><Copy style={{ flex: 1 }}>{insight}</Copy></Card>)}
    <Modal visible={Boolean(entryToDelete)} transparent animationType="fade" onRequestClose={() => setEntryToDelete(null)}><View style={s.modalShade}><View style={s.confirmCard}><Eyebrow>PLEASE CONFIRM</Eyebrow><Heading size={22}>Delete food entry?</Heading><Copy>Remove {entryToDelete?.name} from your nutrition log?</Copy><Pressable accessibilityRole="button" onPress={() => { if (entryToDelete) removeFood(entryToDelete.id); setEntryToDelete(null); }} style={s.destructiveAction}><Text style={s.destructiveText}>Delete entry</Text></Pressable><Action title="Cancel" secondary onPress={() => setEntryToDelete(null)} /></View></View></Modal>
  </Screen>;
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
export function CoachScreen() {
  const { state, appendCoachMessage, clearCoachMessages } = useSteadiifit();
  const [input, setInput] = useState(''); const [typing, setTyping] = useState(false); const [prompt, setPrompt] = useState(''); const scrollRef = useRef<ScrollView>(null); const responseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (responseTimeout.current) clearTimeout(responseTimeout.current); }, []);
  const submit = (value = input) => { const text = value.trim(); if (!text || typing) return; appendCoachMessage({ role: 'user', text }); setInput(''); setTyping(true); setPrompt(text); responseTimeout.current = setTimeout(() => { appendCoachMessage({ role: 'assistant', text: localCoachResponse(text, state, deriveCoachContext(state)) }); setTyping(false); }, 420); };
  const messages = state.coachMessages;
  return <KeyboardAvoidingView style={s.coachRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
      <View style={s.coachContainer}><PrimaryHeader title="AI Coach" /><View style={s.coachIntroRow}><View style={{ flex: 1 }}><Eyebrow>YOUR PERSONAL FITNESS ASSISTANT</Eyebrow><Copy>Answers use your local workouts and tracking.</Copy></View><Pressable accessibilityRole="button" accessibilityLabel="Clear conversation" onPress={() => { if (responseTimeout.current) clearTimeout(responseTimeout.current); setTyping(false); clearCoachMessages(); }}><Text style={s.coachClear}>Clear</Text></Pressable></View>
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
  return <Screen><PrimaryHeader title="Profile" />
    <Card style={s.profileHero}><View style={s.profileHeroRow}><View style={s.avatarBig}><Text style={s.avatarLabel}>{(state.name.trim().slice(0, 2) || 'A').toUpperCase()}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Heading size={23} style={s.profileName} numberOfLines={1}>{state.name || 'Athlete'}</Heading><Copy>Personal account</Copy></View></View></Card>
    <Card onPress={() => router.push('/profile/personal-information')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Personal Information</Text><Copy>Name, date of birth, height, current weight, and units</Copy></View><Text style={s.chevron}>›</Text></Card>
    <Card onPress={() => router.push('/settings')} style={s.profileLinkCard}><View style={{ flex: 1 }}><Text style={s.cardTitle}>Settings</Text><Copy>Units, workout behavior, and local data</Copy></View><Text style={s.chevron}>›</Text></Card>
    <SectionTitle title="Account" /><Action title={signingOut ? 'Logging out…' : 'Log out'} secondary disabled={signingOut} onPress={() => void logOut()} />
    {signOutError ? <Copy>{signOutError}</Copy> : null}
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

type ConfirmAction = { title: string; message: string; confirm: string; onConfirm: () => void };
export function SettingsScreen() {
  const { state, updateWorkoutSettings, clearWorkoutHistory, clearNutritionData, resetPlan, resetAppData } = useSteadiifit();
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const confirm = (value: ConfirmAction) => setConfirmation(value);
  const finish = () => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); };
  const toggle = (enabled: boolean) => <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} accessibilityLabel="Automatically start rest timer" onPress={() => updateWorkoutSettings({ autoStartRest: !enabled })} style={[s.switch, enabled && s.switchOn]}><View style={[s.switchThumb, enabled && s.switchThumbOn]} /></Pressable>;
  return <Screen><PrimaryHeader title="Settings" /><Eyebrow>YOUR APP, YOUR PREFERENCES</Eyebrow><Copy>Manage the preferences that affect your training experience.</Copy>
    <SectionTitle title="Workout" />
    <Card><Text style={s.cardTitle}>Rest timer duration</Text><Copy>Used between sets. You can still adjust or skip each rest.</Copy><View style={s.unitChoiceRow}>{[60, 90, 120].map(seconds => <Pressable key={seconds} accessibilityRole="radio" accessibilityState={{ selected: state.workoutSettings.defaultRestSeconds === seconds }} onPress={() => updateWorkoutSettings({ defaultRestSeconds: seconds })} style={[s.restChoice, state.workoutSettings.defaultRestSeconds === seconds && s.unitChoiceActive]}><Text style={[s.unitChoiceText, state.workoutSettings.defaultRestSeconds === seconds && s.unitChoiceTextActive]}>{seconds}s</Text></Pressable>)}</View></Card>
    <Card style={s.settingsRow}><View style={{ flex: 1, paddingRight: 12 }}><Text style={s.cardTitle}>Automatically start rest timer</Text><Copy>Start countdown after each completed set.</Copy></View>{toggle(state.workoutSettings.autoStartRest)}</Card>
    <SectionTitle title="Local data" /><Copy style={s.dataNotice}>Some app state stays local. Nutrition entries sync to your signed-in account and load again on restart.</Copy>
    <Card><Text style={s.cardTitle}>Reset plan</Text><Copy>Regenerate this week from your current preferences. Workout history and progress are kept.</Copy><Action title="Regenerate plan" secondary onPress={() => confirm({ title: 'Regenerate your plan?', message: 'Your current weekly plan and exercise edits will be replaced using your saved preferences. Workout history will remain.', confirm: 'Regenerate plan', onConfirm: resetPlan })} /></Card>
    <Card><Text style={s.cardTitle}>Clear workout history</Text><Copy>Remove completed workouts and progress calculated from those sessions. Body-weight entries are kept.</Copy><Action title="Clear workout history" secondary onPress={() => confirm({ title: 'Clear workout history?', message: 'This removes all completed workouts from this in-memory app session. Workout statistics and PRs based on them will disappear. Body-weight entries will remain.', confirm: 'Clear history', onConfirm: clearWorkoutHistory })} /></Card>
    <Card><Text style={s.cardTitle}>Clear nutrition data</Text><Copy>Remove all food entries saved to your account.</Copy><Action title="Clear nutrition data" secondary onPress={() => confirm({ title: 'Clear nutrition data?', message: 'This permanently deletes all nutrition entries saved to your account and clears them from the current session.', confirm: 'Clear nutrition', onConfirm: clearNutritionData })} /></Card>
    <Card style={s.resetCard}><Text style={s.cardTitle}>Reset app data</Text><Copy>Return profile, plan, workouts, favorites, body weight, nutrition, chat, and workout settings to the fresh demo state.</Copy><Action title="Reset all app data" secondary onPress={() => confirm({ title: 'Reset all app data?', message: 'This clears all current in-memory app data, including your profile settings, active workout, workout history, body weight, nutrition, favorites, and Coach conversation. The app will return to onboarding. This cannot be undone in the current session.', confirm: 'Reset all data', onConfirm: () => { resetAppData(); router.replace('/onboarding'); } })} /></Card>
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
  homeHero: { backgroundColor: C.ink, borderColor: C.ink, marginTop: 1, marginBottom: 15, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderRadius: 20, overflow: 'hidden' }, homeHeroImage: { borderRadius: 20, opacity: 0.32 }, homeHeroDate: { color: '#D2CEC3', fontFamily: 'InterSemiBold', fontSize: 12, marginTop: 1 }, homeHeroTitle: { color: '#FFF', fontFamily: 'BricolageExtraBold', fontSize: 31, lineHeight: 36, marginTop: 13 }, homeHeroMeta: { color: '#D2CEC3', fontFamily: 'InterRegular', fontSize: 13, lineHeight: 19, marginTop: 7 }, homeHeroAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 12, marginTop: 18, paddingHorizontal: 16 }, homeHeroActionText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 14 },
  cardTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 5 }, statsRow: { flexDirection: 'row', gap: 8, marginTop: 9 }, stat: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 14 }, statValue: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 17 }, statLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 3 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }, day: { color: C.muted, fontSize: 11, fontWeight: '700', width: 34 }, planDayImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: C.wash }, chevron: { color: C.muted, fontSize: 22 }, recommend: { backgroundColor: '#FBF7F1', borderColor: '#D8C4AD', paddingVertical: 13 }, workoutDiscoveryCard: { padding: 10 }, workoutDiscoveryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 }, workoutVisualPanel: { width: 96, height: 104, borderRadius: 12, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', padding: 7 }, workoutVisualImage: { width: '100%', height: '100%' }, workoutVisualFallback: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10, lineHeight: 14, textAlign: 'center' }, workoutDiscoveryInfo: { flex: 1, minWidth: 0, justifyContent: 'center' }, workoutMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, workoutDescription: { fontSize: 12, lineHeight: 17, marginTop: 6 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, chips: { gap: 7, paddingBottom: 12 }, chip: { borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: C.ink, borderColor: C.ink }, chipText: { color: C.ink, fontSize: 12, fontWeight: '600' }, chipTextActive: { color: '#FFF' }, prescription: { marginTop: 9, color: C.accent, fontSize: 12, fontWeight: '700' },
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
  detailFavorite: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center' }, detailFavoriteIcon: { color: C.accent, fontSize: 20 }, demoHero: { height: 210, borderRadius: 20, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center', marginBottom: 19, overflow: 'hidden' }, exerciseIllustrationFrame: { width: '100%', maxWidth: 560, alignSelf: 'center', borderRadius: 20, backgroundColor: C.wash, overflow: 'hidden', marginBottom: 19 }, exerciseIllustrationLandscape: { aspectRatio: 1.7, maxHeight: 225 }, exerciseIllustrationPortrait: { width: '88%', aspectRatio: 1.25, maxHeight: 300 }, exerciseIllustrationImage: { width: '100%', height: '100%' }, demoBar: { height: 8, width: 160, backgroundColor: C.accent, borderRadius: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, demoGrip: { height: 22, width: 52, backgroundColor: C.ink, borderRadius: 5 }, demoPlate: { width: 22, height: 58, borderRadius: 7, backgroundColor: C.ink }, demoKicker: { color: C.muted, fontFamily: 'InterBold', fontSize: 9, letterSpacing: 1.1 }, demoLabel: { color: C.accent, fontFamily: 'InterBold', fontSize: 13, marginTop: 5 }, demoCopy: { fontSize: 11, marginTop: 3 }, detailInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailInfo: { width: '48%', marginBottom: 0, flexGrow: 1 }, detailFormTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 }, detailFormTipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  instructionRow: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line }, instructionNumber: { color: C.accent, fontFamily: 'BricolageBold', fontSize: 16, width: 26 }, instructionText: { flex: 1 }, tipCard: { flexDirection: 'row', gap: 9, paddingVertical: 12 }, tipMark: { color: C.green, fontFamily: 'InterBold', fontSize: 15 }, tipCopy: { flex: 1 }, mistakeRow: { flexDirection: 'row', gap: 9, paddingVertical: 7 }, mistakeMark: { color: C.accent, fontSize: 17 }, performanceSet: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, paddingVertical: 4 }, performanceMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, performanceValue: { color: C.ink, fontFamily: 'InterBold' },
  chartValue: { color: C.ink, fontSize: 23, fontWeight: '800', marginTop: 4 }, chartBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 12 }, bar: { width: 16, backgroundColor: C.accent, borderRadius: 5 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, progressStat: { width: '48%', flexGrow: 1, minHeight: 75, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 15, padding: 13, justifyContent: 'center' }, progressStatValue: { fontFamily: 'BricolageBold', fontSize: 18, color: C.ink }, progressStatLabel: { fontFamily: 'InterRegular', color: C.muted, fontSize: 11, marginTop: 4 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between' }, weekDay: { alignItems: 'center', gap: 7, flex: 1 }, weekDot: { width: 27, height: 27, borderRadius: 14, backgroundColor: C.background, borderColor: C.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, weekDotDone: { backgroundColor: C.green, borderColor: C.green }, weekCheck: { color: C.muted, fontSize: 12, fontFamily: 'InterBold' }, weekLabel: { color: C.muted, fontSize: 10, fontFamily: 'InterSemiBold' },
  historyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, linkArrow: { color: C.accent, fontSize: 24, lineHeight: 25 }, weightValue: { color: C.ink, fontFamily: 'InterBold', fontSize: 14 }, chartArea: { minHeight: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 4, borderBottomWidth: 1, borderBottomColor: C.line, marginTop: 18, paddingHorizontal: 3 }, chartColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' }, chartPoint: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 9, marginBottom: 4 }, chartBar: { width: '55%', maxWidth: 28, minWidth: 10, backgroundColor: C.accent, borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartDate: { color: C.muted, fontFamily: 'InterRegular', fontSize: 9, marginTop: 5, marginBottom: 4 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 13 }, profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }, profileValue: { color: C.ink, fontSize: 13, fontWeight: '700' }, unitRow: { flexDirection: 'row', gap: 8, marginTop: 12 }, unit: { minWidth: 54, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line, borderRadius: 16 }, unitSelected: { backgroundColor: C.ink, borderColor: C.ink }, unitText: { color: C.ink, textAlign: 'center', fontWeight: '700' },
  profileHero: { marginTop: 6, padding: 18 }, profileHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, profileName: { marginBottom: 3 }, profileLinkCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }, settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  unitChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, unitChoice: { flexGrow: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9 }, unitChoiceActive: { backgroundColor: C.ink, borderColor: C.ink }, unitChoiceText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'center' }, unitChoiceTextActive: { color: '#FFF' }, restChoice: { minWidth: 68, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9 }, switch: { width: 52, height: 32, borderRadius: 16, backgroundColor: C.line, padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: C.green }, switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: 'flex-start' }, switchThumbOn: { alignSelf: 'flex-end' }, dataNotice: { fontSize: 12, marginBottom: 10 }, resetCard: { borderColor: '#D8B7A8', backgroundColor: '#FBF5F1' }, confirmCard: { backgroundColor: C.background, padding: 22, paddingBottom: 18, borderRadius: 22, marginHorizontal: 20, width: '90%', maxWidth: 430, alignSelf: 'center' }, destructiveAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A04435', borderRadius: 14, marginTop: 16, marginBottom: 8, paddingHorizontal: 16 }, destructiveText: { color: '#FFF', fontFamily: 'InterBold', fontSize: 14 }, aboutBrand: { marginTop: 20, paddingVertical: 22 }, aboutFootnote: { fontSize: 11, marginTop: 13 },
  homeNutritionCard: { marginBottom: 0, borderColor: '#D8C4AD', backgroundColor: '#FBF7F1', padding: 14 }, homeCaloriesLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, homeCaloriesValueLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5 }, homeCalories: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 27, lineHeight: 32 }, homeCaloriesTarget: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12 }, homeNutritionCaption: { color: C.muted, fontFamily: 'InterBold', fontSize: 10, marginBottom: 1 }, homeNutritionPercent: { color: C.accent, fontFamily: 'InterBold', fontSize: 12 }, homeCalorieTrack: { height: 7, borderRadius: 5, backgroundColor: '#E5D9C9', overflow: 'hidden', marginTop: 9 }, homeCalorieFill: { height: 7, borderRadius: 5, backgroundColor: C.accent }, homeMacroList: { borderTopWidth: 1, borderTopColor: '#E5D9C9', marginTop: 10, paddingTop: 5 }, homeMacro: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, homeMacroLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 10 }, homeMacroValue: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11, textAlign: 'right' }, homeProgressRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.wash, borderRadius: 14, paddingHorizontal: 17, paddingVertical: 13 }, homeProgressMetric: { flex: 1 }, homeProgressValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 26 }, homeProgressLabel: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 11, marginTop: 1 }, homeMetricDivider: { width: 1, height: 38, backgroundColor: '#D8CFC1', marginHorizontal: 15 }, homeRecentCard: { paddingVertical: 14, marginBottom: 0 }, homeRecentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, homeRecentTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 14, marginBottom: 4 }, homeRecentMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 11 }, nutritionHistoryCalories: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, nutritionHistoryEmpty: { marginTop: 6, marginBottom: 10 },
  nutritionScreen: { width: '100%', maxWidth: 1000, alignSelf: 'center' }, nutritionSummary: { flexDirection: 'row', alignItems: 'stretch', gap: 10 }, nutritionSummaryNarrow: { flexDirection: 'column' }, nutritionSummaryChildNarrow: { flex: undefined, width: '100%' }, calorieCard: { flex: 1.15, minWidth: 0, marginTop: 0, marginBottom: 0, backgroundColor: C.surface, paddingVertical: 13 }, nutritionMacroPanel: { flex: 1, minWidth: 0, justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }, nutritionMacroRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line }, nutritionMacroRowLast: { borderBottomWidth: 0 }, nutritionMacroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, nutritionMacroName: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, nutritionMacroTotal: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, textAlign: 'right' }, nutritionMacroTrack: { height: 5, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 6 }, nutritionMacroFill: { height: 5, borderRadius: 4 }, nutritionMacroStatus: { fontFamily: 'InterSemiBold', fontSize: 9, marginTop: 4 }, nutritionMealGroup: { marginTop: 5, marginBottom: 3 }, nutritionMealHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 7 }, nutritionMealTitle: { color: C.ink, fontFamily: 'BricolageBold', fontSize: 19 }, nutritionMealAdd: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }, nutritionMealAddText: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12 }, foodCard: { paddingVertical: 10, marginBottom: 6, borderRadius: 12 }, macroCard: { flexGrow: 1, width: '48%', minWidth: '47%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 11 }, macroHead: { gap: 4 }, macroTotal: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12 }, macroTrack: { height: 6, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', marginTop: 8 }, macroFill: { height: 6, borderRadius: 4 }, macroRemaining: { fontFamily: 'InterSemiBold', fontSize: 10, marginTop: 7 }, calorieHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, calorieValue: { color: C.ink, fontFamily: 'BricolageExtraBold', fontSize: 25, marginTop: 2 }, calorieTarget: { color: C.muted, fontFamily: 'InterRegular', fontSize: 13 }, calorieGlyph: { fontSize: 30, color: C.accent }, calorieTrack: { height: 7, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden', marginTop: 9 }, calorieFill: { height: 7, borderRadius: 5, backgroundColor: C.accent }, targetNote: { marginTop: 10, backgroundColor: '#FBF7F1', borderColor: '#D8C4AD' }, targetDisclaimer: { fontSize: 10, marginTop: 5 }, nutritionCoachLink: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 13, padding: 6 }, foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, removeFood: { color: C.muted, fontSize: 24, paddingHorizontal: 5 }, insightCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13 }, insightMark: { color: C.accent, fontSize: 16 }, mealSuggestions: { marginTop: 3, marginBottom: 3 }, suggestionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }, suggestionChip: { maxWidth: '48%', borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 7 }, suggestionChipTitle: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, suggestionChipMeta: { color: C.muted, fontFamily: 'InterRegular', fontSize: 9, marginTop: 2 }, foodFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, foodField: { width: '48%', flexGrow: 1 }, foodLabel: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 12, marginBottom: 5 }, fieldUnit: { color: C.muted, fontFamily: 'InterRegular' }, formError: { color: '#A04435', marginTop: 8 },
  coachRoot: { flex: 1, backgroundColor: C.background }, coachContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 7 }, coachIntroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, coachClear: { color: C.accent, fontFamily: 'InterSemiBold', fontSize: 12, padding: 7 }, chatScroll: { flex: 1, minHeight: 150 }, chatMessages: { paddingVertical: 8, gap: 9, flexGrow: 1, justifyContent: 'flex-end' }, chatBubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 17 }, assistantBubble: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 5 }, userBubble: { alignSelf: 'flex-end', backgroundColor: C.ink, borderBottomRightRadius: 5 }, chatText: { color: C.ink, fontFamily: 'InterRegular', fontSize: 13, lineHeight: 19 }, userChatText: { color: '#FFF' }, typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 }, chatTyping: { color: C.muted, fontSize: 11 }, promptRow: { gap: 7, paddingVertical: 8 }, promptChip: { borderRadius: 18, backgroundColor: C.wash, paddingHorizontal: 11, paddingVertical: 8 }, promptText: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 11 }, chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 17, backgroundColor: C.surface, padding: 7 }, chatInput: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 9, paddingTop: 9, paddingBottom: 8, color: C.ink, fontFamily: 'InterRegular', fontSize: 13 }, sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, sendButtonText: { color: '#FFF', fontSize: 23, lineHeight: 25 }, localNote: { textAlign: 'center', fontSize: 9, marginTop: 5 },
});
