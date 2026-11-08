import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listCheckins } from '@/db/checkins';
import { getMeta, setMeta } from '@/db/meta';
import { getSplit, type SplitDay } from '@/db/plan';
import { getProfile, type Profile } from '@/db/profile';
import { getRecap, type Recap } from '@/db/recap';
import {
  bestLift,
  exerciseHistory,
  finishedSessionsBetween,
  getOpenSession,
  lastTopKg,
  newBestsIn,
  type Lift,
  type SessionTop,
} from '@/db/sessions';
import { caughtUpToday, stillOpenDay } from '@/lib/catchUp';
import { formatDay, monthKey, monthName, startOfDay, startOfWeek } from '@/lib/dates';
import { dayTitle } from '@/lib/scheme';
import { formatNumber, formatWeight, kgToUnit } from '@/lib/units';
import { WEEK, today, weekdayName } from '@/lib/week';

// What each widget shows, read from the same SQLite data as the app's screens and
// built from the same queries, so a widget never disagrees with the screen it opens.

// Deep links into the app (app.json "scheme"). Expo Router maps the path to a screen.
export const link = (path = '') => `spotter://${path}`;

const weight = (kg: number, p: Profile) => `${formatWeight(kg, p.units)} ${p.units}`;
export const liftText = (l: Lift, p: Profile) => `${weight(l.kg, p)} × ${l.reps}`;

// ---------- Today ----------

export type WeekBar = 'done' | 'today' | 'planned' | 'rest';

export type TodayModel =
  | { kind: 'setup' }
  | { kind: 'noPlan'; label: string }
  | {
      kind: 'train';
      label: string;
      title: string;
      exercises: { name: string; last: string | null }[];
      sets: number;
      week: WeekBar[];
      state: 'start' | 'resume' | 'done';
      uri: string;
    }
  | { kind: 'rest'; label: string; next: string | null; week: WeekBar[] };

export async function todayModel(db: SQLiteDatabase): Promise<TodayModel> {
  const profile = await getProfile(db);
  if (!profile) return { kind: 'setup' };

  const split = await getSplit(db);
  const weekday = today();
  const training = WEEK.flatMap((w) => split?.days.filter((d) => d.weekday === w) ?? []);
  if (!split || training.length === 0) return { kind: 'noPlan', label: weekdayName(weekday) };

  const week = await finishedSessionsBetween(db, startOfWeek(), Date.now() + 1);
  const doneWeek = new Set(week.flatMap((s) => (s.splitDayId ? [s.splitDayId] : [])));
  const dayStart = startOfDay();
  const doneToday = new Set(
    week.filter((s) => s.startedAt >= dayStart).flatMap((s) => (s.splitDayId ? [s.splitDayId] : [])),
  );

  const bars: WeekBar[] = WEEK.map((w) => {
    const day = split.days.find((d) => d.weekday === w);
    if (day && doneWeek.has(day.id)) return 'done';
    if (w === weekday && day) return 'today';
    return day ? 'planned' : 'rest';
  });

  const todayDay = training.find((d) => d.weekday === weekday);
  // On a rest day, a day from earlier this week that wasn't trained takes its place,
  // as on Today (lib/catchUp). Once made up, it stays as done for the rest of the day.
  const carried = todayDay ? null : (stillOpenDay(training, doneWeek, weekday) ?? caughtUpToday(training, doneToday, weekday));
  const day = todayDay ?? carried;
  if (!day) {
    const next = nextTrainingDay(training);
    return {
      kind: 'rest',
      label: `${weekdayName(weekday)} · Rest`,
      next: next?.weekday ? `Next: ${weekdayName(next.weekday)} · ${dayTitle(next)}` : null,
      week: bars,
    };
  }

  const open = await getOpenSession(db);
  const ids = day.exercises.map((e) => e.exercise.id);
  // A tall widget can list most of a day, so weights for more than the first few.
  const last = await lastTopKg(db, ids.slice(0, 8));
  const state = open ? 'resume' : doneToday.has(day.id) ? 'done' : 'start';
  const n = training.indexOf(day) + 1;
  return {
    kind: 'train',
    label: carried?.weekday ? `From ${weekdayName(carried.weekday)} · Day ${n}` : `${weekdayName(weekday)} · Day ${n}`,
    title: dayTitle(day),
    exercises: day.exercises.map((e) => ({
      name: e.exercise.name,
      last: last.has(e.exercise.id) ? weight(last.get(e.exercise.id)!, profile) : null,
    })),
    sets: day.exercises.reduce((sum, e) => sum + e.sets, 0),
    week: bars,
    state,
    uri:
      state === 'resume' && open
        ? link(`workout/${open.id}`)
        : state === 'start'
          ? link(carried ? `start?dayId=${carried.id}` : 'start')
          : link(),
  };
}

