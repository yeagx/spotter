// Bringing a scale's reading in from the phone's health store. This file is the stand-in
// for the web preview; the phone versions are healthImport.android.ts (Health Connect)
// and healthImport.ios.ts (Apple Health), and all three export the same things.
import type { HealthResult } from './healthShared';

export { HEALTH_PROBLEMS } from './healthShared';
export type { HealthProblem, HealthReading, HealthResult } from './healthShared';

// Whether to offer the import at all.
export const healthImportAvailable = false;
export const healthSourceName = 'Health Connect';

export async function readLatestBody(): Promise<HealthResult> {
  return { problem: 'unavailable' };
}
