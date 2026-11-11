import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import type { ExerciseMedia } from '@/db/types';

// A photo, GIF or short clip the user attaches to their own exercise. The picked file is
// copied into the app's documents folder (the picker's copy lives in a cache the system
// may clear) and the exercise stores only its file name.

export type FileMedia = Extract<ExerciseMedia, { type: 'file' }>;

// A demo is a few seconds on a loop, not a film. Past these the app would carry dead weight.
export const MAX_CLIP_SECONDS = 60;
const MAX_BYTES = 80 * 1024 * 1024;

const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', '3gp', 'mkv'];

export type PickResult =
  | { media: FileMedia }
  | { problem: 'too-long' | 'too-big' | 'failed' }
  | null; // cancelled

export async function pickExerciseMedia(): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    // No cropping and full quality, so the file is copied as it is: an edited or
    // recompressed GIF comes back as a single still frame.
    allowsEditing: false,
    quality: 1,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const ext = asset.uri.match(/\.(\w{2,5})$/)?.[1]?.toLowerCase() ?? '';
  const isVideo =
    asset.type === 'video' || asset.mimeType?.startsWith('video/') === true || VIDEO_EXT.includes(ext);
  if (isVideo && asset.duration && asset.duration > MAX_CLIP_SECONDS * 1000) return { problem: 'too-long' };

  try {
    const source = new File(asset.uri);
    const bytes = asset.fileSize ?? source.size ?? 0;
    if (bytes > MAX_BYTES) return { problem: 'too-big' };

    const name = `exercise-${randomUUID()}.${ext || (isVideo ? 'mp4' : 'jpg')}`;
    await source.copy(new File(Paths.document, name));
    return { media: { type: 'file', kind: isVideo ? 'video' : 'image', name } };
  } catch {
    return { problem: 'failed' };
  }
}

export const PICK_PROBLEMS: Record<'too-long' | 'too-big' | 'failed', [title: string, message: string]> = {
  'too-long': ['Too long', `Pick a clip under ${MAX_CLIP_SECONDS} seconds. A few reps is enough.`],
  'too-big': ['Too big', 'That file is very large. Pick a shorter clip or a smaller photo.'],
  failed: ['Couldn’t add that', 'Something went wrong copying the file. Try another one.'],
};

// Where an attached file lives right now.
export const mediaUri = (media: FileMedia) => new File(Paths.document, media.name).uri;

// Removes an attached file once it's been replaced or cleared. Never throws: a stale file
// left behind is harmless.
export function removeExerciseMedia(media: ExerciseMedia | null) {
  if (media?.type !== 'file') return;
  try {
    const file = new File(Paths.document, media.name);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
