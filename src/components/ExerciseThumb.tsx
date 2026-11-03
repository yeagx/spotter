import { Image, StyleSheet, View } from 'react-native';

import { exerciseFrames } from '@/db/exerciseFrames';
import type { ExerciseMedia } from '@/db/types';
import { colors, radius, size } from '@/theme';

// Small still of an exercise: the first demo frame. Exercises with no frames
// (custom ones, or a future video) show an empty tile.
export function ExerciseThumb({ media }: { media: ExerciseMedia | null }) {
  const frame = media?.type === 'frames' ? exerciseFrames[media.key]?.[0] : undefined;
  return (
    <View style={styles.tile}>
      {frame !== undefined && <Image source={frame} style={styles.image} resizeMode="cover" />}
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
  },
  image: { width: '100%', height: '100%' },
});
