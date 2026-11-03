import type { Weekday } from '@/db/types';

// Display order of the week. Starts on Saturday, as in the mockups; change it here only.
export const WEEK: Weekday[] = [6, 7, 1, 2, 3, 4, 5];

const NAMES: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const weekdayName = (d: Weekday) => NAMES[d];
export const weekdayShort = (d: Weekday) => NAMES[d].slice(0, 3).toUpperCase();
export const weekdayLetter = (d: Weekday) => NAMES[d][0];

export function today(): Weekday {
  const js = new Date().getDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

// Sorts weekdays into display order, which is also their split_day position.
export const inWeekOrder = (days: Iterable<Weekday>) => {
  const set = new Set(days);
  return WEEK.filter((d) => set.has(d));
};
