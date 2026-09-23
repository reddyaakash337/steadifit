export type ExerciseCategory = 'Strength' | 'Cardio' | 'Flexibility' | 'Core';
export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type Exercise = {
  id: string; name: string; muscle: string; primaryMuscles: string[]; secondaryMuscles: string[];
  equipment: string; difficulty: ExerciseDifficulty; category: ExerciseCategory;
  sets: number; repRange: string; restSeconds: number; cue: string; mistake: string;
  instructions: string[]; formTips: string[]; commonMistakes: string[]; demo: string;
};
export type Workout = { id: string; name: string; focus: string; difficulty: string; duration: number; exerciseIds: string[]; description: string };

const secondaryByMuscle: Record<string, string[]> = {
  Chest: ['Triceps', 'Front delts'], Back: ['Biceps', 'Rear delts'], Shoulders: ['Triceps'],
  Biceps: ['Forearms'], Triceps: ['Shoulders'], Legs: ['Glutes', 'Hamstrings'], Glutes: ['Hamstrings'], Core: ['Hip flexors'],
};
function exercise(id: string, name: string, muscle: string, equipment: string, difficulty: ExerciseDifficulty, sets: number, repRange: string, cue: string, mistake: string, category: ExerciseCategory = muscle === 'Core' ? 'Core' : 'Strength'): Exercise {
  const restSeconds = category === 'Core' ? 60 : category === 'Flexibility' ? 45 : category === 'Cardio' ? 30 : 90;
  const timed = /sec|min/i.test(repRange);
  const setup = category === 'Flexibility' ? `Find a stable stance and set up for the ${name.toLowerCase()} without forcing your range.` : category === 'Cardio' ? `Set a sustainable pace for the ${name.toLowerCase()} and stand tall.` : equipment === 'Bodyweight' ? `Set up for the ${name.toLowerCase()} on a clear, stable surface.` : `Set up for the ${name.toLowerCase()} with ${equipment.toLowerCase()} and choose a manageable load.`;
  const startCue = category === 'Flexibility' ? `Ease into a light stretch around your ${muscle.toLowerCase()} and keep breathing.` : category === 'Cardio' ? 'Keep a steady pace that lets you breathe comfortably.' : `Brace gently and keep your ${muscle.toLowerCase()} engaged as you begin each ${timed ? 'hold' : 'repetition'}.`;
  const rangeCue = category === 'Flexibility' ? 'Keep the stretch comfortable and still; never bounce or force the range.' : category === 'Cardio' ? 'Keep a steady rhythm and shorten your stride if your posture starts to change.' : timed ? 'Hold a stable position and breathe steadily for the full interval.' : 'Move through a comfortable range of motion without rushing the hardest part.';
  const finishCue = category === 'Flexibility' ? 'Hold gently, then ease out of the stretch without bouncing.' : category === 'Cardio' ? 'Slow your pace gradually and step off only when the belt has stopped.' : `Return to the starting position slowly and reset before the next ${timed ? 'hold' : 'repetition'}.`;
  return {
    id, name, muscle, primaryMuscles: [muscle], secondaryMuscles: secondaryByMuscle[muscle] ?? [], equipment, difficulty, category,
    sets, repRange, restSeconds, cue, mistake,
    instructions: [setup, startCue, rangeCue, finishCue],
    formTips: [cue, 'Keep the movement smooth and controlled from start to finish.', 'Stop if you feel sharp pain or cannot maintain your position.'],
    commonMistakes: [mistake, 'Using momentum instead of controlling the movement.', 'Shortening the range of motion to lift more weight.'],
    demo: `${muscle.toUpperCase()} · ${equipment.toUpperCase()}`,
  };
}

