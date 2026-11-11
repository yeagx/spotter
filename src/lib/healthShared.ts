// What both versions of healthImport share: the shape of a reading and the notices.
// It lives in its own file on purpose. On Android, './healthImport' resolves to
// healthImport.android.ts, so that file can't import these from './healthImport'
// without importing itself.

export type HealthReading = {
  date: string; // local calendar day of the weigh-in, YYYY-MM-DD
  weight: number; // kg
  fat: number | null; // %
  water: number | null; // %
  bone: number | null; // kg
  bmr: number | null; // kcal a day
};

export type HealthProblem = 'unavailable' | 'needs-update' | 'denied' | 'empty' | 'failed';

export type HealthResult = { reading: HealthReading } | { problem: HealthProblem };

export const HEALTH_PROBLEMS: Record<HealthProblem, [title: string, message: string]> = {
  unavailable: [
    'No Health Connect here',
    'It comes with Android 14 and up. On older phones, get Health Connect from the Play Store.',
  ],
  'needs-update': ['Update Health Connect', 'Update it from the Play Store, then try again.'],
  denied: ['No access yet', 'Allow Spotter to read your weight in Health Connect, then try again.'],
  empty: [
    'Nothing to bring in',
    'Health Connect has no weight from the last 90 days. Check that your scale’s app shares with it.',
  ],
  failed: ['Couldn’t read it', 'Something went wrong reading Health Connect. Try again.'],
};
