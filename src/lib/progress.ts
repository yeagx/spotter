import { POSES, type Pose, type ProgressPhoto } from '@/db/checkins';

// Progress photos grouped by pose, each oldest first.
export function byPose(photos: ProgressPhoto[]): Record<Pose, ProgressPhoto[]> {
  const groups = { front: [], side: [], back: [] } as Record<Pose, ProgressPhoto[]>;
  for (const p of photos) groups[p.pose].push(p);
  return groups;
}

// The pose to show first: the one with the most photos, front on a tie.
export function mainPose(groups: Record<Pose, ProgressPhoto[]>): Pose | null {
  let best: Pose | null = null;
  for (const pose of POSES) {
    if (groups[pose].length > (best ? groups[best].length : 0)) best = pose;
  }
  return best;
}

// The month's change in one pair: the latest photo taken in the month, next to the last
// one before it began (or the month's first, if it has two). Same pose for both: the
// one the month has most of. Null when there's nothing to put side by side.
export function monthPair(photos: ProgressPhoto[], month: string): { before: ProgressPhoto; after: ProgressPhoto } | null {
  const inMonth = (p: ProgressPhoto) => p.date.startsWith(`${month}-`);
  const pose = mainPose(byPose(photos.filter(inMonth)));
  if (!pose) return null;
  const list = photos.filter((p) => p.pose === pose);
  const thisMonth = list.filter(inMonth);
  const after = thisMonth[thisMonth.length - 1];
  const earlier = list.filter((p) => p.date < `${month}-01`);
  const before = earlier[earlier.length - 1] ?? (thisMonth.length >= 2 ? thisMonth[0] : undefined);
  return before ? { before, after } : null;
}
