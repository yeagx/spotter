import { useEffect, useState } from 'react';

// Long lists (the exercise library is 130+ rows, each with a photo) mount in two steps:
// the first screenful right away, the rest once the screen has finished sliding in.
// Building every row during the slide is what made opening a picker stutter.
const FIRST = 14;
const SETTLE_MS = 450;

// How many rows to render now. Only the first FIRST rows animate in; the rest just appear
// below the fold, where nobody sees them arrive.
export function useSettledList(ready: boolean): number {
  const [limit, setLimit] = useState(FIRST);
  useEffect(() => {
    if (!ready || limit !== FIRST) return;
    const t = setTimeout(() => setLimit(Infinity), SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready, limit]);
  return limit;
}

// Rows past this index never get an entering animation: a hundred keyframes starting at
// once is a dropped frame, and those rows are off screen anyway.
export const ANIMATED_ROWS = 12;
