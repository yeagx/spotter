// Formatting and parsing for sets, reps and rest as the user sees and types them.

import type { SplitDay } from '@/db/plan';

export const SETS_MIN = 1;
export const SETS_MAX = 10;
const REST_MAX_SEC = 60 * 60;

export function formatReps(min: number, max: number) {
  return min === max ? String(min) : `${min}–${max}`;
}

// Accepts "10", "8-12", "8–12", "8 to 12". Reversed ranges are swapped.
export function parseReps(text: string): { min: number; max: number } | null {
  const m = text.trim().match(/^(\d{1,3})(?:\s*(?:-|–|—|to)\s*(\d{1,3}))?$/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return min > 0 ? { min, max } : null;
}

export function formatRest(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Accepts "1:30" (m:ss) or a plain number of seconds ("90").
export function parseRest(text: string): number | null {
  const t = text.trim();
  const clock = t.match(/^(\d{1,2}):([0-5]\d)$/);
  const sec = clock ? Number(clock[1]) * 60 + Number(clock[2]) : /^\d{1,4}$/.test(t) ? Number(t) : NaN;
  return Number.isNaN(sec) || sec > REST_MAX_SEC ? null : sec;
}

export function formatScheme(sets: number, repsMin: number, repsMax: number) {
  return `${sets} × ${formatReps(repsMin, repsMax)}`;
}

// "6 exercises · 19 sets", or a quiet hint for an empty day.
export function daySummary(day: Pick<SplitDay, 'exercises'>) {
  const n = day.exercises.length;
  if (n === 0) return 'No exercises yet';
  const sets = day.exercises.reduce((sum, e) => sum + e.sets, 0);
  return `${n} ${n === 1 ? 'exercise' : 'exercises'} · ${sets} sets`;
}

export const dayTitle = (day: Pick<SplitDay, 'name'>) => day.name.trim() || 'New day';