export const exercises: Exercise[] = [
  exercise('bench', 'Bench Press', 'Chest', 'Barbell', 'Intermediate', 4, '6–8', 'Set your shoulder blades, plant your feet, and lower the bar with control.', 'Bouncing the bar off the chest.'),
  exercise('incline-barbell', 'Incline Bench Press', 'Chest', 'Barbell', 'Intermediate', 3, '6–10', 'Set the bench to a modest incline and lower the bar toward the upper chest.', 'Setting the bench too steep or flaring the elbows.'),
  exercise('db-bench', 'Dumbbell Bench Press', 'Chest', 'Dumbbell', 'Beginner', 3, '8–12', 'Keep wrists stacked and lower both dumbbells evenly.', 'Letting the dumbbells drift too far apart.'),
  exercise('incline-db', 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Intermediate', 3, '8–12', 'Keep wrists stacked and lower until you feel a comfortable chest stretch.', 'Flaring elbows too far out.'),
  exercise('chest-fly', 'Chest Fly', 'Chest', 'Dumbbell', 'Beginner', 3, '10–15', 'Maintain a soft bend in the elbows as your arms open.', 'Turning the fly into a press by bending the elbows.'),
  exercise('crossover', 'Cable Crossover', 'Chest', 'Cable', 'Intermediate', 3, '10–15', 'Bring the handles together in front of your chest with a slight forward lean.', 'Letting the shoulders roll forward.'),
  exercise('pushup', 'Push-Up', 'Chest', 'Bodyweight', 'Beginner', 3, '8–15', 'Keep a straight line from head to heel and lower your chest between your hands.', 'Letting hips sag.'),
  exercise('machine-press', 'Machine Chest Press', 'Chest', 'Machine', 'Beginner', 3, '8–12', 'Set the handles around mid-chest and press without locking your elbows.', 'Letting the shoulders roll forward.'),
  exercise('pulldown', 'Lat Pulldown', 'Back', 'Cable', 'Beginner', 4, '8–12', 'Pull toward your upper chest with a tall torso.', 'Swinging the torso.'),
  exercise('pullup', 'Pull-Up', 'Back', 'Bodyweight', 'Advanced', 3, '5–10', 'Start from a controlled hang and pull your chest toward the bar.', 'Kipping or shortening the range.'),
  exercise('assisted-pullup', 'Assisted Pull-Up', 'Back', 'Machine', 'Beginner', 3, '8–12', 'Use enough assistance to move smoothly through a full range.', 'Bouncing on the assistance pad.'),
  exercise('row', 'Barbell Row', 'Back', 'Barbell', 'Intermediate', 4, '8–10', 'Hinge at the hips and pull elbows toward your back pockets.', 'Jerking with the lower back.'),
  exercise('db-row', 'Dumbbell Row', 'Back', 'Dumbbell', 'Beginner', 3, '8–12', 'Brace one hand on a bench and draw the weight toward your hip.', 'Twisting the torso to lift.'),
  exercise('cable-row', 'Seated Cable Row', 'Back', 'Cable', 'Beginner', 3, '8–12', 'Sit tall and draw your elbows back without leaning behind your hips.', 'Rounding the back or using momentum.'),
  exercise('machine-row', 'Machine Row', 'Back', 'Machine', 'Beginner', 3, '8–12', 'Keep your chest supported and squeeze your shoulder blades at the finish.', 'Shrugging the shoulders toward the ears.'),
  exercise('straight-arm-pulldown', 'Straight-Arm Pulldown', 'Back', 'Cable', 'Intermediate', 3, '10–15', 'Keep elbows soft and sweep the bar down toward your thighs.', 'Bending the elbows to turn it into a pressdown.'),
  exercise('ohp', 'Shoulder Press', 'Shoulders', 'Barbell', 'Intermediate', 4, '6–10', 'Squeeze glutes and press in a straight path overhead.', 'Leaning back excessively.'),
  exercise('db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'Beginner', 3, '8–12', 'Press overhead with forearms vertical and ribs stacked over hips.', 'Arching the lower back.'),
  exercise('raise', 'Lateral Raise', 'Shoulders', 'Dumbbell', 'Beginner', 3, '12–15', 'Lead with elbows and stop around shoulder height.', 'Swinging the weights.'),
  exercise('front-raise', 'Front Raise', 'Shoulders', 'Dumbbell', 'Beginner', 3, '10–15', 'Raise the weights to shoulder height without leaning back.', 'Using momentum to lift the arms.'),
  exercise('rear-delt-fly', 'Rear Delt Fly', 'Shoulders', 'Dumbbell', 'Beginner', 3, '12–15', 'Hinge forward and open your arms with a soft elbow bend.', 'Turning the movement into a shrug.'),
  exercise('face-pull', 'Face Pull', 'Shoulders', 'Cable', 'Beginner', 3, '12–15', 'Pull the rope toward your face and finish with elbows high.', 'Shrugging the shoulders.'),
  exercise('band-pull-apart', 'Band Pull-Apart', 'Shoulders', 'Resistance Band', 'Beginner', 3, '12–20', 'Hold the band at chest height and pull it apart while keeping ribs stacked.', 'Arching the back or shrugging.'),
  exercise('barbell-curl', 'Barbell Curl', 'Biceps', 'Barbell', 'Beginner', 3, '8–12', 'Keep elbows close and curl without moving your upper arms.', 'Rocking the torso to start the lift.'),
  exercise('curl', 'Dumbbell Curl', 'Biceps', 'Dumbbell', 'Beginner', 3, '10–15', 'Keep elbows close and lower the weight slowly.', 'Using momentum.'),
  exercise('hammer-curl', 'Hammer Curl', 'Biceps', 'Dumbbell', 'Beginner', 3, '10–15', 'Keep palms facing inward and elbows close to your sides.', 'Rocking the torso to lift.'),
  exercise('incline-curl', 'Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'Intermediate', 3, '10–12', 'Let your arms hang naturally and curl without letting elbows drift forward.', 'Overstretching the shoulder at the bottom.'),
  exercise('cable-curl', 'Cable Curl', 'Biceps', 'Cable', 'Beginner', 3, '10–15', 'Keep steady tension as you curl the handle toward your shoulders.', 'Letting the stack pull your arms down.'),
  exercise('pushdown', 'Tricep Pushdown', 'Triceps', 'Cable', 'Beginner', 3, '10–15', 'Keep elbows by your sides as you extend.', 'Moving the shoulders.'),
  exercise('overhead-extension', 'Overhead Tricep Extension', 'Triceps', 'Dumbbell', 'Beginner', 3, '10–15', 'Keep upper arms steady as you lower the weight behind your head.', 'Flaring the elbows wide.'),
  exercise('skull-crusher', 'Skull Crusher', 'Triceps', 'Barbell', 'Intermediate', 3, '8–12', 'Lower the bar toward your forehead with upper arms angled slightly back.', 'Flaring elbows or moving the upper arms.'),
  exercise('close-grip-bench', 'Close-Grip Bench Press', 'Triceps', 'Barbell', 'Intermediate', 3, '6–10', 'Use a comfortable close grip and keep wrists stacked over elbows.', 'Bringing the hands too close together.'),
  exercise('dips', 'Dips', 'Triceps', 'Bodyweight', 'Intermediate', 3, '6–12', 'Lower only as far as your shoulders remain comfortable.', 'Dropping too deep or shrugging at the bottom.'),
  exercise('squat', 'Squat', 'Legs', 'Barbell', 'Intermediate', 4, '6–8', 'Brace before each rep and keep knees tracking over toes.', 'Heels lifting or knees collapsing inward.'),
  exercise('front-squat', 'Front Squat', 'Legs', 'Barbell', 'Advanced', 3, '5–8', 'Keep elbows high and torso upright as you sit between your hips.', 'Letting elbows drop and chest collapse.'),
  exercise('leg-press', 'Leg Press', 'Legs', 'Machine', 'Beginner', 3, '10–12', 'Lower until your knees are comfortably bent, keeping hips on the pad.', 'Locking the knees at the top.'),
  exercise('rdl', 'Romanian Deadlift', 'Legs', 'Barbell', 'Intermediate', 3, '8–10', 'Push hips back and keep the bar close to your legs.', 'Rounding the back.'),
  exercise('leg-curl', 'Leg Curl', 'Legs', 'Machine', 'Beginner', 3, '10–15', 'Keep hips settled and curl the pad toward the back of your thighs.', 'Lifting hips off the pad.'),
  exercise('leg-extension', 'Leg Extension', 'Legs', 'Machine', 'Beginner', 3, '10–15', 'Align knees with the machine pivot and extend smoothly.', 'Kicking the weight up quickly.'),
  exercise('bulgarian-split-squat', 'Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Advanced', 3, '8–10', 'Set a stable stance and lower your back knee toward the floor.', 'Using a stance that is too narrow.'),
  exercise('lunges', 'Lunges', 'Legs', 'Dumbbell', 'Beginner', 3, '8–12', 'Step far enough to keep your front heel planted as you lower.', 'Letting the front knee collapse inward.'),
  exercise('calf-raise', 'Calf Raise', 'Legs', 'Machine', 'Beginner', 3, '12–20', 'Pause at the top and lower your heels into a comfortable stretch.', 'Bouncing through partial repetitions.'),
  exercise('goblet', 'Goblet Squat', 'Legs', 'Dumbbell', 'Beginner', 3, '10–12', 'Hold a dumbbell close to your chest and sit between your hips.', 'Letting knees collapse inward.'),
  exercise('plank', 'Plank', 'Core', 'Bodyweight', 'Beginner', 3, '20–45 sec', 'Keep shoulders over elbows and make a straight line from head to heels.', 'Letting hips sag or rise too high.', 'Core'),
  exercise('hanging-leg-raise', 'Hanging Leg Raise', 'Core', 'Bodyweight', 'Advanced', 3, '8–12', 'Start from a still hang and lift your knees without swinging.', 'Using momentum to swing the legs.', 'Core'),
  exercise('cable-crunch', 'Cable Crunch', 'Core', 'Cable', 'Intermediate', 3, '10–15', 'Kneel tall and curl your ribs toward your pelvis.', 'Pulling the rope with your arms.', 'Core'),
  exercise('ab-wheel', 'Ab Wheel', 'Core', 'Bodyweight', 'Advanced', 3, '6–10', 'Brace and roll only as far as you can keep your lower back controlled.', 'Letting the lower back arch.', 'Core'),
  exercise('bicycle-crunch', 'Bicycle Crunch', 'Core', 'Bodyweight', 'Beginner', 3, '12–20', 'Rotate through your trunk and move slowly from side to side.', 'Pulling on your neck.', 'Core'),
  exercise('incline-walk', 'Incline Treadmill Walk', 'Legs', 'Machine', 'Beginner', 1, '10–20 min', 'Choose a sustainable incline and walk tall at a steady pace.', 'Holding your body weight on the rails.', 'Cardio'),
  exercise('hamstring-stretch', 'Standing Hamstring Stretch', 'Legs', 'Bodyweight', 'Beginner', 2, '20–30 sec', 'Hinge gently at the hips until you feel a light stretch behind your thigh.', 'Bouncing or forcing the stretch.', 'Flexibility'),
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
