// iPhone: reads the latest weigh-in from Apple Health, where smart-scale apps put their
// readings. The same as Health Connect on Android (healthImport.android.ts): read-only,
// only when the user taps the button on Check in, nothing synced or written back.
//
// Apple Health keeps weight, body fat and the energy burned at rest; it has no body water
// or bone mass, so those stay for the user to type in. Apple never tells an app whether
// it was refused read access (that would itself say something about your health), so a
// refusal looks the same as an empty Health: the "empty" notice covers both.
import { localDate } from '@/lib/dates';

import type { HealthProblem, HealthResult } from './healthShared';

export type { HealthProblem, HealthReading, HealthResult } from './healthShared';

export const healthImportAvailable = true;
export const healthSourceName = 'Apple Health';

export const HEALTH_PROBLEMS: Record<HealthProblem, [title: string, message: string]> = {
  unavailable: ['No Apple Health here', 'Apple Health isn’t on this device.'],
  'needs-update': ['Update iOS', 'Update your iPhone, then try again.'],
  denied: ['No access yet', 'Allow Spotter to read your weight: Settings → Health → Data Access & Devices → Spotter.'],
  empty: [
    'Nothing to bring in',
    'No weight from the last 90 days that Spotter can read. Check that your scale’s app writes to Apple Health, and that Spotter may read it: Settings → Health → Data Access & Devices → Spotter.',
  ],
  failed: ['Couldn’t read it', 'Something went wrong reading Apple Health. Try again.'],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 90 * DAY_MS; // older than this isn't a check-in for today

const WEIGHT = 'HKQuantityTypeIdentifierBodyMass';
const FAT = 'HKQuantityTypeIdentifierBodyFatPercentage';
const BASAL = 'HKQuantityTypeIdentifierBasalEnergyBurned';

export async function readLatestBody(): Promise<HealthResult> {
  try {
    // Loaded here, not at the top: a build without the native module then fails this
    // one call instead of the whole check-in screen.
    const hk = await import('@kingstinct/react-native-healthkit');
    if (!hk.isHealthDataAvailable()) return { problem: 'unavailable' };
    await hk.requestAuthorization({ toRead: [WEIGHT, FAT, BASAL] });

    const now = Date.now();
    const [latest] = await hk.queryQuantitySamples(WEIGHT, {
      limit: 1,
      ascending: false,
      unit: 'kg',
      filter: { date: { startDate: new Date(now - LOOKBACK_MS), endDate: new Date(now) } },
    });
    if (!latest) return { problem: 'empty' };

    const at = new Date(latest.startDate);
    const dayStart = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    // Body fat from the same day, if the scale sent it. Apple Health keeps it as a
    // fraction (0.175); the check-in wants a percentage.
    let fat: number | null = null;
    try {
      const [f] = await hk.queryQuantitySamples(FAT, {
        limit: 1,
        ascending: false,
        unit: '%',
        filter: { date: { startDate: dayStart, endDate: dayEnd } },
      });
      if (f) fat = f.quantity <= 1 ? f.quantity * 100 : f.quantity;
    } catch {
      fat = null;
    }

    // BMR: what Health counted as burned at rest over the whole day before the weigh-in
    // (a watch logs it through the day; a partial today would read low).
    let bmr: number | null = null;
    try {
      const stats = await hk.queryStatisticsForQuantity(BASAL, ['cumulativeSum'], {
        unit: 'kcal',
        filter: { date: { startDate: new Date(dayStart.getTime() - DAY_MS), endDate: dayStart } },
      });
      const kcal = stats.sumQuantity?.quantity ?? 0;
      bmr = kcal > 500 ? Math.round(kcal) : null; // less than that isn't a whole day's worth
    } catch {
      bmr = null;
    }

    return {
      reading: { date: localDate(at), weight: latest.quantity, fat, water: null, bone: null, bmr },
    };
  } catch (e) {
    if (__DEV__) console.warn('Apple Health read failed', e);
    return { problem: 'failed' };
  }
}
