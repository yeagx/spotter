# Spotter v1 exercise library (55)

Map each to its free-exercise-db id. If an exact match doesn't exist, pick the closest and note it here.

## Chest (7)
Barbell Bench Press · Incline Barbell Press · Flat Dumbbell Press · Incline Dumbbell Press · Machine Chest Press · Cable Fly · Push-Up

## Back (9)
Lat Pulldown · Close-Grip Lat Pulldown · Seated Cable Row · Barbell Row · Dumbbell Row · Machine Row · Pull-Up · Straight-Arm Pulldown · Back Extension

## Shoulders (6)
Overhead Press · Dumbbell Shoulder Press · Dumbbell Lateral Raise · Cable Lateral Raise · Rear Delt Fly · Face Pull

## Biceps (5)
Barbell Curl · Dumbbell Curl · Hammer Curl · Incline Dumbbell Curl · Cable Curl

## Triceps (5)
Triceps Pushdown · Rope Pushdown · Overhead Dumbbell Extension · Skull Crusher · Dip

## Legs (11)
Leg Press · Barbell Squat · Goblet Squat · Hack Squat · Walking Lunge · Bulgarian Split Squat · Romanian Deadlift · Seated Leg Curl · Lying Leg Curl · Leg Extension · Hip Thrust

## Calves (2)
Standing Calf Raise · Seated Calf Raise

## Core (6)
Plank · Hanging Leg Raise · Cable Crunch · Russian Twist · Ab Wheel · Dead Bug

## Cardio (4)
Treadmill Walk · Treadmill Run · Stationary Bike · Rowing Machine

## Mapping notes

The full mapping (Spotter id → free-exercise-db id) lives in `src/db/library.ts` as `sourceId`.
46 of 55 matched exactly. These 9 use the closest record:

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

Re-import images with `node scripts/import-exercises.mjs <free-exercise-db clone>`.

## Form cues
Write 2–3 short cues per exercise in Spotter's voice (short, calm, no hype). Example, Dumbbell Lateral Raise:
- Soft bend in the elbows.
- Lead with the elbows, stop at shoulder height.
- Slow on the way down.
