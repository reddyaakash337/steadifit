export type Exercise = {
  id: string; name: string; muscle: string; equipment: string; difficulty: string;
  sets: number; repRange: string; cue: string; mistake: string;
};
export type Workout = { id: string; name: string; focus: string; difficulty: string; duration: number; exerciseIds: string[]; description: string };

export const exercises: Exercise[] = [
  { id: 'bench', name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell', difficulty: 'Intermediate', sets: 4, repRange: '6–8', cue: 'Set your shoulder blades, plant your feet, and lower the bar with control.', mistake: 'Bouncing the bar off the chest.' },
  { id: 'incline-db', name: 'Incline DB Press', muscle: 'Chest', equipment: 'Dumbbells', difficulty: 'Intermediate', sets: 3, repRange: '8–12', cue: 'Keep wrists stacked and lower until you feel a comfortable chest stretch.', mistake: 'Flaring elbows too far out.' },
  { id: 'pushup', name: 'Push-up', muscle: 'Chest', equipment: 'Bodyweight', difficulty: 'Beginner', sets: 3, repRange: '8–15', cue: 'Keep a straight line from head to heel.', mistake: 'Letting hips sag.' },
  { id: 'pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', difficulty: 'Beginner', sets: 4, repRange: '8–12', cue: 'Pull toward your upper chest with a tall torso.', mistake: 'Swinging the torso.' },
  { id: 'row', name: 'Barbell Row', muscle: 'Back', equipment: 'Barbell', difficulty: 'Intermediate', sets: 4, repRange: '8–10', cue: 'Hinge at the hips and pull elbows toward your back pockets.', mistake: 'Jerking with the lower back.' },
  { id: 'curl', name: 'Biceps Curl', muscle: 'Biceps', equipment: 'Dumbbells', difficulty: 'Beginner', sets: 3, repRange: '10–15', cue: 'Keep elbows close and lower the weight slowly.', mistake: 'Using momentum.' },
  { id: 'squat', name: 'Back Squat', muscle: 'Legs', equipment: 'Barbell', difficulty: 'Intermediate', sets: 4, repRange: '6–8', cue: 'Brace before each rep and keep knees tracking over toes.', mistake: 'Heels lifting or knees collapsing inward.' },
  { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Legs', equipment: 'Barbell', difficulty: 'Intermediate', sets: 3, repRange: '8–10', cue: 'Push hips back and keep the bar close to your legs.', mistake: 'Rounding the back.' },
  { id: 'goblet', name: 'Goblet Squat', muscle: 'Legs', equipment: 'Dumbbells', difficulty: 'Beginner', sets: 3, repRange: '10–12', cue: 'Hold a dumbbell close to your chest and sit between your hips.', mistake: 'Letting knees collapse inward.' },
  { id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell', difficulty: 'Intermediate', sets: 4, repRange: '6–10', cue: 'Squeeze glutes and press in a straight path overhead.', mistake: 'Leaning back excessively.' },
  { id: 'raise', name: 'Lateral Raise', muscle: 'Shoulders', equipment: 'Dumbbells', difficulty: 'Beginner', sets: 3, repRange: '12–15', cue: 'Lead with elbows and stop around shoulder height.', mistake: 'Swinging the weights.' },
  { id: 'pushdown', name: 'Triceps Pushdown', muscle: 'Triceps', equipment: 'Cable', difficulty: 'Beginner', sets: 3, repRange: '10–15', cue: 'Keep elbows by your sides as you extend.', mistake: 'Moving the shoulders.' },
];

export const workouts: Workout[] = [
  { id: 'push', name: 'Chest + Triceps', focus: 'Chest, Triceps', difficulty: 'Intermediate', duration: 48, exerciseIds: ['bench', 'incline-db', 'pushup', 'pushdown'], description: 'Pressing work followed by focused triceps volume.' },
  { id: 'pull', name: 'Back + Biceps', focus: 'Back, Biceps', difficulty: 'Intermediate', duration: 48, exerciseIds: ['pulldown', 'row', 'curl'], description: 'Rows and pulldowns for a balanced back session.' },
  { id: 'legs', name: 'Legs', focus: 'Quads, Hamstrings', difficulty: 'Intermediate', duration: 52, exerciseIds: ['squat', 'rdl', 'goblet'], description: 'Squat-led session with hinge accessories.' },
  { id: 'shoulders', name: 'Shoulders + Arms', focus: 'Shoulders, Arms', difficulty: 'Beginner', duration: 42, exerciseIds: ['ohp', 'raise', 'curl', 'pushdown'], description: 'Presses, raises and arm finishers.' },
  { id: 'full', name: 'Full Body', focus: 'Full body', difficulty: 'Intermediate', duration: 55, exerciseIds: ['squat', 'bench', 'row', 'ohp'], description: 'One lift for each major movement pattern.' },
];

export const workoutById = (id?: string) => workouts.find(item => item.id === id) ?? workouts[0];
export const exerciseById = (id?: string) => exercises.find(item => item.id === id) ?? exercises[0];

export type PlanDay = { day: number; workoutId: string | null; status: 'upcoming' | 'done' | 'skipped' };
export function makePlan(frequency: number): PlanDay[] {
  const patterns: Record<number, (string | null)[]> = {
    2: ['full', null, null, 'full', null, null, null],
    3: ['push', null, 'pull', null, 'legs', null, null],
    4: ['push', null, 'pull', 'legs', null, 'full', null],
    5: ['push', 'pull', null, 'legs', 'shoulders', 'full', null],
    6: ['push', 'pull', 'legs', 'shoulders', 'full', 'pull', null],
  };
  return (patterns[frequency] ?? patterns[4]).map((workoutId, day) => ({ day, workoutId, status: 'upcoming' }));
}
