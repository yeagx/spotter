import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { WEEK } from '@/lib/week';

import { dataChanged } from './changes';
import { defaultScheme } from './plan';
import type { Tracking, Weekday } from './types';

// Ready-made splits, built from the bundled library. Applying one replaces the plan;
// everything stays editable afterwards. Days are laid out from Saturday (the app's week
// start) with the usual rest days between, and can be moved in Edit split.

// One exercise: library id, sets, then reps ([min, max]) or seconds for holds, and rest.
type Item = [id: string, sets: number, target: [number, number], restSec: number];
type TemplateDay = { weekday: Weekday; name: string; items: Item[] };

export type Template = {
  id: string;
  name: string;
  line: string; // who it's for, in one line
  days: TemplateDay[];
};

const Sat = 6, Sun = 7, Mon = 1, Tue = 2, Wed = 3, Thu = 4;

export const TEMPLATES: Template[] = [
  {
    id: 'full-body',
    name: 'Full Body',
    line: 'Three days, everything each time. The best start, and plenty for most people.',
    days: [
      {
        weekday: Sat,
        name: 'Full Body A',
        items: [
          ['barbell-squat', 3, [6, 10], 120],
          ['barbell-bench-press', 3, [6, 10], 120],
          ['barbell-row', 3, [8, 12], 90],
          ['dumbbell-shoulder-press', 3, [8, 12], 90],
          ['plank', 3, [30, 60], 60],
        ],
      },
      {
        weekday: Mon,
        name: 'Full Body B',
        items: [
          ['romanian-deadlift', 3, [8, 10], 120],
          ['incline-dumbbell-press', 3, [8, 12], 90],
          ['lat-pulldown', 3, [8, 12], 90],
          ['dumbbell-lateral-raise', 3, [12, 15], 60],
          ['dumbbell-curl', 2, [10, 12], 60],
          ['triceps-pushdown', 2, [10, 12], 60],
        ],
      },
      {
        weekday: Wed,
        name: 'Full Body C',
        items: [
          ['leg-press', 3, [10, 12], 90],
          ['machine-chest-press', 3, [8, 12], 90],
          ['seated-cable-row', 3, [8, 12], 90],
          ['walking-lunge', 2, [10, 12], 90],
          ['face-pull', 3, [12, 15], 60],
          ['hanging-leg-raise', 3, [10, 15], 60],
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    line: 'Four days, each half of the body twice a week. A step up once full body feels easy.',
    days: [
      {
        weekday: Sat,
        name: 'Upper A',
        items: [
          ['barbell-bench-press', 4, [6, 8], 150],
          ['barbell-row', 4, [6, 10], 120],
          ['overhead-press', 3, [8, 10], 120],
          ['lat-pulldown', 3, [10, 12], 90],
          ['ez-bar-curl', 3, [10, 12], 60],
          ['triceps-pushdown', 3, [10, 12], 60],
        ],
      },
      {
        weekday: Sun,
        name: 'Lower A',
        items: [
          ['barbell-squat', 4, [6, 8], 150],
          ['romanian-deadlift', 3, [8, 10], 120],
          ['leg-extension', 3, [12, 15], 60],
          ['seated-leg-curl', 3, [10, 12], 60],
          ['standing-calf-raise', 4, [10, 15], 60],
        ],
      },
      {
        weekday: Tue,
        name: 'Upper B',
        items: [
          ['incline-dumbbell-press', 3, [8, 12], 90],
          ['pull-up', 3, [6, 10], 120],
          ['dumbbell-shoulder-press', 3, [8, 12], 90],
          ['seated-cable-row', 3, [10, 12], 90],
          ['dumbbell-lateral-raise', 3, [12, 15], 60],
          ['hammer-curl', 3, [10, 12], 60],
          ['overhead-cable-extension', 3, [10, 12], 60],
        ],
      },
      {
        weekday: Wed,
        name: 'Lower B',
        items: [
          ['deadlift', 3, [5, 6], 180],
          ['leg-press', 3, [10, 12], 120],
          ['bulgarian-split-squat', 3, [8, 10], 90],
          ['lying-leg-curl', 3, [10, 12], 60],
          ['seated-calf-raise', 3, [12, 15], 60],
          ['plank', 3, [30, 60], 60],
        ],
      },
    ],
  },
  {
    id: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    line: 'Six days, each muscle twice a week. For when training is a habit, not a goal.',
    days: [
      {
        weekday: Sat,
        name: 'Push A',
        items: [
          ['barbell-bench-press', 4, [6, 8], 150],
          ['overhead-press', 3, [8, 10], 120],
          ['incline-dumbbell-press', 3, [8, 12], 90],
          ['dumbbell-lateral-raise', 3, [12, 15], 60],
          ['triceps-pushdown', 3, [10, 12], 60],
        ],
      },
      {
        weekday: Sun,
        name: 'Pull A',
        items: [
          ['deadlift', 3, [5, 6], 180],
          ['pull-up', 3, [6, 10], 120],
          ['barbell-row', 3, [8, 10], 90],
          ['face-pull', 3, [12, 15], 60],
          ['barbell-curl', 3, [10, 12], 60],
        ],
      },
      {
        weekday: Mon,
        name: 'Legs A',
        items: [
          ['barbell-squat', 4, [6, 8], 150],
          ['romanian-deadlift', 3, [8, 10], 120],
          ['leg-press', 3, [10, 12], 90],
          ['seated-leg-curl', 3, [10, 12], 60],
          ['standing-calf-raise', 4, [10, 15], 60],
        ],
      },
      {
        weekday: Tue,
        name: 'Push B',
        items: [
          ['incline-barbell-press', 4, [6, 10], 120],
          ['dumbbell-shoulder-press', 3, [8, 12], 90],
          ['cable-fly', 3, [12, 15], 60],
          ['cable-lateral-raise', 3, [12, 15], 60],
          ['overhead-cable-extension', 3, [10, 12], 60],
        ],
      },
      {
        weekday: Wed,
        name: 'Pull B',
        items: [
          ['lat-pulldown', 4, [8, 12], 90],
          ['chest-supported-row', 3, [8, 12], 90],
          ['single-arm-cable-row', 3, [10, 12], 60],
          ['rear-delt-fly', 3, [12, 15], 60],
          ['hammer-curl', 3, [10, 12], 60],
        ],
      },
      {
        weekday: Thu,
        name: 'Legs B',
        items: [
          ['hack-squat', 4, [8, 10], 120],
          ['hip-thrust', 3, [8, 12], 90],
          ['walking-lunge', 3, [10, 12], 90],
          ['leg-extension', 3, [12, 15], 60],
          ['seated-calf-raise', 4, [12, 15], 60],
          ['hanging-leg-raise', 3, [10, 15], 60],
        ],
      },
    ],
  },
];

// Replaces the plan with a template: the split takes its name, every day is replaced.
// Days are positioned in display-week order, as Edit split does.
// Past sessions keep their history (the schema only unlinks them from deleted days).
export async function applyTemplate(db: SQLiteDatabase, template: Template): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM split ORDER BY created_at LIMIT 1');
    const splitId = existing?.id ?? randomUUID();
    if (existing) {
      await db.runAsync('UPDATE split SET name = ?, updated_at = ? WHERE id = ?', template.name, now, splitId);
      await db.runAsync('DELETE FROM split_day WHERE split_id = ?', splitId);
    } else {
      await db.runAsync(
        'INSERT INTO split (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        splitId,
        template.name,
        now,
        now,
      );
    }

    const tracking = new Map(
      (await db.getAllAsync<{ id: string; tracking: Tracking }>('SELECT id, tracking FROM exercise')).map((r) => [
        r.id,
        r.tracking,
      ]),
    );
    const ordered = [...template.days].sort((a, b) => WEEK.indexOf(a.weekday) - WEEK.indexOf(b.weekday));
    for (const [position, day] of ordered.entries()) {
      const dayId = randomUUID();
      await db.runAsync(
        `INSERT INTO split_day (id, split_id, weekday, name, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        dayId,
        splitId,
        day.weekday,
        day.name,
        position,
        now,
        now,
      );
      let at = 0;
      for (const [exerciseId, sets, [lo, hi], restSec] of day.items) {
        const kind = tracking.get(exerciseId);
        if (!kind) continue; // not in this install's library
        const scheme = defaultScheme(kind);
        const timed = kind === 'time' || kind === 'cardio';
        await db.runAsync(
          `INSERT INTO day_exercise
             (id, split_day_id, exercise_id, sets, reps_min, reps_max, target_sec_min,
              target_sec_max, rest_sec, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          randomUUID(),
          dayId,
          exerciseId,
          sets,
          timed ? scheme.repsMin : lo,
          timed ? scheme.repsMax : hi,
          timed ? lo : scheme.secMin,
          timed ? hi : scheme.secMax,
          restSec,
          at++,
          now,
          now,
        );
      }
    }
  });
  dataChanged();
}
