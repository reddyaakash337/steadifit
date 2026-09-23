import { exerciseById, exercises, PlanDay } from '@/data/catalog';
import type { SteadiifitState } from '@/state/AppContext';
import { calculatePersonalRecords, calculateTotalVolume, calculateTotalWorkouts, calculateWorkoutStreak, calculateWeeklyWorkoutCount, sortWorkoutsNewest } from '@/features/progress';
import { estimateNutritionTargets, nutritionTotals } from '@/features/nutrition';
import { planDayName, plannedExercises } from '@/features/plan';

export type CoachContext = {
  userGoal: SteadiifitState['goal']; bodyWeight: SteadiifitState['bodyWeightEntries'][number] | null;
  workoutPlan: PlanDay[]; todayWorkout: PlanDay | null; recentWorkouts: SteadiifitState['history'];
  currentStreak: number; totalWorkouts: number; weeklyWorkouts: number; recentPRs: ReturnType<typeof calculatePersonalRecords>; favoriteExercises: string[];
  nutritionToday: ReturnType<typeof nutritionTotals>; macroTargets: ReturnType<typeof estimateNutritionTargets>;
};

export function deriveCoachContext(state: SteadiifitState, now = new Date()): CoachContext {
  const today = (now.getDay() + 6) % 7;
  return {
    userGoal: state.goal,
    bodyWeight: [...state.bodyWeightEntries].sort((a, b) => b.recordedAt - a.recordedAt)[0] ?? null,
    workoutPlan: state.plan,
    todayWorkout: state.plan[today] ?? null,
    recentWorkouts: sortWorkoutsNewest(state.history, now).slice(0, 5),
    currentStreak: calculateWorkoutStreak(state.history, now),
    totalWorkouts: calculateTotalWorkouts(state.history),
    weeklyWorkouts: calculateWeeklyWorkoutCount(state.history, now),
    recentPRs: calculatePersonalRecords(state.history, now, state.units).slice(0, 3),
    favoriteExercises: state.favoriteExerciseIds.map(id => exerciseById(id).name),
    nutritionToday: nutritionTotals(state.foodEntries),
    macroTargets: estimateNutritionTargets(state.bodyWeightEntries, state.goal, state.frequency),
  };
}

const dayName = (day: PlanDay) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day.day] ?? 'That day';
export function localCoachResponse(message: string, state: SteadiifitState, context = deriveCoachContext(state)): string {
  const prompt = message.toLowerCase();
  if (/protein|calorie|calories|macro|carb|fat/.test(prompt) && /left|remain|need|today|eaten|consum|intake/.test(prompt)) {
    const totals = context.nutritionToday; const targets = context.macroTargets;
    const asksProtein = /protein/.test(prompt); const asksCarb = /carb/.test(prompt); const asksFat = /fat/.test(prompt);
    if (!targets) return `You've logged ${totals.calories} kcal and ${Math.round(totals.protein)}g protein today. Add a body-weight entry in Progress to get a rough estimated target; I'll avoid guessing one.`;
    if (asksProtein) return `You've logged ${Math.round(totals.protein)}g protein today. Your rough estimated target is ${targets.protein}g, so about ${Math.max(0, targets.protein - totals.protein)}g remains.`;
    if (asksCarb) return `You've logged ${Math.round(totals.carbs)}g carbs today. Your rough estimated target is ${targets.carbs}g, with about ${Math.max(0, targets.carbs - totals.carbs)}g remaining.`;
    if (asksFat) return `You've logged ${Math.round(totals.fat)}g fat today. Your rough estimated target is ${targets.fat}g, with about ${Math.max(0, targets.fat - totals.fat)}g remaining.`;
    return `Today you've logged ${totals.calories} of an estimated ${targets.calories} kcal, with ${Math.max(0, targets.calories - totals.calories)} kcal to that estimate. Protein ${Math.round(totals.protein)}/${targets.protein}g, carbs ${Math.round(totals.carbs)}/${targets.carbs}g, and fat ${Math.round(totals.fat)}/${targets.fat}g.`;
  }
  if (/tomorrow/.test(prompt) && /workout|train|plan|doing/.test(prompt)) {
    const tomorrowIndex = (new Date().getDay() + 1) % 7;
    const tomorrow = state.plan[tomorrowIndex];
    return tomorrow ? `${dayName(tomorrow)}: ${planDayName(tomorrow)}${tomorrow.workoutId ? `, with ${plannedExercises(tomorrow).length} planned exercises.` : '. A rest day.'}` : `I don't have a plan entry for tomorrow yet. Open My Plan to review or customize your week.`;
  }
  if (/workout|train|today/.test(prompt) && /today|workout|train|should/.test(prompt)) {
    const day = context.todayWorkout;
    return day ? day.workoutId ? `Today's plan is ${planDayName(day)}: ${day.focus ?? 'your planned session'}, about ${day.duration ?? 0} minutes with ${plannedExercises(day).length} exercises. Open My Plan for the details.` : `Today is a planned rest day. Your goal is ${context.userGoal}; check My Plan for your next training day.` : `I don't have a workout plan yet. Open My Plan to set one up.`;
  }
  if (/progress|how .*doing|streak|pr\b|personal record|volume/.test(prompt)) {
    if (!context.totalWorkouts) return `I don't have enough workout history to summarize your progress yet. Complete a workout and I'll be able to use your logged sessions here.`;
    const latestPr = context.recentPRs[0];
    const streakText = context.currentStreak ? ` Your current streak is ${context.currentStreak} ${context.currentStreak === 1 ? 'day' : 'days'}.` : '';
    const prText = latestPr ? ` Your best logged lift is ${exerciseById(latestPr.exerciseId).name} at ${latestPr.weight} ${state.units} × ${latestPr.reps}.` : '';
    return `You've completed ${context.totalWorkouts} ${context.totalWorkouts === 1 ? 'workout' : 'workouts'} (${context.weeklyWorkouts} this week) and logged ${Math.round(calculateTotalVolume(state.history, state.units)).toLocaleString()} ${state.units} total volume.${streakText}${prText}`;
  }
  if (/plan|schedule|tomorrow/.test(prompt)) {
    if (!context.workoutPlan.length) return `You don't have a weekly plan yet. Open My Plan to create one.`;
    return `Your ${context.userGoal.toLowerCase()} plan has ${context.workoutPlan.filter(day => day.workoutId).length} training days: ${context.workoutPlan.filter(day => day.workoutId).map(day => `${dayName(day)} — ${planDayName(day)}`).join('; ')}. Open My Plan to see or change it.`;
  }
  const match = exercises.find(exercise => prompt.includes(exercise.name.toLowerCase()));
  if (match) return `${match.name}: ${match.instructions[0]} Form tip: ${match.formTips[0]} Avoid: ${match.commonMistakes[0]}`;
  if (/exercise|bench|squat|deadlift|row|curl|press/.test(prompt)) return `I couldn't match that to an exercise in your library. Try the exact exercise name, or open Exercise Library to browse the catalog.`;
  if (/hello|hey|hi\b/.test(prompt)) return `Hey ${state.name}! I can help you understand your plan, workouts, progress, nutrition, and exercises. What would you like to look at?`;
  if (/next|what should i do/.test(prompt)) {
    const today = context.todayWorkout;
    if (today?.workoutId) return `Your next step is today's planned ${planDayName(today)} session. You can open it from My Plan when you're ready.`;
    return `Your plan has today as a rest day. You can check My Plan for what's scheduled next.`;
  }
  return `I can currently help with your workouts, progress, nutrition, plan, and exercises. Try asking me about one of those.`;
}
