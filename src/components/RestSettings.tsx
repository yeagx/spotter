import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Segmented } from '@/components/Segmented';
import type { Profile, RestAlert } from '@/db/profile';
import { restAlertsAllowed } from '@/lib/restAlert';
import { formatRest } from '@/lib/scheme';
import { colors, radius, size, space, type } from '@/theme';

// The rest timer in Profile: how long to rest between sets and between exercises, and
// how the end of a rest reaches you when you aren't looking at the screen.

// Below the first step sits "follow the plan" (between sets) or "same as sets"
// (between exercises), stored as null.
const STEPS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];

const ALERTS: { value: RestAlert; label: string }[] = [
  { value: 'sound', label: 'Sound' },
  { value: 'vibrate', label: 'Vibrate' },
  { value: 'off', label: 'Off' },
];

type Props = {
  profile: Profile;
  update: (changes: Partial<Omit<Profile, 'id'>>) => Promise<void>;
};

export function RestSettings({ profile, update }: Props) {
  // Held here so quick taps on a stepper never step from a stale value while the save
  // is still on its way.
  const [sets, setSets] = useState(profile.restSetsSec);
  const [exercises, setExercises] = useState(profile.restExercisesSec);
  const [alert, setAlert] = useState(profile.restAlert);
  // With notifications blocked for Spotter, a locked phone can't be reached at all. Say so
  // and offer the way to Settings; check again on coming back from there.
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    const check = () => restAlertsAllowed().then(setAllowed);
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Rest timer</Text>

      <StepRow
        label="Between sets"
        hint={sets === null ? 'From each exercise in your plan' : 'For every exercise'}
        value={sets}
        empty="Plan"
        onChange={(v) => {
          setSets(v);
          update({ restSetsSec: v });
        }}
      />
      <StepRow
        label="Between exercises"
        hint={exercises === null ? 'Same as between sets' : 'After the last set of each exercise'}
        value={exercises}
        empty="Same"
        onChange={(v) => {
          setExercises(v);
          update({ restExercisesSec: v });
        }}
      />

      <View style={styles.alert}>
        <Text style={styles.label}>When rest ends</Text>
        <Segmented
          options={ALERTS}
          value={alert}
          onChange={(v) => {
            setAlert(v);
            update({ restAlert: v });
          }}
        />
        {alert !== 'off' && !allowed ? (
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={styles.blocked}>
            <Text style={styles.hint}>
              Notifications are off for Spotter, so a locked phone stays quiet.{' '}
              <Text style={styles.link}>Turn on in Settings</Text>
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>
            {alert === 'off'
              ? 'Only the timer on screen. Nothing reaches a locked phone.'
              : 'Reaches you with the phone locked or in your pocket.'}
          </Text>
        )}
      </View>
    </View>
  );
}

type StepRowProps = {
  label: string;
  hint: string;
  value: number | null;
  empty: string; // what null reads as
  onChange: (value: number | null) => void;
};

function StepRow({ label, hint, value, empty, onChange }: StepRowProps) {
  // Position on the scale: -1 is the null option. A value from before that isn't a step
  // (not possible today, but cheap to handle) snaps to the nearest one.
  const at =
    value === null
      ? -1
      : STEPS.reduce((best, s, i) => (Math.abs(s - value) < Math.abs(STEPS[best] - value) ? i : best), 0);
  const go = (to: number) => onChange(to < 0 ? null : STEPS[to]);
  const shown = value === null ? empty : formatRest(value);

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <View style={styles.stepper}>
        <StepButton label="−" a11y={`Shorter rest ${label.toLowerCase()}`} disabled={at < 0} onPress={() => go(at - 1)} />
        <Text
          style={[styles.value, value === null && styles.valueEmpty]}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`${label}: ${value === null ? empty : `${value} seconds`}`}
        >
          {shown}
        </Text>
        <StepButton
          label="+"
          a11y={`Longer rest ${label.toLowerCase()}`}
          disabled={at >= STEPS.length - 1}
          onPress={() => go(at + 1)}
        />
      </View>
    </View>
  );
}

function StepButton({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.step}
    >
      <Text style={[styles.stepLabel, disabled && styles.stepLabelDisabled]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: colors.surface, padding: space[4], gap: space[4] },
  title: { ...type.bodyStrong, color: colors.ink },
  label: { ...type.labelWide, color: colors.inkMuted },
  // Wraps under large system fonts: the stepper drops below its label instead of squeezing.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  rowText: { flexGrow: 1, flexShrink: 1, flexBasis: '45%', gap: space[1] },
  rowLabel: { ...type.body, color: colors.ink },
  hint: { ...type.caption, color: colors.inkMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  step: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { ...type.heading, color: colors.ink },
  stepLabelDisabled: { color: colors.inkFaint },
  // Wide enough for "3:30" and "Plan" so the buttons don't shift as the value changes.
  value: { ...type.numeralXs, color: colors.ink, minWidth: size.tapTarget + space[4], textAlign: 'center' },
  valueEmpty: { ...type.captionStrong, color: colors.inkMuted },
  alert: { gap: space[2] },
  blocked: { minHeight: size.tapTarget, justifyContent: 'center' },
  link: { ...type.captionStrong, color: colors.ink, textDecorationLine: 'underline' },
});
