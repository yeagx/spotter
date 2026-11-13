import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataChanged } from './changes';
import type { Tracking } from './types';

// A workout session and the sets logged in it. All weights are kg.

export type Session = {
  id: string;
  splitDayId: string | null;
  startedAt: number;
  finishedAt: number | null;
};

// One logged set. Fields an exercise doesn't track are 0 (see Tracking): a treadmill
// set is { kg: 0, reps: 0, sec: 1200, m: 3100 }.
export type Lift = { kg: number; reps: number; sec: number; m: number };

export type SetLog = Lift & {
  id: string;
  exerciseId: string;
  setIndex: number;
  doneAt: number;
};

// Whether set `a` is better than `b`, by what the exercise tracks: heavier then more
// reps; most reps; longest; farthest then longest.
export function beats(a: Lift, b: Lift | null, tracking: Tracking): boolean {
  if (!b) return true;
  const order: [number, number][] =
    tracking === 'reps'
      ? [[a.reps, b.reps], [a.kg, b.kg]]
      : tracking === 'time'
        ? [[a.sec, b.sec]]
        : tracking === 'cardio'
          ? [[a.m, b.m], [a.sec, b.sec]]
          : [[a.kg, b.kg], [a.reps, b.reps]];
  for (const [x, y] of order) if (x !== y) return x > y;
  return false;
}

// The same order in SQL, best first. `t` is the set_log alias, e.g. "l.".
function bestOrder(tracking: Tracking, t = '') {
  const sec = `COALESCE(${t}duration_sec, 0) DESC`;
  if (tracking === 'reps') return `${t}reps DESC, ${t}kg DESC`;
  if (tracking === 'time') return sec;
  if (tracking === 'cardio') return `COALESCE(${t}distance_m, 0) DESC, ${sec}`;
  return `${t}kg DESC, ${t}reps DESC`;
}

// A set's numbers as a Lift, from set_log aliased as `t`.
const liftCols = (t = '') =>
  `${t}kg AS kg, ${t}reps AS reps, COALESCE(${t}duration_sec, 0) AS sec, COALESCE(${t}distance_m, 0) AS m`;

async function trackingOf(db: SQLiteDatabase, exerciseId: string): Promise<Tracking> {
  const row = await db.getFirstAsync<{ tracking: Tracking }>('SELECT tracking FROM exercise WHERE id = ?', exerciseId);
  return row?.tracking ?? 'weight';
}

type SessionRow = {
  id: string;
  split_day_id: string | null;
  started_at: number;
  finished_at: number | null;
};

type SetLogRow = {
  id: string;
  exercise_id: string;
  set_index: number;
  kg: number;
  reps: number;
  duration_sec: number | null;
  distance_m: number | null;
  done_at: number;
};

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  splitDayId: r.split_day_id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
});

const toSetLog = (r: SetLogRow): SetLog => ({
  id: r.id,
  exerciseId: r.exercise_id,
  setIndex: r.set_index,
  kg: r.kg,
  reps: r.reps,
  sec: r.duration_sec ?? 0,
  m: r.distance_m ?? 0,
  doneAt: r.done_at,
});

export async function createSession(db: SQLiteDatabase, splitDayId: string): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO session (id, split_day_id, started_at, finished_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    id,
    splitDayId,
    now,
    now,
    now,
  );
  dataChanged();
  return id;
}

export async function getSession(db: SQLiteDatabase, id: string): Promise<Session | null> {
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM session WHERE id = ?', id);
  return row ? toSession(row) : null;
}

// A session left open (the app was closed mid-workout) is offered for resuming.
export async function getOpenSession(db: SQLiteDatabase): Promise<Session | null> {
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM session WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return row ? toSession(row) : null;
}

// Ends a session. With nothing logged there's nothing worth keeping, so it's removed.
export async function endSession(
  db: SQLiteDatabase,
  id: string,
): Promise<'finished' | 'discarded'> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM set_log WHERE session_id = ?',
    id,
  );
  if (!row?.n) {
    await db.runAsync('DELETE FROM session WHERE id = ?', id);
    dataChanged();
    return 'discarded';
  }
  const now = Date.now();
  await db.runAsync(
    'UPDATE session SET finished_at = COALESCE(finished_at, ?), updated_at = ? WHERE id = ?',
    now,
    now,
    id,
  );
  dataChanged();
  return 'finished';
}

