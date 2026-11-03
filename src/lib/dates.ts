import { WEEK, today } from '@/lib/week';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

// Local calendar day as stored in checkin.date.
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// "12 Oct"
export const formatDay = (s: string) => {
  const d = parseLocalDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Start of the current display week (it starts on WEEK[0]).
export const startOfWeek = () => {
  const now = new Date();
  const back = WEEK.indexOf(today());
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back).getTime();
};

// Months are keyed "YYYY-MM".
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const previousMonthKey = (d = new Date()) =>
  monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1));

export function monthRange(key: string) {
  const [y, m] = key.split('-').map(Number);
  return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() };
}

export const monthName = (key: string) => MONTHS[Number(key.split('-')[1]) - 1];

export const isMonthKey = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// "12:40", or "1:02:40" past an hour.
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
