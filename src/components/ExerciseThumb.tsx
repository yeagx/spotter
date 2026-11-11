import { Image, StyleSheet, View } from 'react-native';

import { PlayIcon } from '@/components/Icons';
import { exerciseFrames } from '@/db/exerciseFrames';
import type { ExerciseMedia } from '@/db/types';
import { mediaUri } from '@/lib/exerciseMedia';
import { colors, radius, size } from '@/theme';

// Small still of an exercise: the first demo frame, or the photo the user attached.
// A clip shows a play mark (pulling a frame out of it isn't worth the work at this size);
// an exercise with nothing shows an empty tile.
export function ExerciseThumb({ media }: { media: ExerciseMedia | null }) {
  const frame = media?.type === 'frames' ? exerciseFrames[media.key]?.[0] : undefined;
  const photo = media?.type === 'file' && media.kind === 'image' ? mediaUri(media) : undefined;
  const clip = media?.type === 'video' || (media?.type === 'file' && media.kind === 'video');
  return (
    <View style={styles.tile}>
      {frame !== undefined ? (
        <Image source={frame} style={styles.image} resizeMode="cover" />
      ) : photo ? (
        <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
      ) : clip ? (
        <PlayIcon />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: size.thumb,
    height: size.thumb,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
});
