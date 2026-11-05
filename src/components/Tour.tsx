import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { PressableScale } from '@/components/PressableScale';
import { useContentColumn } from '@/hooks/useContentColumn';
import { rise } from '@/lib/motion';
import { colors, layout, radius, size, space, type } from '@/theme';

// A short guided tour, shown once after onboarding. Each step dims the app, rings the
// part it's about, and switches to that tab so the words have something to point at.

type Target = { kind: 'tab'; index: 0 | 1 | 2 } | { kind: 'avatar' } | null;

type Step = { title: string; body: string; target: Target; route: Href };

const STEPS: Step[] = [
  {
    title: 'You’re in.',
    body: 'A quick look around: three tabs, nothing else.',
    target: null,
    route: '/',
  },
  {
    title: 'Plan',
    body: 'Start here. Pick your training days, then add exercises to each one from the library.',
    target: { kind: 'tab', index: 1 },
    route: '/plan',
  },
  {
    title: 'Today',
    body: 'Each day opens on what’s planned. Tap Start session and tick every set as you go; your last weights are already filled in.',
    target: { kind: 'tab', index: 0 },
    route: '/',
  },
  {
    title: 'Body',
    body: 'Check in when you weigh in or get a scan. Your trend and monthly recap build from there.',
    target: { kind: 'tab', index: 2 },
    route: '/body',
  },
  {
    title: 'Profile',
    body: 'Your photo, units, targets and app updates live behind your picture. So does Spot the Spotter, if Spotter ever helps you.',
    target: { kind: 'avatar' },
    route: '/',
  },
];

type Props = {
  tabBarHeight: number;
  hasSplit: boolean;
  onFinish: () => void;
};

type Box = { x: number; y: number; w: number; h: number; r: number };

const roundedRect = ({ x, y, w, h, r }: Box) =>
  `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} ` +
  `A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} ` +
  `V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;

export function Tour({ tabBarHeight, hasSplit, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { inset } = useContentColumn();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // Where things are, from the same numbers the tab bar and Today use to lay out.
  const padLeft = Math.max(insets.left, space[4], inset);
  const padRight = Math.max(insets.right, space[4], inset);
  const itemWidth = (width - padLeft - padRight) / 3;
  const tabTop = height - tabBarHeight;

  let hole: Box | null = null;
  if (step.target?.kind === 'tab') {
    hole = {
      x: padLeft + step.target.index * itemWidth + space[2],
      y: tabTop + space[1],
      w: itemWidth - space[4],
      h: tabBarHeight - insets.bottom - space[2],
      r: radius.md,
    };
  } else if (step.target?.kind === 'avatar') {
    const d = size.avatarS + space[2] * 2;
    hole = {
      x: width - inset - space[4] - size.avatarS - space[2],
      y: insets.top + space[8] - space[2],
      w: d,
      h: d,
      r: d / 2,
    };
  }

  const go = (to: number) => {
    setIndex(to);
    router.navigate(STEPS[to].route);
  };

  const finish = (buildSplit: boolean) => {
    onFinish();
    router.navigate('/');
    if (buildSplit) router.push('/edit-split');
  };

  // The card sits above the tab bar, or under the avatar on the Profile step.
  const cardPosition =
    step.target?.kind === 'tab'
      ? { bottom: tabBarHeight + space[4] }
      : step.target?.kind === 'avatar' && hole
        ? { top: hole.y + hole.h + space[4] }
        : { top: height / 3 };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={`M0,0 H${width} V${height} H0 Z ${hole ? roundedRect(hole) : ''}`}
          fill={colors.scrim}
          fillRule="evenodd"
        />
        {hole && (
          <Rect
            x={hole.x}
            y={hole.y}
            width={hole.w}
            height={hole.h}
            rx={hole.r}
            fill="none"
            stroke={colors.ink}
            strokeWidth={size.ring}
          />
        )}
      </Svg>
      {/* Swallows taps on the app underneath while the tour is up. */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} />

      <Animated.View
        key={index}
        entering={rise()}
        accessibilityViewIsModal
        style={[styles.card, cardPosition, { left: padLeft, right: padRight }]}
      >
        <View style={styles.head}>
          <Text style={styles.label}>
            {index + 1} / {STEPS.length}
          </Text>
          {!last && (
            <Pressable accessibilityRole="button" onPress={() => finish(false)} hitSlop={space[3]}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.actions}>
          {/* The last step's two choices need the full width on small phones. */}
          {index > 0 && !(last && !hasSplit) && (
            <TourButton label="Back" onPress={() => go(index - 1)} />
          )}
          {last && !hasSplit ? (
            <>
              <TourButton label="Later" onPress={() => finish(false)} />
              <TourButton label="Build my split" primary onPress={() => finish(true)} />
            </>
          ) : (
            <TourButton
              label={last ? 'Done' : 'Next'}
              primary
              onPress={() => (last ? finish(false) : go(index + 1))}
            />
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function TourButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, primary ? styles.primary : styles.neutral]}
    >
      <Text style={[styles.buttonLabel, primary && styles.primaryLabel]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    maxWidth: layout.maxContentWidth,
    gap: space[2],
    padding: space[6],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: size.divider,
    borderColor: colors.hairline,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...type.labelWide, color: colors.inkMuted },
  skip: { ...type.captionStrong, color: colors.inkMuted },
  title: { ...type.title, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  actions: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
  button: {
    flex: 1,
    minHeight: size.tapTarget + space[1],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
  },
  neutral: { backgroundColor: colors.surfaceRaised },
  primary: { backgroundColor: colors.spotterRed },
  buttonLabel: { ...type.bodyStrong, color: colors.ink },
  primaryLabel: { fontFamily: type.button.fontFamily, color: colors.onRed },
});
