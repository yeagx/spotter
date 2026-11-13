import type { SQLiteDatabase } from 'expo-sqlite';

import { getSplit } from '@/db/plan';
import { finishedSessionsBetween, newBestsIn } from '@/db/sessions';
import type { Weekday } from '@/db/types';
import { monthRange } from '@/lib/dates';

export type Recap = {
  done: number;
  planned: number;
  bestLift: { name: string; kg: number; reps: number } | null;
  newBests: number;
  // Only when the month has two or more check-ins with body fat.
  fat: { change: number; from: string; to: string } | null;
};

// Training days in the month under the current split: every date whose weekday trains.
async function plannedSessions(db: SQLiteDatabase, from: number, to: number) {
  const split = await getSplit(db);
  const weekdays = new Set(split?.days.flatMap((d) => (d.weekday ? [d.weekday] : [])));
  let count = 0;
  for (let d = new Date(from); d.getTime() < to; d.setDate(d.getDate() + 1)) {
    const js = d.getDay();
    if (weekdays.has((js === 0 ? 7 : js) as Weekday)) count++;
  }
  return count;
}

export async function getRecap(db: SQLiteDatabase, month: string): Promise<Recap> {
  const { from, to } = monthRange(month);
  const sessions = await finishedSessionsBetween(db, from, to);

  const best = await db.getFirstAsync<{ name: string; kg: number; reps: number }>(
    `SELECT e.name, l.kg, l.reps FROM set_log l
     JOIN session s ON s.id = l.session_id
     JOIN exercise e ON e.id = l.exercise_id
     WHERE s.finished_at IS NOT NULL AND s.started_at >= ? AND s.started_at < ? AND l.kg > 0
       AND e.tracking = 'weight'
     ORDER BY l.kg DESC, l.reps DESC LIMIT 1`,
    from,
    to,
  );

  let newBests = 0;
  for (const s of sessions) newBests += (await newBestsIn(db, s.id)).length;

  const pad = (n: number) => String(n).padStart(2, '0');
  const start = new Date(from);
  const end = new Date(to);
  const fromDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`;
  const toDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-01`;
  const fats = await db.getAllAsync<{ date: string; fat: number }>(
    `SELECT date, fat FROM checkin
     WHERE fat IS NOT NULL AND date >= ? AND date < ?
     ORDER BY date, created_at`,
    fromDate,
    toDate,
  );
  const first = fats[0];
  const last = fats[fats.length - 1];

  return {
    done: sessions.length,
    planned: await plannedSessions(db, from, to),
    bestLift: best ?? null,
    newBests,
    fat:
      fats.length >= 2
        ? { change: last.fat - first.fat, from: first.date, to: last.date }
        : null,
  };
}
