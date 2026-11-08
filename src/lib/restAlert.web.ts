// Web preview stand-in: a browser tab has no lock screen to reach, so rest alerts are
// quiet no-ops there. The phone version is restAlert.ts.
import type { RestAlert } from '@/db/profile';

export const prepareRestAlerts = async () => false;
export const scheduleRestEnd = async (_at: number, _mode: RestAlert, _body: string) => {};
export const cancelRestEnd = async () => {};
export const playRestDone = (_mode: RestAlert) => {};
export const restAlertsAllowed = async () => true;
