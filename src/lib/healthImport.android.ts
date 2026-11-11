// Android: reads the latest weigh-in from Health Connect, where smart-scale apps put
// their readings. Read-only, and only when the user taps the button on Check in:
// nothing is synced in the background and nothing is written back.
import type { Permission, RecordType } from 'react-native-health-connect';

import { localDate } from '@/lib/dates';

import type { HealthResult } from './healthShared';

export { HEALTH_PROBLEMS } from './healthShared';
export type { HealthProblem, HealthReading, HealthResult } from './healthShared';

export const healthImportAvailable = true;

const DAY_MS = 24 * 60 * 60 * 1000;
// How far back to look for a weigh-in. Older than this isn't a check-in for today.
const LOOKBACK_MS = 90 * DAY_MS;

const WANTED = ['Weight', 'BodyFat', 'BodyWaterMass', 'BoneMass', 'BasalMetabolicRate'] as const;

export async function readLatestBody(): Promise<HealthResult> {
  try {
    // Loaded here, not at the top: a build without the native module (Expo Go) then
    // fails this one call instead of the whole check-in screen.
    const hc = await import('react-native-health-connect');

    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return { problem: 'needs-update' };
    }
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return { problem: 'unavailable' };
    if (!(await hc.initialize())) return { problem: 'unavailable' };

    const asked: Permission[] = WANTED.map((recordType) => ({ accessType: 'read', recordType }));
    const granted = await hc.requestPermission(asked);
    const can = (type: RecordType) =>
      granted.some((p) => 'recordType' in p && p.recordType === type && p.accessType === 'read');
    if (!can('Weight')) return { problem: 'denied' };

    const now = Date.now();
    const weights = await hc.readRecords('Weight', {
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(now - LOOKBACK_MS).toISOString(),
        endTime: new Date(now).toISOString(),
      },
      ascendingOrder: false,
      pageSize: 1,
    });
    const latest = weights.records[0];
    if (!latest) return { problem: 'empty' };

    const at = new Date(latest.time);
    const weight = latest.weight.inKilograms;

    // The rest of the scan, if the scale sent it: the latest reading from the same day.
    const dayStart = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
    const sameDay = {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime: new Date(dayStart).toISOString(),
        endTime: new Date(dayStart + DAY_MS).toISOString(),
      },
      ascendingOrder: false,
      pageSize: 1,
    };
    // Each extra is optional, so one that fails or was refused just stays empty.
    const first = async <T extends RecordType, V>(
      type: T,
      pick: (record: Awaited<ReturnType<typeof hc.readRecords<T>>>['records'][number]) => V,
    ): Promise<V | null> => {
      if (!can(type)) return null;
      try {
        const { records } = await hc.readRecords(type, sameDay);
        return records[0] ? pick(records[0]) : null;
      } catch {
        return null;
      }
    };

    const fat = await first('BodyFat', (r) => r.percentage);
    const waterKg = await first('BodyWaterMass', (r) => r.mass.inKilograms);
    const bone = await first('BoneMass', (r) => r.mass.inKilograms);
    const bmr = await first('BasalMetabolicRate', (r) => r.basalMetabolicRate.inKilocaloriesPerDay);

    return {
      reading: {
        date: localDate(at),
        weight,
        fat,
        // Health Connect stores water as a mass; the check-in wants it as a share of weight.
        water: waterKg !== null && weight > 0 ? (waterKg / weight) * 100 : null,
        bone,
        bmr: bmr !== null ? Math.round(bmr) : null,
      },
    };
  } catch (e) {
    if (__DEV__) console.warn('Health Connect read failed', e);
    return { problem: 'failed' };
  }
}