export async function listSetLogs(db: SQLiteDatabase, sessionId: string): Promise<SetLog[]> {
  const rows = await db.getAllAsync<SetLogRow>(
    'SELECT * FROM set_log WHERE session_id = ? ORDER BY done_at',
    sessionId,
  );
  return rows.map(toSetLog);
}

export async function saveSetLog(
  db: SQLiteDatabase,
  sessionId: string,
  log: Omit<SetLog, 'doneAt'> & { doneAt?: number },
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO set_log
       (id, session_id, exercise_id, set_index, kg, reps, duration_sec, distance_m, done_at,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       kg = excluded.kg,
       reps = excluded.reps,
       duration_sec = excluded.duration_sec,
       distance_m = excluded.distance_m,
       updated_at = excluded.updated_at`,
    log.id,
    sessionId,
    log.exerciseId,
    log.setIndex,
    log.kg,
    log.reps,
    log.sec || null,
    log.m || null,
    log.doneAt ?? now,
    now,
    now,
  );
  dataChanged();
}

export async function deleteSetLog(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM set_log WHERE id = ?', id);
  dataChanged();
}

// How many sets each exercise has in this session, for the ones where the user added or
// removed a set. Keyed by day_exercise id; exercises left as planned aren't listed.
export async function getSetCounts(db: SQLiteDatabase, sessionId: string): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ day_exercise_id: string; sets: number }>(
    'SELECT day_exercise_id, sets FROM session_sets WHERE session_id = ?',
    sessionId,
  );
  return new Map(rows.map((r) => [r.day_exercise_id, r.sets]));
}

export async function saveSetCount(
  db: SQLiteDatabase,
  sessionId: string,
  dayExerciseId: string,
  sets: number,
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO session_sets (session_id, day_exercise_id, sets, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (session_id, day_exercise_id) DO UPDATE SET
       sets = excluded.sets,
       updated_at = excluded.updated_at`,
    sessionId,
    dayExerciseId,
    sets,
    now,
    now,
  );
}

// Takes one set out of this session: its log (if it was ticked) goes, the sets after it
// move up one, and the exercise keeps `setsLeft` sets if the session is resumed.
// The plan itself is never touched.
export async function removeSet(
  db: SQLiteDatabase,
  sessionId: string,
  item: { dayExerciseId: string; exerciseId: string },
  setIndex: number,
  setsLeft: number,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM set_log WHERE session_id = ? AND exercise_id = ? AND set_index = ?',
      sessionId,
      item.exerciseId,
      setIndex,
    );
    await db.runAsync(
      `UPDATE set_log SET set_index = set_index - 1, updated_at = ?
       WHERE session_id = ? AND exercise_id = ? AND set_index > ?`,
      now,
      sessionId,
      item.exerciseId,
      setIndex,
    );
    await saveSetCount(db, sessionId, item.dayExerciseId, setsLeft);
  });
  dataChanged();
}

// The sets from the most recent other session that included this exercise, in order.
// Pre-fills Workout and powers "last time".
export async function lastSets(
  db: SQLiteDatabase,
  exerciseId: string,
  excludeSessionId: string | null = null,
): Promise<Lift[]> {
  return db.getAllAsync<Lift>(
    `SELECT ${liftCols()} FROM set_log
     WHERE exercise_id = $ex
       AND session_id = (
         SELECT session_id FROM set_log
         WHERE exercise_id = $ex AND ($skip IS NULL OR session_id != $skip)
         ORDER BY done_at DESC LIMIT 1)
     ORDER BY set_index`,
    { $ex: exerciseId, $skip: excludeSessionId },
  );
}

// Best set ever logged, optionally ignoring one session (the one in progress).
export async function bestLift(
  db: SQLiteDatabase,
  exerciseId: string,
  excludeSessionId: string | null = null,
): Promise<Lift | null> {
  const tracking = await trackingOf(db, exerciseId);
  return db.getFirstAsync<Lift>(
    `SELECT ${liftCols()} FROM set_log
     WHERE exercise_id = $ex AND ($skip IS NULL OR session_id != $skip)
     ORDER BY ${bestOrder(tracking)} LIMIT 1`,
    { $ex: exerciseId, $skip: excludeSessionId },
  );
}

export type SessionTop = Lift & { sessionId: string; doneAt: number };