function nextTrainingDay(days: SplitDay[]): SplitDay | null {
  const from = WEEK.indexOf(today());
  for (let step = 1; step <= WEEK.length; step++) {
    const day = days.find((d) => d.weekday === WEEK[(from + step) % WEEK.length]);
    if (day) return day;
  }
  return null;
}

// ---------- Start ----------

// Where the Start widget goes: a session in progress first, then today's day, or on a
// rest day the day from earlier this week that's still open.
export async function startUri(db: SQLiteDatabase): Promise<string> {
  const open = await getOpenSession(db);
  if (open) return link(`workout/${open.id}`);
  const split = await getSplit(db);
  const weekday = today();
  const training = WEEK.flatMap((w) => split?.days.filter((d) => d.weekday === w) ?? []);
  if (training.some((d) => d.weekday === weekday)) return link('start');
  const week = await finishedSessionsBetween(db, startOfWeek(), Date.now() + 1);
  const done = new Set(week.flatMap((s) => (s.splitDayId ? [s.splitDayId] : [])));
  const carried = stillOpenDay(training, done, weekday);
  return link(carried ? `start?dayId=${carried.id}` : 'start');
}

// ---------- Month ----------

export type MonthModel =
  | { kind: 'setup' }
  | { kind: 'month'; month: string; name: string; recap: Recap; best: string | null; fat: string | null };

export async function monthModel(db: SQLiteDatabase): Promise<MonthModel> {
  const profile = await getProfile(db);
  if (!profile) return { kind: 'setup' };
  const month = monthKey();
  const recap = await getRecap(db, month);
  return {
    kind: 'month',
    month,
    name: monthName(month),
    recap,
    best: recap.bestLift ? `${recap.bestLift.name} · ${liftText(recap.bestLift, profile)}` : null,
    fat: recap.fat ? `${signed(recap.fat.change)}%` : null,
  };
}

// "+1.2" / "−0.6" (a real minus sign), "0" when unchanged.
export const signed = (n: number) =>
  n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : '0';

// ---------- Best lift ----------

const bestKey = (widgetId: number) => `widget.best.${widgetId}`;

export const setBestLiftChoice = (db: SQLiteDatabase, widgetId: number, exerciseId: string) =>
  setMeta(db, bestKey(widgetId), exerciseId);

export const clearBestLiftChoice = (db: SQLiteDatabase, widgetId: number) =>
  db.runAsync('DELETE FROM meta WHERE key = ?', bestKey(widgetId));

// The exercise behind the heaviest set ever logged: the default pick.
export async function topLiftId(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ exercise_id: string }>(
    'SELECT exercise_id FROM set_log WHERE kg > 0 ORDER BY kg DESC, reps DESC LIMIT 1',
  );
  return row?.exercise_id ?? null;
}

export type BestLiftModel =
  | { kind: 'setup' }
  | { kind: 'empty'; name: string | null; uri: string }
  | {
      kind: 'lift';
      name: string;
      best: string;
      bestKg: string;
      bestRest: string; // "kg × 5"
      history: SessionTop[];
      newBest: boolean;
      uri: string;
    };

export async function bestLiftModel(db: SQLiteDatabase, widgetId: number): Promise<BestLiftModel> {
  const profile = await getProfile(db);
  if (!profile) return { kind: 'setup' };
  const id = (await getMeta(db, bestKey(widgetId))) ?? (await topLiftId(db));
  if (!id) return { kind: 'empty', name: null, uri: link() };

  const exercise = await db.getFirstAsync<{ name: string }>('SELECT name FROM exercise WHERE id = ?', id);
  const uri = link(`exercise/${id}`);
  const best = await bestLift(db, id);
  if (!exercise || !best) return { kind: 'empty', name: exercise?.name ?? null, uri };

  const history = await exerciseHistory(db, id, 6);
  const latest = history[history.length - 1];
  const newBest = latest ? (await newBestsIn(db, latest.sessionId)).includes(id) : false;
  return {
    kind: 'lift',
    name: exercise.name,
    best: liftText(best, profile),
    bestKg: formatWeight(best.kg, profile.units),
    bestRest: `${profile.units} × ${best.reps}`,
    history,
    newBest,
    uri,
  };
}

