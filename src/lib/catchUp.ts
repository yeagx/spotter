import type { SplitDay } from '@/db/plan';
import type { Weekday } from '@/db/types';
import { WEEK, today } from '@/lib/week';

// A planned day that slipped by can still be done later in the same week. The plan
// never shifts: the day keeps its weekday, it's just still open until the week ends.
//
// Only one day is ever offered (the most recent one), so a few skipped days never pile
// up into a backlog. A new week starts clean. Shared by Today and its widget, so both
// always offer the same day.

// The most recent planned day before today, this week, that hasn't been trained.
// `training` is the split's days that are pinned to a weekday.
export function stillOpenDay(
  training: SplitDay[],
  doneThisWeek: Set<string>,
  weekday: Weekday = today(),
): SplitDay | null {
  for (let i = WEEK.indexOf(weekday) - 1; i >= 0; i--) {
    const day = training.find((d) => d.weekday === WEEK[i]);
    if (day && day.exercises.length > 0 && !doneThisWeek.has(day.id)) return day;
  }
  return null;
}

// A day from earlier this week that was made up today, for showing it as done.
export function caughtUpToday(training: SplitDay[], doneToday: Set<string>, weekday: Weekday = today()): SplitDay | null {
  const before = WEEK.slice(0, WEEK.indexOf(weekday));
  return training.find((d) => d.weekday !== null && before.includes(d.weekday) && doneToday.has(d.id)) ?? null;
}