// Top set of each of the last `limit` sessions with this exercise, oldest first.
export async function exerciseHistory(
  db: SQLiteDatabase,
  exerciseId: string,
  limit = 6,
): Promise<SessionTop[]> {
  const tracking = await trackingOf(db, exerciseId);
  const rows = await db.getAllAsync<Lift & { session_id: string; done_at: number }>(
    `SELECT session_id, kg, reps, sec, m, done_at FROM (
       SELECT session_id, ${liftCols()}, done_at,
              ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY ${bestOrder(tracking)}) AS rank,
              MAX(done_at) OVER (PARTITION BY session_id) AS last_at
       FROM set_log WHERE exercise_id = ?)
     WHERE rank = 1
     ORDER BY last_at DESC
     LIMIT ?`,
    exerciseId,
    limit,
  );
  return rows
    .map((r) => ({ sessionId: r.session_id, kg: r.kg, reps: r.reps, sec: r.sec, m: r.m, doneAt: r.done_at }))
    .reverse();
}

export type ExerciseSession = { sessionId: string; at: number; sets: Lift[] };

// The last `limit` sessions that included this exercise, newest first, each with its
// sets in the order they were done. Unfinished sessions count too: the sets are real.
export async function exerciseSessions(
  db: SQLiteDatabase,
  exerciseId: string,
  limit = 5,
): Promise<ExerciseSession[]> {
  const rows = await db.getAllAsync<Lift & { session_id: string; done_at: number }>(
    `SELECT session_id, ${liftCols()}, done_at FROM set_log
     WHERE exercise_id = $ex
       AND session_id IN (
         SELECT session_id FROM set_log WHERE exercise_id = $ex
         GROUP BY session_id ORDER BY MAX(done_at) DESC LIMIT $limit)
     ORDER BY set_index`,
    { $ex: exerciseId, $limit: limit },
  );
  const bySession = new Map<string, ExerciseSession>();
  for (const r of rows) {
    const s = bySession.get(r.session_id) ?? { sessionId: r.session_id, at: 0, sets: [] };
    s.at = Math.max(s.at, r.done_at);
    s.sets.push({ kg: r.kg, reps: r.reps, sec: r.sec, m: r.m });
    bySession.set(r.session_id, s);
  }
  return [...bySession.values()].sort((a, b) => b.at - a.at);
}

// Exercises swapped for this session only, keyed by day_exercise id.
export async function getSwaps(db: SQLiteDatabase, sessionId: string): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ day_exercise_id: string; exercise_id: string }>(
    'SELECT day_exercise_id, exercise_id FROM session_swap WHERE session_id = ?',
    sessionId,
  );
  return new Map(rows.map((r) => [r.day_exercise_id, r.exercise_id]));
}

// Records a swap, or takes it back when `exerciseId` is null (the planned exercise again).
export async function saveSwap(
  db: SQLiteDatabase,
  sessionId: string,
  dayExerciseId: string,
  exerciseId: string | null,
): Promise<void> {
  if (exerciseId === null) {
    await db.runAsync(
      'DELETE FROM session_swap WHERE session_id = ? AND day_exercise_id = ?',
      sessionId,
      dayExerciseId,
    );
    return;
  }
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO session_swap (session_id, day_exercise_id, exercise_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (session_id, day_exercise_id) DO UPDATE SET
       exercise_id = excluded.exercise_id,
       updated_at = excluded.updated_at`,
    sessionId,
    dayExerciseId,
    exerciseId,
    now,
    now,
  );
}

// The order of this session's exercises once the user has moved them (did the cardio
// first, switched with one later in the day). Keyed by day_exercise id; empty when the
// session follows the plan.
export async function getSessionOrder(db: SQLiteDatabase, sessionId: string): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ day_exercise_id: string; position: number }>(
    'SELECT day_exercise_id, position FROM session_order WHERE session_id = ?',
    sessionId,
  );
  return new Map(rows.map((r) => [r.day_exercise_id, r.position]));
}

// Saves the whole order at once, so it's never half old, half new.
export async function saveSessionOrder(
  db: SQLiteDatabase,
  sessionId: string,
  dayExerciseIds: string[],
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM session_order WHERE session_id = ?', sessionId);
    for (const [position, id] of dayExerciseIds.entries()) {
      await db.runAsync(
        `INSERT INTO session_order (session_id, day_exercise_id, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        sessionId,
        id,
        position,
        now,
        now,
      );
    }
  });
}

