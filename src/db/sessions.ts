import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataChanged } from './changes';

// A workout session and the sets logged in it. All weights are kg.

export type Session = {
  id: string;
  splitDayId: string | null;
  startedAt: number;
  finishedAt: number | null;
};

export type SetLog = {
  id: string;
  exerciseId: string;
  setIndex: number;
  kg: number;
  reps: number;
  doneAt: number;
};

// One set, as compared for "best": heavier wins, then more reps at that weight.
export type Lift = { kg: number; reps: number };

export const beats = (a: Lift, b: Lift | null) =>
  !b || a.kg > b.kg || (a.kg === b.kg && a.reps > b.reps);

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
       (id, session_id, exercise_id, set_index, kg, reps, done_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       kg = excluded.kg,
       reps = excluded.reps,
       updated_at = excluded.updated_at`,
    log.id,
    sessionId,
    log.exerciseId,
    log.setIndex,
    log.kg,
    log.reps,
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
    `SELECT kg, reps FROM set_log
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
  return db.getFirstAsync<Lift>(
    `SELECT kg, reps FROM set_log
     WHERE exercise_id = $ex AND ($skip IS NULL OR session_id != $skip)
     ORDER BY kg DESC, reps DESC LIMIT 1`,
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
  const rows = await db.getAllAsync<{ session_id: string; kg: number; reps: number; done_at: number }>(
    `SELECT session_id, kg, reps, done_at FROM (
       SELECT session_id, kg, reps, done_at,
              ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY kg DESC, reps DESC) AS rank,
              MAX(done_at) OVER (PARTITION BY session_id) AS last_at
       FROM set_log WHERE exercise_id = ?)
     WHERE rank = 1
     ORDER BY last_at DESC
     LIMIT ?`,
    exerciseId,
    limit,
  );
  return rows
    .map((r) => ({ sessionId: r.session_id, kg: r.kg, reps: r.reps, doneAt: r.done_at }))
    .reverse();
}

// Heaviest weight from the last session per exercise, for Today's list.
export async function lastTopKg(
  db: SQLiteDatabase,
  exerciseIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const id of exerciseIds) {
    const sets = await lastSets(db, id);
    if (sets.length) result.set(id, Math.max(...sets.map((s) => s.kg)));
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
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    'SELECT DISTINCT exercise_id FROM set_log WHERE session_id = ?',
    sessionId,
  );
  const bests: string[] = [];
  for (const { exercise_id } of rows) {
    const mine = await db.getFirstAsync<Lift>(
      'SELECT kg, reps FROM set_log WHERE session_id = ? AND exercise_id = ? ORDER BY kg DESC, reps DESC LIMIT 1',
      sessionId,
      exercise_id,
    );
    const before = await db.getFirstAsync<Lift>(
      `SELECT p.kg, p.reps FROM set_log p JOIN session ps ON ps.id = p.session_id
       WHERE p.exercise_id = ? AND ps.started_at < (SELECT started_at FROM session WHERE id = ?)
       ORDER BY p.kg DESC, p.reps DESC LIMIT 1`,
      exercise_id,
      sessionId,
    );
    if (mine && before && beats(mine, before)) bests.push(exercise_id);
  }
  return bests;
}
