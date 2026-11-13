// Each entry upgrades the database by one version (index 0 takes it from 0 to 1).
// Never edit a migration that has shipped; append a new one instead.
//
// Conventions, so v2 sync can be added without losing data:
// - ids are stable strings (slugs for the library, UUIDs for user rows), never autoincrement.
// - every row has created_at / updated_at in epoch milliseconds.
// - weights are stored in kg; `profile.units` only changes how they are shown.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE profile (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    photo_uri TEXT,
    goal TEXT NOT NULL CHECK (goal IN ('lean', 'healthy')),
    units TEXT NOT NULL DEFAULT 'kg' CHECK (units IN ('kg', 'lb')),
    target_kg REAL,
    target_fat REAL,
    calorie_mode TEXT NOT NULL DEFAULT 'estimate' CHECK (calorie_mode IN ('estimate', 'custom')),
    calorie_target INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE split (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- weekday: 1 = Monday ... 7 = Sunday, null when the day isn't pinned to one.
  CREATE TABLE split_day (
    id TEXT PRIMARY KEY NOT NULL,
    split_id TEXT NOT NULL REFERENCES split (id) ON DELETE CASCADE,
    weekday INTEGER CHECK (weekday BETWEEN 1 AND 7),
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX split_day_split ON split_day (split_id, position);

  CREATE TABLE exercise (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    muscle TEXT NOT NULL,
    equipment TEXT NOT NULL,
    cues_json TEXT NOT NULL DEFAULT '[]',
    media_json TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX exercise_muscle ON exercise (muscle, name);

  CREATE TABLE day_exercise (
    id TEXT PRIMARY KEY NOT NULL,
    split_day_id TEXT NOT NULL REFERENCES split_day (id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercise (id),
    sets INTEGER NOT NULL CHECK (sets > 0),
    reps_min INTEGER NOT NULL CHECK (reps_min > 0),
    reps_max INTEGER NOT NULL CHECK (reps_max >= reps_min),
    rest_sec INTEGER NOT NULL CHECK (rest_sec >= 0),
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX day_exercise_day ON day_exercise (split_day_id, position);

  -- Deleting a plan day must never delete history, so sessions only lose the link.
  CREATE TABLE session (
    id TEXT PRIMARY KEY NOT NULL,
    split_day_id TEXT REFERENCES split_day (id) ON DELETE SET NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX session_started ON session (started_at);

  CREATE TABLE set_log (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercise (id),
    set_index INTEGER NOT NULL,
    kg REAL NOT NULL,
    reps INTEGER NOT NULL,
    done_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  -- Serves "pre-fill from last session" and best-lift lookups.
  CREATE INDEX set_log_exercise ON set_log (exercise_id, done_at);
  CREATE INDEX set_log_session ON set_log (session_id, set_index);

  -- date is the local calendar day, YYYY-MM-DD.
  CREATE TABLE checkin (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    bmi REAL,
    fat REAL,
    muscle REAL,
    water REAL,
    bone REAL,
    bmr INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX checkin_date ON checkin (date);
  `,
  // 2: sex, so body stats are compared with the right normal ranges. Nullable: profiles
  // created before this ask for it in Profile.
  `
  ALTER TABLE profile ADD COLUMN sex TEXT CHECK (sex IN ('male', 'female'));
  `,
  // 3: rest timer settings, and how many sets each exercise has in a session once the
  // user adds or removes one (so a resumed session keeps them).
  // rest_sets_sec null = each exercise's own rest from the plan.
  // rest_exercises_sec null = same as between sets.
  `
  ALTER TABLE profile ADD COLUMN rest_sets_sec INTEGER CHECK (rest_sets_sec >= 0);
  ALTER TABLE profile ADD COLUMN rest_exercises_sec INTEGER CHECK (rest_exercises_sec >= 0);
  ALTER TABLE profile ADD COLUMN rest_alert TEXT NOT NULL DEFAULT 'sound'
    CHECK (rest_alert IN ('sound', 'vibrate', 'off'));

  CREATE TABLE session_sets (
    session_id TEXT NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    day_exercise_id TEXT NOT NULL,
    sets INTEGER NOT NULL CHECK (sets > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, day_exercise_id)
  );
  `,
  // 4: what each exercise works, in detail (seeded with the library). Null for custom
  // exercises, which only know their muscle group.
  `
  ALTER TABLE exercise ADD COLUMN targets_json TEXT;
  `,
  // 5: a note kept with each exercise ("seat 4, narrow grip"), and exercises swapped for
  // one session only (the machine was taken), so a resumed session keeps the swap.
  // The library seed never writes `note`, so it survives library updates.
  `
  ALTER TABLE exercise ADD COLUMN note TEXT;

  CREATE TABLE session_swap (
    session_id TEXT NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    day_exercise_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL REFERENCES exercise (id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, day_exercise_id)
  );
  `,
  // 6: exercises that aren't kg × reps (a treadmill, a plank), and the order of a
  // session's exercises once the user moves them around.
  // - exercise.tracking: see Tracking in types.ts. The library seed fills it in for
  //   library rows; custom cardio exercises made before this become cardio.
  // - set_log keeps kg and reps (0 when not used) and adds time and distance.
  // - day_exercise.target_sec_*: the planned time for time and cardio exercises,
  //   null until set (screens show a default).
  // - A treadmill planned as 3 × 8–12 reps meant nothing; it becomes one block of time.
  `
  ALTER TABLE exercise ADD COLUMN tracking TEXT NOT NULL DEFAULT 'weight'
    CHECK (tracking IN ('weight', 'reps', 'time', 'cardio'));
  UPDATE exercise SET tracking = 'cardio' WHERE is_custom = 1 AND muscle = 'cardio';

  ALTER TABLE set_log ADD COLUMN duration_sec INTEGER CHECK (duration_sec >= 0);
  ALTER TABLE set_log ADD COLUMN distance_m REAL CHECK (distance_m >= 0);

  ALTER TABLE day_exercise ADD COLUMN target_sec_min INTEGER CHECK (target_sec_min > 0);
  ALTER TABLE day_exercise ADD COLUMN target_sec_max INTEGER CHECK (target_sec_max > 0);
  UPDATE day_exercise SET sets = 1
    WHERE exercise_id IN (SELECT id FROM exercise WHERE muscle = 'cardio');

  CREATE TABLE session_order (
    session_id TEXT NOT NULL REFERENCES session (id) ON DELETE CASCADE,
    day_exercise_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, day_exercise_id)
  );
  `,
];