export type SummaryLine = {
  exerciseId: string;
  name: string;
  tracking: Tracking;
  sets: number;
  top: Lift; // the best set, by what the exercise tracks
  isBest: boolean; // beat every earlier session
};

export type SessionSummary = {
  session: Session;
  dayName: string | null; // null when the day has since been removed from the plan
  lines: SummaryLine[]; // in the order the exercises were first done
  sets: number;
  volumeKg: number; // weight × reps over every set; 0 for a bodyweight-only session
};

// Everything the finished-session screen and its share card say about one session.
export async function sessionSummary(db: SQLiteDatabase, sessionId: string): Promise<SessionSummary | null> {
  const session = await getSession(db, sessionId);
  if (!session) return null;
  const day = session.splitDayId
    ? await db.getFirstAsync<{ name: string }>('SELECT name FROM split_day WHERE id = ?', session.splitDayId)
    : null;
  const rows = await db.getAllAsync<Lift & { exercise_id: string; name: string; tracking: Tracking }>(
    `SELECT l.exercise_id, e.name, e.tracking, ${liftCols('l.')} FROM set_log l
     JOIN exercise e ON e.id = l.exercise_id
     WHERE l.session_id = ? ORDER BY l.done_at`,
    sessionId,
  );
  const bests = new Set(await newBestsIn(db, sessionId));
  const lines = new Map<string, SummaryLine>();
  let volumeKg = 0;
  for (const r of rows) {
    volumeKg += r.kg * r.reps;
    const line = lines.get(r.exercise_id);
    const lift = { kg: r.kg, reps: r.reps, sec: r.sec, m: r.m };
    if (!line) {
      lines.set(r.exercise_id, {
        exerciseId: r.exercise_id,
        name: r.name,
        tracking: r.tracking,
        sets: 1,
        top: lift,
        isBest: bests.has(r.exercise_id),
      });
    } else {
      line.sets += 1;
      if (beats(lift, line.top, r.tracking)) line.top = lift;
    }
  }
  return {
    session,
    dayName: day?.name.trim() || null,
    lines: [...lines.values()],
    sets: rows.length,
    volumeKg,
  };
}

// Heaviest weight from the last session per exercise, for Today's list. Exercises done
// without weight (bodyweight, cardio) aren't listed.
export async function lastTopKg(
  db: SQLiteDatabase,
  exerciseIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const id of exerciseIds) {
    const top = Math.max(0, ...(await lastSets(db, id)).map((s) => s.kg));
    if (top > 0) result.set(id, top);
  }
  return result;
}

export async function finishedSessionsBetween(
  db: SQLiteDatabase,
  from: number,
  to: number,
): Promise<Session[]> {
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM session
     WHERE finished_at IS NOT NULL AND started_at >= ? AND started_at < ?
     ORDER BY started_at`,
    from,
    to,
  );
  return rows.map(toSession);
}

// Exercises in which a session beat every earlier session's best. A first-ever
// session for an exercise sets the mark but isn't counted as a new best.
export async function newBestsIn(db: SQLiteDatabase, sessionId: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ exercise_id: string; tracking: Tracking }>(
    `SELECT DISTINCT l.exercise_id, e.tracking FROM set_log l
     JOIN exercise e ON e.id = l.exercise_id WHERE l.session_id = ?`,
    sessionId,
  );
  const bests: string[] = [];
  for (const { exercise_id, tracking } of rows) {
    const mine = await db.getFirstAsync<Lift>(
      `SELECT ${liftCols()} FROM set_log WHERE session_id = ? AND exercise_id = ?
       ORDER BY ${bestOrder(tracking)} LIMIT 1`,
      sessionId,
      exercise_id,
    );
    const before = await db.getFirstAsync<Lift>(
      `SELECT ${liftCols('p.')} FROM set_log p JOIN session ps ON ps.id = p.session_id
       WHERE p.exercise_id = ? AND ps.started_at < (SELECT started_at FROM session WHERE id = ?)
       ORDER BY ${bestOrder(tracking, 'p.')} LIMIT 1`,
      exercise_id,
      sessionId,
    );
    if (mine && before && beats(mine, before, tracking)) bests.push(exercise_id);
  }
  return bests;
}
