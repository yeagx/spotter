import type { Equipment, Muscle } from './types';

// The bundled exercise library, curated from design/exercise-list.md.
// `id` is Spotter's own and must never change once shipped: plans and logs point at it.
// `sourceId` is the free-exercise-db record the demo frames were copied from
// (github.com/yuhonas/free-exercise-db, public domain).
export type LibraryExercise = {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  sourceId: string;
  cues: string[];
};

// Bump when anything below changes, so existing installs pick up the new rows.
export const LIBRARY_VERSION = 1;

export const LIBRARY: LibraryExercise[] = [
  // Chest
  {
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscle: 'chest',
    equipment: 'barbell',
    sourceId: 'Barbell_Bench_Press_-_Medium_Grip',
    cues: [
      'Shoulder blades back and down.',
      'Lower to mid-chest, elbows tucked a little.',
      'Feet planted. Press up and slightly back.',
    ],
  },
  {
    id: 'incline-barbell-press',
    name: 'Incline Barbell Press',
    muscle: 'chest',
    equipment: 'barbell',
    sourceId: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    cues: [
      'Bench at about 30 degrees.',
      'Lower to the top of the chest.',
      'Wrists stacked over the elbows.',
    ],
  },
  {
    id: 'flat-dumbbell-press',
    name: 'Flat Dumbbell Press',
    muscle: 'chest',
    equipment: 'dumbbell',
    sourceId: 'Dumbbell_Bench_Press',
    cues: [
      'Shoulder blades back, chest up.',
      'Lower until the dumbbells sit beside the chest.',
      'Press up and slightly in.',
    ],
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    muscle: 'chest',
    equipment: 'dumbbell',
    sourceId: 'Incline_Dumbbell_Press',
    cues: [
      'Bench at about 30 degrees.',
      'Elbows slightly in from the shoulders.',
      'Slow on the way down.',
    ],
  },
  {
    id: 'machine-chest-press',
    name: 'Machine Chest Press',
    muscle: 'chest',
    equipment: 'machine',
    sourceId: 'Machine_Bench_Press',
    cues: [
      'Handles level with mid-chest.',
      'Shoulder blades stay on the pad.',
      'Stop just short of locking out.',
    ],
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    muscle: 'chest',
    equipment: 'cable',
    sourceId: 'Cable_Crossover',
    cues: [
      'Soft bend in the elbows. Keep it.',
      'Bring the hands together in a wide arc.',
      'Let the chest stretch on the way back.',
    ],
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    sourceId: 'Pushups',
    cues: [
      'Body in one straight line.',
      'Hands under the shoulders, elbows at 45 degrees.',
      'Chest to just above the floor.',
    ],
  },

  // Back
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscle: 'back',
    equipment: 'cable',
    sourceId: 'Wide-Grip_Lat_Pulldown',
    cues: [
      'Lean back slightly, chest up.',
      'Pull the bar to the top of the chest.',
      'Drive the elbows down, not back.',
    ],
  },
  {
    id: 'close-grip-lat-pulldown',
    name: 'Close-Grip Lat Pulldown',
    muscle: 'back',
    equipment: 'cable',
    sourceId: 'Close-Grip_Front_Lat_Pulldown',
    cues: [
      'Hands just inside shoulder width.',
      'Pull to the upper chest, elbows close in.',
      'Full stretch at the top.',
    ],
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    muscle: 'back',
    equipment: 'cable',
    sourceId: 'Seated_Cable_Rows',
    cues: [
      'Sit tall, slight bend in the knees.',
      'Pull to the stomach, squeeze the shoulder blades.',
      'Torso stays still.',
    ],
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    muscle: 'back',
    equipment: 'barbell',
    sourceId: 'Bent_Over_Barbell_Row',
    cues: [
      'Hinge until the torso is near 45 degrees.',
      'Pull the bar to the lower ribs.',
      'Back flat the whole set.',
    ],
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    muscle: 'back',
    equipment: 'dumbbell',
    sourceId: 'One-Arm_Dumbbell_Row',
    cues: [
      'Hand and knee on the bench, back flat.',
      'Pull the elbow toward the hip.',
      'Lower all the way down.',
    ],
  },
  {
    id: 'machine-row',
    name: 'Machine Row',
    muscle: 'back',
    equipment: 'machine',
    sourceId: 'Leverage_Iso_Row',
    cues: [
      'Chest against the pad.',
      'Lead with the elbows, squeeze at the back.',
      'Control the return.',
    ],
  },
  {
    id: 'pull-up',
    name: 'Pull-Up',
    muscle: 'back',
    equipment: 'bodyweight',
    sourceId: 'Pullups',
    cues: [
      'Start from a still hang.',
      'Pull the chest toward the bar.',
      'Lower all the way. No swinging.',
    ],
  },
  {
    id: 'straight-arm-pulldown',
    name: 'Straight-Arm Pulldown',
    muscle: 'back',
    equipment: 'cable',
    sourceId: 'Straight-Arm_Pulldown',
    cues: [
      'Arms long, soft bend in the elbows.',
      'Sweep the bar down to the thighs.',
      'Hips stay still.',
    ],
  },
  {
    id: 'back-extension',
    name: 'Back Extension',
    muscle: 'back',
    equipment: 'bodyweight',
    sourceId: 'Hyperextensions_Back_Extensions',
    cues: [
      'Hips just off the edge of the pad.',
      'Lower with a flat back.',
      'Rise to a straight line, no further.',
    ],
  },

  // Shoulders
  {
    id: 'overhead-press',
    name: 'Overhead Press',
    muscle: 'shoulders',
    equipment: 'barbell',
    sourceId: 'Standing_Military_Press',
    cues: [
      'Glutes tight, stomach braced.',
      'Bar travels close to the face.',
      'Head through at the top.',
    ],
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    muscle: 'shoulders',
    equipment: 'dumbbell',
    sourceId: 'Dumbbell_Shoulder_Press',
    cues: [
      'Start with the dumbbells at ear height.',
      'Press up without the weights touching.',
      'Back stays against the bench.',
    ],
  },
  {
    id: 'dumbbell-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    muscle: 'shoulders',
    equipment: 'dumbbell',
    sourceId: 'Side_Lateral_Raise',
    cues: [
      'Soft bend in the elbows.',
      'Lead with the elbows, stop at shoulder height.',
      'Slow on the way down.',
    ],
  },
  {
    id: 'cable-lateral-raise',
    name: 'Cable Lateral Raise',
    muscle: 'shoulders',
    equipment: 'cable',
    sourceId: 'Standing_Low-Pulley_Deltoid_Raise',
    cues: [
      'Cable runs across the front of the body.',
      'Lift out to the side, stop at shoulder height.',
      'Slow on the way down.',
    ],
  },
  {
    id: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    muscle: 'shoulders',
    equipment: 'dumbbell',
    sourceId: 'Seated_Bent-Over_Rear_Delt_Raise',
    cues: [
      'Hinge forward, back flat.',
      'Soft elbows. Lift out to the sides.',
      'Pause at the top.',
    ],
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    muscle: 'shoulders',
    equipment: 'cable',
    sourceId: 'Face_Pull',
    cues: [
      'Rope at face height.',
      'Pull toward the eyes, hands apart.',
      'Finish with the hands beside the ears.',
    ],
  },

  // Biceps
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    muscle: 'biceps',
    equipment: 'barbell',
    sourceId: 'Barbell_Curl',
    cues: [
      'Elbows pinned at your sides.',
      'Curl without leaning back.',
      'Lower all the way.',
    ],
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscle: 'biceps',
    equipment: 'dumbbell',
    sourceId: 'Dumbbell_Bicep_Curl',
    cues: [
      'Palms forward, elbows still.',
      'Squeeze at the top.',
      'Slow on the way down.',
    ],
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
    muscle: 'biceps',
    equipment: 'dumbbell',
    sourceId: 'Hammer_Curls',
    cues: [
      'Palms face each other the whole rep.',
      'Elbows stay at your sides.',
      'No swing.',
    ],
  },
  {
    id: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    muscle: 'biceps',
    equipment: 'dumbbell',
    sourceId: 'Incline_Dumbbell_Curl',
    cues: [
      'Bench at about 45 degrees, arms hanging straight.',
      'Shoulders stay back on the pad.',
      'Full stretch at the bottom.',
    ],
  },
  {
    id: 'cable-curl',
    name: 'Cable Curl',
    muscle: 'biceps',
    equipment: 'cable',
    sourceId: 'Standing_Biceps_Cable_Curl',
    cues: [
      'Stand tall, elbows at your sides.',
      'Curl up toward the chest.',
      'Keep tension at the bottom.',
    ],
  },

  // Triceps
  {
    id: 'triceps-pushdown',
    name: 'Triceps Pushdown',
    muscle: 'triceps',
    equipment: 'cable',
    sourceId: 'Triceps_Pushdown',
    cues: [
      'Elbows pinned at your sides.',
      'Push down until the arms are straight.',
      'Only the forearms move.',
    ],
  },
  {
    id: 'rope-pushdown',
    name: 'Rope Pushdown',
    muscle: 'triceps',
    equipment: 'cable',
    sourceId: 'Triceps_Pushdown_-_Rope_Attachment',
    cues: [
      'Elbows pinned at your sides.',
      'Spread the rope apart at the bottom.',
      'Control it back up.',
    ],
  },
  {
    id: 'overhead-dumbbell-extension',
    name: 'Overhead Dumbbell Extension',
    muscle: 'triceps',
    equipment: 'dumbbell',
    sourceId: 'Seated_Triceps_Press',
    cues: [
      'Both hands under the top of the dumbbell.',
      'Elbows point up, close to the head.',
      'Lower behind the head, then straighten.',
    ],
  },
  {
    id: 'skull-crusher',
    name: 'Skull Crusher',
    muscle: 'triceps',
    equipment: 'barbell',
    sourceId: 'EZ-Bar_Skullcrusher',
    cues: [
      'Upper arms still, tilted slightly back.',
      'Lower the bar toward the forehead.',
      'Straighten without flaring the elbows.',
    ],
  },
  {
    id: 'dip',
    name: 'Dip',
    muscle: 'triceps',
    equipment: 'bodyweight',
    sourceId: 'Dips_-_Triceps_Version',
    cues: [
      'Torso upright, elbows close.',
      'Lower until the elbows reach 90 degrees.',
      'Shoulders down, away from the ears.',
    ],
  },

  // Legs
  {
    id: 'leg-press',
    name: 'Leg Press',
    muscle: 'legs',
    equipment: 'machine',
    sourceId: 'Leg_Press',
    cues: [
      'Feet shoulder width, mid-platform.',
      'Lower until the knees reach about 90 degrees.',
      "Don't lock the knees at the top.",
    ],
  },
  {
    id: 'barbell-squat',
    name: 'Barbell Squat',
    muscle: 'legs',
    equipment: 'barbell',
    sourceId: 'Barbell_Squat',
    cues: [
      'Brace before you go down.',
      'Knees track over the toes.',
      'Drive up through the whole foot.',
    ],
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    muscle: 'legs',
    equipment: 'dumbbell',
    sourceId: 'Goblet_Squat',
    cues: [
      'Weight held close to the chest.',
      'Sit down between the heels.',
      'Chest up, elbows inside the knees.',
    ],
  },
  {
    id: 'hack-squat',
    name: 'Hack Squat',
    muscle: 'legs',
    equipment: 'machine',
    sourceId: 'Hack_Squat',
    cues: [
      'Back flat against the pad.',
      'Lower until the thighs are parallel.',
      'Push through the heels.',
    ],
  },
  {
    id: 'walking-lunge',
    name: 'Walking Lunge',
    muscle: 'legs',
    equipment: 'dumbbell',
    sourceId: 'Bodyweight_Walking_Lunge',
    cues: [
      'Long step, torso tall.',
      'Back knee just above the floor.',
      'Push through the front heel.',
    ],
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    muscle: 'legs',
    equipment: 'dumbbell',
    sourceId: 'Split_Squat_with_Dumbbells',
    cues: [
      'Rear foot on the bench, laces down.',
      'Drop straight down, front knee over the foot.',
      'Most of the weight on the front leg.',
    ],
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscle: 'legs',
    equipment: 'barbell',
    sourceId: 'Romanian_Deadlift',
    cues: [
      'Soft knees, push the hips back.',
      'Bar stays close to the legs.',
      'Stop at a hamstring stretch, back flat.',
    ],
  },
  {
    id: 'seated-leg-curl',
    name: 'Seated Leg Curl',
    muscle: 'legs',
    equipment: 'machine',
    sourceId: 'Seated_Leg_Curl',
    cues: [
      'Pad just above the heels.',
      'Curl all the way back.',
      'Slow on the return.',
    ],
  },
  {
    id: 'lying-leg-curl',
    name: 'Lying Leg Curl',
    muscle: 'legs',
    equipment: 'machine',
    sourceId: 'Lying_Leg_Curls',
    cues: [
      'Hips pressed into the pad.',
      'Curl the heels toward the glutes.',
      'Lower slowly.',
    ],
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    muscle: 'legs',
    equipment: 'machine',
    sourceId: 'Leg_Extensions',
    cues: [
      'Knees lined up with the pivot.',
      'Straighten fully, pause at the top.',
      'Lower under control.',
    ],
  },
  {
    id: 'hip-thrust',
    name: 'Hip Thrust',
    muscle: 'legs',
    equipment: 'barbell',
    sourceId: 'Barbell_Hip_Thrust',
    cues: [
      'Upper back on the bench edge.',
      'Chin tucked, ribs down.',
      'Squeeze the glutes at the top.',
    ],
  },

  // Calves
  {
    id: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    muscle: 'calves',
    equipment: 'machine',
    sourceId: 'Standing_Calf_Raises',
    cues: [
      'Full stretch at the bottom.',
      'Rise high onto the toes.',
      'Pause at the top. No bouncing.',
    ],
  },
  {
    id: 'seated-calf-raise',
    name: 'Seated Calf Raise',
    muscle: 'calves',
    equipment: 'machine',
    sourceId: 'Seated_Calf_Raise',
    cues: [
      'Pad snug on the thighs.',
      'Lower the heels all the way.',
      'Pause at the top.',
    ],
  },

  // Core
  {
    id: 'plank',
    name: 'Plank',
    muscle: 'core',
    equipment: 'bodyweight',
    sourceId: 'Plank',
    cues: [
      'Elbows under the shoulders.',
      'Body in one straight line.',
      "Keep breathing. Don't let the hips sag.",
    ],
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    muscle: 'core',
    equipment: 'bodyweight',
    sourceId: 'Hanging_Leg_Raise',
    cues: [
      'Start from a still hang.',
      'Lift with the abs, not momentum.',
      'Lower slowly.',
    ],
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    muscle: 'core',
    equipment: 'cable',
    sourceId: 'Cable_Crunch',
    cues: [
      'Kneel, rope held beside the head.',
      'Curl the ribs toward the hips.',
      'Hips stay still.',
    ],
  },
  {
    id: 'russian-twist',
    name: 'Russian Twist',
    muscle: 'core',
    equipment: 'bodyweight',
    sourceId: 'Russian_Twist',
    cues: [
      'Lean back, chest up.',
      'Turn from the ribs, not the arms.',
      'Slow and even, side to side.',
    ],
  },
  {
    id: 'ab-wheel',
    name: 'Ab Wheel',
    muscle: 'core',
    equipment: 'other',
    sourceId: 'Ab_Roller',
    cues: [
      'Start on the knees, hips tucked.',
      'Roll out only as far as the back stays flat.',
      'Pull back with the abs.',
    ],
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    muscle: 'core',
    equipment: 'bodyweight',
    sourceId: 'Dead_Bug',
    cues: [
      'Lower back pressed into the floor.',
      'Reach the opposite arm and leg out slowly.',
      'Breathe out as you reach.',
    ],
  },

  // Cardio
  {
    id: 'treadmill-walk',
    name: 'Treadmill Walk',
    muscle: 'cardio',
    equipment: 'machine',
    sourceId: 'Walking_Treadmill',
    cues: [
      'Stand tall, arms relaxed.',
      'A pace you could talk through.',
      'Hands off the rails.',
    ],
  },
  {
    id: 'treadmill-run',
    name: 'Treadmill Run',
    muscle: 'cardio',
    equipment: 'machine',
    sourceId: 'Running_Treadmill',
    cues: [
      'Short, light steps.',
      'Land under the hips.',
      'Shoulders relaxed.',
    ],
  },
  {
    id: 'stationary-bike',
    name: 'Stationary Bike',
    muscle: 'cardio',
    equipment: 'machine',
    sourceId: 'Bicycling_Stationary',
    cues: [
      'Seat at hip height.',
      'Slight bend in the knee at the bottom.',
      'Steady cadence.',
    ],
  },
  {
    id: 'rowing-machine',
    name: 'Rowing Machine',
    muscle: 'cardio',
    equipment: 'machine',
    sourceId: 'Rowing_Stationary',
    cues: [
      'Legs, then body, then arms.',
      'Reverse it on the way back.',
      'Back stays long.',
    ],
  },
];
