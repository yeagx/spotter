import type { Units } from '@/db/profile';

// Weights are stored in kg; the profile's units only change what's shown and typed.
const LB_PER_KG = 2.2046226218;

export const kgToUnit = (kg: number, units: Units) => (units === 'lb' ? kg * LB_PER_KG : kg);
export const unitToKg = (value: number, units: Units) => (units === 'lb' ? value / LB_PER_KG : value);

// "72.9", "20", "22.5": at most one decimal, no trailing ".0".
export function formatNumber(n: number, decimals = 1) {
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f);
}

export const formatWeight = (kg: number, units: Units) => formatNumber(kgToUnit(kg, units));

// Distance (cardio) is stored in metres and follows the weight units: km with kg,
// miles with lb.
const M_PER_MI = 1609.344;
export type DistanceUnit = 'km' | 'mi';
export const distanceUnit = (units: Units): DistanceUnit => (units === 'lb' ? 'mi' : 'km');
export const mToUnit = (m: number, units: Units) => m / (units === 'lb' ? M_PER_MI : 1000);
export const unitToM = (value: number, units: Units) => value * (units === 'lb' ? M_PER_MI : 1000);
// "5", "3.2", "0.75": two decimals, since a few hundred metres matter on a short run.
export const formatDistance = (m: number, units: Units) => formatNumber(mToUnit(m, units), 2);

// Accepts "72", "72.5", "72,5" (comma decimals) and a trailing "72." mid-typing.
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,5}(\.\d*)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseWhole(text: string): number | null {
  const t = text.trim();
  return /^\d{1,5}$/.test(t) ? Number(t) : null;
}