// Exercises worth pinning: anything with a logged set (heaviest first), then the rest
// of the plan.
export async function bestLiftChoices(
  db: SQLiteDatabase,
): Promise<{ id: string; name: string; best: string | null }[]> {
  const profile = await getProfile(db);
  const logged = await db.getAllAsync<{ id: string; name: string; kg: number; reps: number }>(
    `SELECT e.id, e.name, l.kg, l.reps FROM exercise e
     JOIN set_log l ON l.id = (
       SELECT id FROM set_log WHERE exercise_id = e.id ORDER BY kg DESC, reps DESC LIMIT 1)
     ORDER BY l.kg DESC, l.reps DESC`,
  );
  const planned = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT DISTINCT e.id, e.name FROM exercise e
     JOIN day_exercise d ON d.exercise_id = e.id
     WHERE e.id NOT IN (SELECT exercise_id FROM set_log)
     ORDER BY e.name`,
  );
  return [
    ...logged.map((r) => ({ id: r.id, name: r.name, best: profile ? liftText(r, profile) : null })),
    ...planned.map((r) => ({ ...r, best: null })),
  ];
}

// ---------- Body ----------

export type BodyModel =
  | { kind: 'setup' }
  | { kind: 'empty' }
  | {
      kind: 'body';
      date: string;
      weight: string;
      unit: string;
      change: string | null; // since the check-in before, "−0.6 kg"
      target: string | null; // "75 kg"
      fat: string | null;
      muscle: string | null;
    };

export async function bodyModel(db: SQLiteDatabase): Promise<BodyModel> {
  const profile = await getProfile(db);
  if (!profile) return { kind: 'setup' };
  const all = await listCheckins(db); // oldest first
  const latest = all[all.length - 1];
  if (!latest) return { kind: 'empty' };
  const previous = all[all.length - 2];
  const delta = previous ? latest.weight - previous.weight : null;
  return {
    kind: 'body',
    date: formatDay(latest.date),
    weight: formatWeight(latest.weight, profile.units),
    unit: profile.units,
    change: delta === null ? null : `${signed(kgToUnit(delta, profile.units))} ${profile.units}`,
    target: profile.targetKg ? weight(profile.targetKg, profile) : null,
    fat: latest.fat !== null ? `${formatNumber(latest.fat)}%` : null,
    muscle: latest.muscle !== null ? `${formatNumber(latest.muscle)}%` : null,
  };
}

// ---------- Me ----------

export type MeModel =
  | { kind: 'setup' }
  | {
      kind: 'me';
      name: string;
      initial: string;
      photo: string | null; // file:// uri, only if the file is really there
      subtitle: string; // "Get lean · Full Body"
      done: number;
      planned: number;
      best: string | null;
      weight: string | null; // "78.4 → 75 kg"
      newBests: number;
    };

export async function meModel(db: SQLiteDatabase): Promise<MeModel> {
  const profile = await getProfile(db);
  if (!profile) return { kind: 'setup' };
  const split = await getSplit(db);
  const recap = await getRecap(db, monthKey());
  const checkins = await listCheckins(db);
  const latest = checkins[checkins.length - 1];

  let weightLine: string | null = null;
  if (latest && profile.targetKg) {
    weightLine = `${formatWeight(latest.weight, profile.units)} → ${weight(profile.targetKg, profile)}`;
  } else if (latest) {
    weightLine = weight(latest.weight, profile);
  }

  return {
    kind: 'me',
    name: profile.name,
    initial: profile.name.trim().charAt(0).toUpperCase() || '·',
    photo: photoIfPresent(profile.photoUri),
    subtitle: [profile.goal === 'lean' ? 'Get lean' : 'Stay healthy', split?.name].filter(Boolean).join(' · '),
    done: recap.done,
    planned: recap.planned,
    best: recap.bestLift ? `${recap.bestLift.name} · ${liftText(recap.bestLift, profile)}` : null,
    weight: weightLine,
    newBests: recap.newBests,
  };
}

// A missing photo file would make the native image load fail and the widget go blank.
function photoIfPresent(uri: string | null): string | null {
  if (!uri) return null;
  try {
    return new File(uri).exists ? uri : null;
  } catch {
    return null;
  }
}
