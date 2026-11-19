import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { showDialog } from '@/components/DialogHost';
import { ChevronDownIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { SlantBar } from '@/components/Slant';
import { haptic } from '@/lib/haptics';
import { getMeta, setMeta } from '@/db/meta';
import {
  WAVES_ASK,
  allowLevels,
  canHearLevels,
  levelsSupported,
  listenToLevels,
  mediaSupported,
  musicSource,
  useMusic,
  type MediaAction,
} from '@/lib/media';
import { easeOut, rise } from '@/lib/motion';
import { useProfile } from '@/state/profile';
import { colors, motion, radius, size, space, type } from '@/theme';

// Music controls above the workout's button: whatever app is playing (Spotify, YouTube,
// any player) takes play/pause, previous and next, like a headset's buttons; on iPhone,
// Apple Music, the one player iOS lets another app control. Slim by
// default; tap it to open the full controls. It appears once music has played since
// Spotter opened, can be turned off in Profile, and hides while the keyboard is up so it
// never crowds a set row.
export function NowPlayingStrip() {
  const { profile } = useProfile();
  const { playing, heard, press } = useMusic();
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const reduceMotion = useReducedMotion();
  const db = useSQLiteContext();
  const [canHear, setCanHear] = useState(canHearLevels);

  // Android: the first time the player is opened, offer waves that follow the music
  // (they need the Record audio permission, so it's asked, once, with the reason).
  const offerWaves = async () => {
    if (!levelsSupported || canHear) return;
    if (await getMeta(db, WAVES_ASKED).catch(() => '1')) return;
    await setMeta(db, WAVES_ASKED, '1').catch(() => {});
    const i = await showDialog({ ...WAVES_ASK, actions: [{ label: 'Not now', kind: 'neutral' }, { label: 'Allow', kind: 'primary' }] });
    if (i === 1) setCanHear(await allowLevels());
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // 0 closed, 1 open. The panel's height follows it, so the footer grows and shrinks in
  // one slow ease-out instead of jumping.
  const progress = useSharedValue(0);
  const [panelH, setPanelH] = useState(0);
  useEffect(() => {
    progress.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: motion.expandMs, easing: easeOut });
  }, [open, progress, reduceMotion]);

  const panel = useAnimatedStyle(() => ({
    height: panelH * progress.value,
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.2, 1]),
  }));
  const small = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 - 0.2 * progress.value }],
  }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * progress.value}deg` }] }));

  if (!mediaSupported || !profile?.musicControls || !heard || keyboard) return null;

  const act = (action: MediaAction) => {
    haptic.select();
    press(action);
  };

  return (
    <Animated.View entering={rise()} style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${musicSource}, ${playing ? 'playing' : 'paused'}`}
          accessibilityHint={open ? 'Hides the music controls' : 'Shows previous and next'}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            haptic.select();
            if (!open) offerWaves();
            setOpen((v) => !v);
          }}
          style={styles.info}
        >
          <Equalizer playing={playing} live={canHear} />
          <View style={styles.text}>
            <Text style={styles.title}>{musicSource}</Text>
            <Text style={styles.sub}>{playing ? 'Playing' : 'Paused'}</Text>
          </View>
          <Animated.View style={chevron}>
            <ChevronDownIcon color={colors.inkMuted} size={size.iconSm} />
          </Animated.View>
        </Pressable>
        <Animated.View style={small} pointerEvents={open ? 'none' : 'auto'}>
          <PlayPause playing={playing} onPress={() => act('toggle')} />
        </Animated.View>
      </View>

      {/* Laid out once at full size (absolute), measured, then revealed by height. */}
      <Animated.View style={[styles.panelClip, panel]} pointerEvents={open ? 'auto' : 'none'}>
        <View onLayout={(e) => setPanelH(e.nativeEvent.layout.height)} style={styles.panel}>
          <View style={styles.controls}>
            <ControlButton label="Previous" onPress={() => act('previous')}>
              <PreviousIcon color={colors.ink} size={size.icon} />
            </ControlButton>
            <PlayPause playing={playing} onPress={() => act('toggle')} big />
            <ControlButton label="Next" onPress={() => act('next')}>
              <NextIcon color={colors.ink} size={size.icon} />
            </ControlButton>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// Asked once, the first time the player is opened (meta key).
const WAVES_ASKED = 'waves_asked';

// Three slanted bars, the logo's cut. With live waves (Android, allowed), they follow the
// song: bass, mids and treble, as loud as they are right now. Otherwise they rise and fall
// in a loop while music plays. Low when paused; still with reduce-motion on.
const EQ_MS = [520, 680, 440];
const LEVEL_MS = 90; // each new reading eases in over about two readings' time

function Equalizer({ playing, live }: { playing: boolean; live: boolean }) {
  const reduceMotion = useReducedMotion();
  const a = useSharedValue(0.35);
  const b = useSharedValue(0.35);
  const c = useSharedValue(0.35);
  const bars = [a, b, c];
  const [hearing, setHearing] = useState(false);

  useEffect(() => {
    if (!playing || !live || reduceMotion) return;
    const stop = listenToLevels((levels) => {
      levels.forEach((x, i) => {
        if (bars[i]) bars[i].value = withTiming(0.2 + 0.8 * x, { duration: LEVEL_MS, easing: Easing.out(Easing.quad) });
      });
    });
    if (!stop) return;
    bars.forEach((v) => cancelAnimation(v));
    setHearing(true);
    return () => {
      stop();
      setHearing(false);
    };
  }, [playing, live, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hearing) return;
    bars.forEach((v, i) => {
      cancelAnimation(v);
      if (!playing || reduceMotion) {
        v.value = withTiming(playing ? 0.7 : 0.35, { duration: motion.selectMs });
        return;
      }
      const ms = EQ_MS[i];
      const ease = Easing.inOut(Easing.quad);
      v.value = withDelay(
        i * 90,
        withRepeat(withSequence(withTiming(1, { duration: ms, easing: ease }), withTiming(0.3, { duration: ms, easing: ease })), -1),
      );
    });
  }, [playing, reduceMotion, hearing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.eq} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map((v, i) => (
        <EqBar key={i} value={v} color={playing ? colors.ink : colors.inkFaint} />
      ))}
    </View>
  );
}

function EqBar({ value, color }: { value: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: value.value }] }));
  return (
    <Animated.View style={[styles.eqBar, style]}>
      <SlantBar width={size.cueMarkWidth} height={size.cueMarkHeight * 1.5} color={color} />
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
      {playing ? <PauseIcon color={colors.ink} size={size.icon} /> : <PlayIcon color={colors.ink} size={size.icon} />}
    </PressableScale>
  );
}

function ControlButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} haptic={null} style={styles.button}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: space[1],
    paddingLeft: space[3],
    paddingRight: space[1],
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: size.tapTarget },
  eq: {
    width: size.tapTarget * 0.6,
    height: size.cueMarkHeight * 1.5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[1] / 2,
  },
  // Grows from its foot, like a level meter.
  eqBar: { transformOrigin: 'bottom' },
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
  buttonBig: {
    width: size.buttonPrimary,
    height: size.buttonPrimary,
    borderRadius: size.buttonPrimary / 2,
    backgroundColor: colors.surfaceRaised,
  },
  panelClip: { overflow: 'hidden' },
  panel: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: space[2], paddingBottom: space[2] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8] },
});
