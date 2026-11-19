import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  background,
  buttonStyle,
  clipShape,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityEnvironment, LiveActivityLayout } from 'expo-widgets';

import { colors, size, space, type } from '@/theme';

import { IOS_WIDGET_FONTS } from './props';

// The workout on the iPhone's lock screen and Dynamic Island: what's next, a live rest
// countdown, and Log set / Skip rest, the same as Android's notification. The app starts
// and updates it (lib/liveWorkout.ios.ts); the buttons come back to it as events.

export const workoutActivityTheme = () => ({
  ground: colors.ground as string,
  raised: colors.surfaceRaised as string,
  ink: colors.ink as string,
  muted: colors.inkMuted as string,
  red: colors.spotterRed as string,
  redText: colors.redText as string,
  onRed: colors.onRed as string,
  f: IOS_WIDGET_FONTS,
  pad: space[4],
  s1: space[1],
  s2: space[2],
  s3: space[3],
  s4: space[4],
  label: type.labelWide.fontSize,
  labelKern: type.labelWide.letterSpacing,
  heading: type.heading.fontSize,
  bodyStrong: type.bodyStrong.fontSize,
  caption: type.caption.fontSize,
  numXs: type.numeralXs.fontSize,
  numM: type.numeralM.fontSize,
  numCaption: type.numeralCaption.fontSize,
  button: size.chip,
});

export type WorkoutActivityProps = {
  t: ReturnType<typeof workoutActivityTheme>;
  set: string; // "Set 3 of 4", or "All sets ticked"
  exercise: string; // "Leg Press", or "Finish the session in Spotter."
  what: string; // "60 kg × 8"
  restFrom: number | null;
  restUntil: number | null;
  canLog: boolean;
};

// Runs in the widget extension (see layout.tsx): no imports, theme in props.
export function WorkoutActivity(p: WorkoutActivityProps, env: LiveActivityEnvironment): LiveActivityLayout {
  'widget';
  const t = p.t;
  // A rest past its end shows as over even with Spotter asleep: the app marks the
  // activity stale at that moment, and iOS redraws it.
  const resting = p.restUntil !== null && p.restFrom !== null && !env.isStale;
  const restOver = p.restUntil !== null && env.isStale === true;

  const txt = (s: string, family: string, sz: number, color: string, extra: unknown[] = []) => (
    <Text modifiers={[font({ family, size: sz }), foregroundStyle(color), lineLimit(1), ...(extra as never[])]}>{s}</Text>
  );
  const label = (s: string, color = t.muted) => txt(s.toUpperCase(), t.f.display, t.label, color, [kerning(t.labelKern)]);
  const timer = (sz: number) =>
    resting ? (
      <Text
        timerInterval={{ lower: new Date(p.restFrom as number), upper: new Date(p.restUntil as number) }}
        countsDown
        modifiers={[font({ family: t.f.display, size: sz }), foregroundStyle(t.ink), monospacedDigit(), lineLimit(1)]}
      />
    ) : null;
  const pill = (target: string, s: string, bg: string, fg: string) => (
    <Button target={target} modifiers={[buttonStyle('plain')]}>
      <Text
        modifiers={[
          font({ family: t.f.sans700, size: t.bodyStrong }),
          foregroundStyle(fg),
          lineLimit(1),
          padding({ horizontal: t.s4 }),
          frame({ height: t.button }),
          background(bg),
          clipShape('capsule'),
        ]}
      >
        {s}
      </Text>
    </Button>
  );
  const buttons = (
    <HStack spacing={t.s2}>
      {resting ? pill('skip', 'Skip rest', t.raised, t.ink) : null}
      {p.canLog ? pill('log', 'Log set', t.red, t.onRed) : null}
    </HStack>
  );
  const what = restOver ? txt('rest’s up.', t.f.display, t.numXs, t.redText) : txt(p.what, t.f.display, t.numXs, resting ? t.muted : t.ink, [minimumScaleFactor(0.6)]);

  return {
    banner: (
      <VStack alignment="leading" spacing={t.s1} modifiers={[padding({ all: t.pad }), activityBackgroundTint(t.ground)]}>
        <HStack>
          {label(resting ? `Rest · then ${p.set}` : p.set)}
          <Spacer />
          {timer(t.numM)}
        </HStack>
        {txt(p.exercise, t.f.sans800, t.heading, t.ink)}
        <HStack spacing={t.s3}>
          {what}
          <Spacer />
          {buttons}
        </HStack>
      </VStack>
    ),
    compactLeading: txt(p.set.replace(/^Set /, ''), t.f.display, t.numCaption, t.ink),
    compactTrailing: resting ? timer(t.numCaption) : txt(p.what, t.f.display, t.numCaption, t.ink),
    minimal: resting ? timer(t.numCaption) : txt(p.set.replace(/^Set (\d+).*/, '$1'), t.f.display, t.numCaption, t.ink),
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: t.s1 })]}>
        {label(p.set)}
        {txt(p.exercise, t.f.sans800, t.bodyStrong, t.ink)}
      </VStack>
    ),
    expandedTrailing: resting ? timer(t.numM) : null,
    expandedBottom: (
      <HStack spacing={t.s3} modifiers={[padding({ horizontal: t.s1 })]}>
        {what}
        <Spacer />
        {buttons}
      </HStack>
    ),
  };
}
