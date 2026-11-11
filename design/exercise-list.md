# Spotter exercise library (134)

Map each to its free-exercise-db id. If an exact match doesn't exist, pick the closest and note it here.

The first 55 shipped in v1. 79 more were added in v1.4 to cover the basics people asked for
(overhead cable extension, deadlift, pec deck, shrugs, chin-up and so on).

## Chest (18)
Barbell Bench Press · Incline Barbell Press · Flat Dumbbell Press · Incline Dumbbell Press · Machine Chest Press · Cable Fly · Push-Up

Added: Decline Barbell Press · Decline Dumbbell Press · Smith Machine Bench Press · Smith Machine Incline Press · Incline Machine Press · Dumbbell Fly · Incline Dumbbell Fly · Pec Deck · Low-to-High Cable Fly · Chest Dip · Dumbbell Pullover

## Back (22)
Lat Pulldown · Close-Grip Lat Pulldown · Seated Cable Row · Barbell Row · Dumbbell Row · Machine Row · Pull-Up · Straight-Arm Pulldown · Back Extension

Added: Deadlift · Rack Pull · Chin-Up · Inverted Row · T-Bar Row · Chest-Supported Row · Machine High Row · Single-Arm Cable Row · Neutral-Grip Lat Pulldown · Reverse-Grip Lat Pulldown · Single-Arm Lat Pulldown · Barbell Shrug · Dumbbell Shrug

## Shoulders (14)
Overhead Press · Dumbbell Shoulder Press · Dumbbell Lateral Raise · Cable Lateral Raise · Rear Delt Fly · Face Pull

Added: Arnold Press · Machine Shoulder Press · Smith Machine Shoulder Press · Dumbbell Front Raise · Cable Front Raise · Reverse Pec Deck · Cable Rear Delt Fly · Upright Row

## Biceps (13)
Barbell Curl · Dumbbell Curl · Hammer Curl · Incline Dumbbell Curl · Cable Curl

Added: EZ-Bar Curl · Preacher Curl · Machine Preacher Curl · Machine Curl · Spider Curl · Concentration Curl · Rope Hammer Curl · Reverse Curl

## Triceps (14)
Triceps Pushdown · Rope Pushdown · Overhead Dumbbell Extension · Skull Crusher · Dip

Added: Overhead Cable Extension · Single-Arm Pushdown · Close-Grip Bench Press · Dumbbell Skull Crusher · Single-Arm Overhead Extension · Dumbbell Kickback · Machine Triceps Extension · Machine Dip · Bench Dip

## Legs (25)
Leg Press · Barbell Squat · Goblet Squat · Hack Squat · Walking Lunge · Bulgarian Split Squat · Romanian Deadlift · Seated Leg Curl · Lying Leg Curl · Leg Extension · Hip Thrust

Added: Front Squat · Smith Machine Squat · Bodyweight Squat · Dumbbell Lunge · Reverse Lunge · Step-Up · Sumo Deadlift · Dumbbell Romanian Deadlift · Good Morning · Glute Bridge · Cable Pull-Through · Cable Kickback · Hip Abduction · Hip Adduction

## Calves (4)
Standing Calf Raise · Seated Calf Raise

Added: Leg Press Calf Raise · Dumbbell Calf Raise

## Core (17)
Plank · Hanging Leg Raise · Cable Crunch · Russian Twist · Ab Wheel · Dead Bug

Added: Crunch · Decline Crunch · Machine Crunch · Reverse Crunch · Bicycle Crunch · Sit-Up · Lying Leg Raise · Captain's Chair Knee Raise · Side Plank · Cable Woodchop · Mountain Climber

## Cardio (7)
Treadmill Walk · Treadmill Run · Stationary Bike · Rowing Machine

Added: Elliptical · Stair Climber · Jump Rope

## Mapping notes

The full mapping (Spotter id → free-exercise-db id) lives in `src/db/library.ts` as `sourceId`.
Most match exactly. These use the closest record:

| Spotter | free-exercise-db | Difference |
|---|---|---|
| Cable Fly | Cable_Crossover | High-pulley version |
| Lat Pulldown | Wide-Grip_Lat_Pulldown | Wide grip specifically |
| Machine Row | Leverage_Iso_Row | Plate-loaded machine, chest pad |
| Cable Lateral Raise | Standing_Low-Pulley_Deltoid_Raise | Same move, one arm at a time |
| Rear Delt Fly | Seated_Bent-Over_Rear_Delt_Raise | Seated bent-over, dumbbells |
| Overhead Dumbbell Extension | Seated_Triceps_Press | Seated, two hands on one dumbbell |
| Bulgarian Split Squat | Split_Squat_with_Dumbbells | Same move (rear foot elevated), different name |
| Goblet Squat | Goblet_Squat | Demo holds a kettlebell, not a dumbbell |
| Walking Lunge | Bodyweight_Walking_Lunge | Demo is bodyweight; logging with kg still works |
| T-Bar Row | Bent_Over_Two-Arm_Long_Bar_Row | Landmine version, no chest pad |
| Chest-Supported Row | Lying_T-Bar_Row | Chest-supported T-bar machine |
| Pec Deck | Butterfly | Same machine, older name |
| Neutral-Grip Lat Pulldown | V-Bar_Pulldown | Close neutral handle |
| Single-Arm Pushdown | Cable_One_Arm_Tricep_Extension | Demo uses an underhand grip |
| Dumbbell Romanian Deadlift | Stiff-Legged_Dumbbell_Deadlift | Straighter knees in the demo |
| Glute Bridge | Barbell_Glute_Bridge | Demo is loaded with a barbell |
| Bicycle Crunch | Air_Bike | Same move, different name |
| Side Plank | Side_Bridge | Same move, different name |
| Captain's Chair Knee Raise | Knee_Hip_Raise_On_Parallel_Bars | Same move, different name |
| Stair Climber | Stairmaster | Brand name in the source |

Skipped because the photos were poor: T-Bar_Row_with_Handle (holds a plate), Pallof_Press (second frame is a close-up).

Re-import images with `node scripts/import-exercises.mjs <free-exercise-db folder>`. The folder only needs
`dist/exercises.json` and `exercises/<sourceId>/0.jpg` and `1.jpg` for the ids in the library.

## Form cues
Write 2–3 short cues per exercise in Spotter's voice (short, calm, no hype). Example, Dumbbell Lateral Raise:
- Soft bend in the elbows.
- Lead with the elbows, stop at shoulder height.
- Slow on the way down.
