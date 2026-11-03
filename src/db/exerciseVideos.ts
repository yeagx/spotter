// Filmed demo clips (silent MP4 loops), keyed by ExerciseMedia.key. Empty until the
// first clips are shot. To swap an exercise from photos to video:
//   1. add `'barbell-bench-press': require('../../assets/videos/barbell-bench-press.mp4'),`
//   2. bump LIBRARY_VERSION in library.ts; the seed then switches that exercise's
//      media to { type: 'video' } (see init.ts).
// Metro needs every require() to be a literal path.
export const exerciseVideos: Record<string, number> = {};
