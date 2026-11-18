import { useEffect, useState, type ReactNode } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { formatClock } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { mediaControl, openPlayer, positionNow, useNowPlaying, type MediaAction } from '@/lib/media';
import { rise, settle } from '@/lib/motion';
import { colors, radius, size, space, type } from '@/theme';

// Whatever's playing in another app (Spotify, YouTube Music, YouTube…), as a slim strip
// above the workout's button: cover, title, play/pause. Tap it for the track's progress,
// previous / next, and a way into the player. Shows only once Notification access is on
// and something is playing; hides while the keyboard is up so it never crowds a set row.
export function NowPlayingStrip() {
  const { nowPlaying: np, access } = useNowPlaying();
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // The progress bar only runs while it's on screen and the track is moving.
  const ticking = open && Boolean(np?.playing) && (np?.durationMs ?? 0) > 0;
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking]);

  if (!access || !np || keyboard) return null;

  const act = (action: MediaAction) => {
    haptic.select();
    mediaControl(action);
  };
  const position = positionNow(np, now);
  const progress = np.durationMs > 0 ? position / np.durationMs : 0;
  const sub = [np.artist, np.appName].filter(Boolean).join(' · ');

  return (
    <Animated.View entering={rise()} layout={settle} style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${np.title}${np.artist ? `, ${np.artist}` : ''}`}
          accessibilityHint={open ? 'Hides the music controls' : 'Shows more music controls'}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            haptic.select();
            setOpen((v) => !v);
          }}
          style={styles.info}
        >
          {np.artwork ? (
            <Image source={{ uri: np.artwork }} style={styles.art} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.art, styles.artEmpty]} />
          )}
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {np.title}
            </Text>
            {sub !== '' && (
              <Text style={styles.sub} numberOfLines={1}>
                {sub}
              </Text>
            )}
          </View>
        </Pressable>
        {!open && <PlayPause playing={np.playing} onPress={() => act('toggle')} />}
      </View>

      {open && (
        <Animated.View entering={FadeIn.duration(320)} exiting={FadeOut.duration(200)} style={styles.more}>
          {np.durationMs > 0 && (
            <View style={styles.progress}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(progress * 1000) / 10}%` }]} />
              </View>
              <View style={styles.times}>
                <Text style={styles.time}>{formatClock(position)}</Text>
                <Text style={styles.time}>{formatClock(np.durationMs)}</Text>
              </View>
            </View>
          )}
          <View style={styles.controls}>
            <ControlButton label="Previous" disabled={!np.canPrevious} onPress={() => act('previous')}>
              <PreviousIcon color={colors.ink} size={size.icon} />
            </ControlButton>
            <PlayPause playing={np.playing} onPress={() => act('toggle')} big />
            <ControlButton label="Next" disabled={!np.canNext} onPress={() => act('next')}>
              <NextIcon color={colors.ink} size={size.icon} />
            </ControlButton>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic.select();
              openPlayer();
            }}
            style={styles.openApp}
          >
            <Text style={styles.openAppLabel}>Open {np.appName || 'player'}</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function PlayPause({ playing, onPress, big }: { playing: boolean; onPress: () => void; big?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
      onPress={onPress}
      haptic={null}
      style={[styles.button, big && styles.buttonBig]}
    >
      {playing ? (
        <PauseIcon color={colors.ink} size={size.icon} />
      ) : (
        <PlayIcon color={colors.ink} size={size.icon} />
      )}
    </PressableScale>
  );
}

function ControlButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      haptic={null}
      style={[styles.button, disabled && styles.disabled]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: space[2],
    paddingLeft: space[2],
    paddingRight: space[1],
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: size.tapTarget },
  art: { width: size.tapTarget, height: size.tapTarget, borderRadius: radius.sm },
  artEmpty: { backgroundColor: colors.surfaceRaised },
  text: { flex: 1 },
  title: { ...type.captionStrong, color: colors.ink },
  sub: { ...type.caption, color: colors.inkMuted },
  button: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: size.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBig: { width: size.buttonPrimary, height: size.buttonPrimary, borderRadius: size.buttonPrimary / 2, backgroundColor: colors.surfaceRaised },
  disabled: { opacity: 0.35 },
  more: { gap: space[3], paddingTop: space[3], paddingRight: space[1] },
  progress: { gap: space[1] },
  track: { height: size.divider * 3, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.ink },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...type.numeralCaption, color: colors.inkMuted },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[6] },
  openApp: { minHeight: size.tapTarget, alignItems: 'center', justifyContent: 'center' },
  openAppLabel: { ...type.captionStrong, color: colors.ink },
});
