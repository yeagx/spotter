import type { Goal } from '@/db/profile';

// A starting-point daily calorie estimate. Spotter isn't a calorie tracker: this is one
// number to aim for, worked out from what the user has told us, never a rule.

type BodyInput = { weight: number; fat?: number | null; bmr?: number | null };

// Best available resting burn: the scan's BMR, else Katch-McArdle from lean mass,
// else a rough 22 kcal per kg of body weight.
export function restingBurn({ weight, fat, bmr }: BodyInput): number {
  if (bmr) return bmr;
  if (fat) return 370 + 21.6 * weight * (1 - fat / 100);
  return 22 * weight;
}

// Standard activity multipliers by training days a week.
function activity(trainingDays: number) {
  if (trainingDays <= 0) return 1.2;
  if (trainingDays <= 3) return 1.375;
  if (trainingDays <= 5) return 1.55;
  return 1.725;
}

// Getting lean is a moderate 15% deficit; staying healthy is maintenance.
export function estimateCalories(body: BodyInput, goal: Goal, trainingDays: number): number {
  const kcal = restingBurn(body) * activity(trainingDays) * (goal === 'lean' ? 0.85 : 1);
  return Math.round(kcal / 10) * 10;
}

// Before a split exists (onboarding), assume a typical three-day week.
export const DEFAULT_TRAINING_DAYS = 3;
