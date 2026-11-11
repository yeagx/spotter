// Bringing a scale's reading in from Health Connect. This file is the stand-in for iOS
// and the web preview, where there's no Health Connect; the Android version is
// healthImport.android.ts and both must export the same things.
import type { HealthResult } from './healthShared';

export { HEALTH_PROBLEMS } from './healthShared';
export type { HealthProblem, HealthReading, HealthResult } from './healthShared';

// Whether to offer the import at all.
export const healthImportAvailable = false;

export async function readLatestBody(): Promise<HealthResult> {
  return { problem: 'unavailable' };
}
