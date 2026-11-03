import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { LoopIcon } from '@/components/Icons';
import { exerciseFrames } from '@/db/exerciseFrames';
import { exerciseVideos } from '@/db/exerciseVideos';
import type { ExerciseMedia } from '@/db/types';
import { colors, motion, radius, space, type } from '@/theme';

type Props = {
  media: ExerciseMedia | null;
  slow?: boolean; // half speed
  // The pill in the corner shows LOOPING / PAUSED; Exercise adds a speed pill.
  extraPill?: string | null;
};

// Silent demo loop. Source-agnostic: today it alternates the start and end photos,
// later a filmed clip (`media.type === 'video'`) drops in with no change to any screen.
// Tap to pause. Starts paused when the phone asks for reduced motion.
export function DemoPlayer({ media, slow = false, extraPill }: Props) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(!reduceMotion);

  const frames = media?.type === 'frames' ? exerciseFrames[media.key] : undefined;
  const video = media?.type === 'video' ? exerciseVideos[media.key] : undefined;
  const hasDemo = Boolean(frames?.length || video);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasDemo ? (playing ? 'Pause the demo loop' : 'Play the demo loop') : 'No demo'}
      disabled={!hasDemo}
      onPress={() => setPlaying((p) => !p)}
      style={styles.frame}
    >
      {frames?.length ? (
        <Frames frames={frames} playing={playing} slow={slow} />
      ) : video !== undefined ? (
        <Clip source={video} playing={playing} slow={slow} />
      ) : (
        <View style={styles.empty}>
          <LoopIcon />
          <Text style={styles.emptyText}>No demo for custom exercises</Text>
        </View>
      )}

      {hasDemo && (
        <View style={styles.pills} pointerEvents="none">
          <Pill text={playing ? 'Looping' : 'Paused'} live={playing} />
          {extraPill ? <Pill text={extraPill} live /> : null}
        </View>
      )}
    </Pressable>
  );
}

function Pill({ text, live }: { text: string; live: boolean }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.pillText, live && styles.pillLive]}>{text}</Text>
    </View>
  );
}

function Frames({ frames, playing, slow }: { frames: number[]; playing: boolean; slow: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      motion.frameMs * (slow ? 2 : 1),
    );
    return () => clearInterval(id);
  }, [playing, slow, frames.length]);

  // All frames stay mounted so swapping never flashes while an image decodes.
  return (
    <>
      {frames.map((src, i) => (
        <Image
          key={i}
          source={src}
          resizeMode="contain"
          style={[StyleSheet.absoluteFill, styles.image, { opacity: i === index ? 1 : 0 }]}
        />
      ))}
    </>
  );
}

function Clip({ source, playing, slow }: { source: number; playing: boolean; slow: boolean }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true; // no sound, ever
  });

  useEffect(() => {
    player.playbackRate = slow ? 0.5 : 1;
    if (playing) player.play();
    else player.pause();
  }, [player, playing, slow]);

  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={StyleSheet.absoluteFill}
    />
  );
}

const styles = StyleSheet.create({
  // The demo photos are 3:2; the frame matches so nothing is cropped or letterboxed.
  frame: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2] },
  emptyText: { ...type.caption, color: colors.inkMuted },
  pills: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    bottom: space[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    backgroundColor: colors.ground,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  pillText: { ...type.labelWide, color: colors.inkMuted },
  pillLive: { color: colors.redText },
});
