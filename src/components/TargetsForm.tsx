import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NumberField } from '@/components/NumberField';
import { Segmented } from '@/components/Segmented';
import type { CalorieMode } from '@/db/profile';
import { rise } from '@/lib/motion';
import { colors, radius, space, type } from '@/theme';

// Typed text for the targets step; parsed by the screen that saves it.
export type TargetsDraft = { targetKg: string; targetFat: string; mode: CalorieMode; kcal: string };

type Props = {
  draft: TargetsDraft;
  onChange: (draft: TargetsDraft) => void;
  estimate: number; // kcal / day from BMR, goal and training days
  weightUnit: string;
};

// Target weight and fat, plus daily calories: estimated for you, or your own number.
export function TargetsForm({ draft, onChange, estimate, weightUnit }: Props) {
  const set = (change: Partial<TargetsDraft>) => onChange({ ...draft, ...change });
  return (
    <View style={styles.root}>
      <View style={styles.pair}>
        <Animated.View entering={rise(80)} style={styles.cell}>
          <NumberField
            label={`Target ${weightUnit}`}
            value={draft.targetKg}
            onChangeText={(targetKg) => set({ targetKg })}
            placeholder="optional"
          />
        </Animated.View>
        <Animated.View entering={rise(140)} style={styles.cell}>
          <NumberField
            label="Target fat %"
            value={draft.targetFat}
            onChangeText={(targetFat) => set({ targetFat })}
            placeholder="optional"
          />
        </Animated.View>
      </View>

      <Animated.View entering={rise(200)} style={styles.calories}>
        <Text style={styles.label}>Daily calories</Text>
        <Segmented
          options={[
            { value: 'estimate', label: 'Estimate for me' },
            { value: 'custom', label: 'I know my number' },
          ]}
          value={draft.mode}
          onChange={(mode) => set({ mode })}
        />
        {draft.mode === 'estimate' ? (
          <Animated.View key="estimate" entering={rise()} style={styles.estimate}>
            <View style={styles.valueRow}>
              <Text style={styles.number}>{estimate}</Text>
              <Text style={styles.meta}>kcal / day</Text>
            </View>
            <Text style={styles.meta}>
              Worked out from your BMR and goal. A starting point, not a rule.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View key="custom" entering={rise()}>
            <NumberField
              label="kcal / day"
              value={draft.kcal}
              onChangeText={(kcal) => set({ kcal })}
              placeholder={String(estimate)}
              whole
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  pair: { flexDirection: 'row', gap: space[2] },
  cell: { flex: 1, minWidth: 0 },
  calories: { gap: space[3] },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  estimate: { gap: space[2], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  number: { ...type.numeralM, color: colors.ink },
});

// Parses a draft into stored values (target kg converted by `toKg`). null fields are
// left empty; `problem` names the first field that doesn't make sense.
export function readTargets(
  draft: TargetsDraft,
  toKg: (v: number) => number,
  parse: (s: string) => number | null,
): { targetKg: number | null; targetFat: number | null; calorieTarget: number | null } | { problem: string } {
  const opt = (s: string) => (s.trim() ? parse(s) : null);
  const kg = opt(draft.targetKg);
  const fat = opt(draft.targetFat);
  const kcal = draft.mode === 'custom' ? opt(draft.kcal) : null;
  if (draft.targetKg.trim() && (kg === null || toKg(kg) < 20 || toKg(kg) > 350)) {
    return { problem: 'Target weight looks off. Check the number.' };
  }
  if (draft.targetFat.trim() && (fat === null || fat < 2 || fat > 70)) {
    return { problem: 'Target fat looks off. Check the number.' };
  }
  if (draft.mode === 'custom' && (kcal === null || kcal < 800 || kcal > 8000)) {
    return { problem: 'Enter your daily calories, or let Spotter estimate them.' };
  }
  return {
    targetKg: kg === null ? null : toKg(kg),
    targetFat: fat,
    calorieTarget: kcal === null ? null : Math.round(kcal),
  };
}
