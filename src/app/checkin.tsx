import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { OutlineButton, PrimaryButton } from '@/components/Buttons';
import { FadeScrollView } from '@/components/FadeScrollView';
import { BackIcon, ChevronRightIcon, DownloadIcon } from '@/components/Icons';
import { NumberField } from '@/components/NumberField';
import { StackScreen } from '@/components/StackScreen';
import { deleteCheckin, getCheckin, saveCheckin, type CheckinInput } from '@/db/checkins';
import { LIMITS, inLimits } from '@/lib/body';
import { confirmDestructive, notify } from '@/lib/confirm';
import { formatDay, localDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { HEALTH_PROBLEMS, healthImportAvailable, readLatestBody } from '@/lib/healthImport';
import { rise, stagger } from '@/lib/motion';
import { formatNumber, parseDecimal, parseWhole } from '@/lib/units';
import { useUnits } from '@/state/profile';
import { colors, size, space, type } from '@/theme';

type FieldKey = keyof typeof LIMITS;

const FIELD_NAMES: Record<FieldKey, string> = {
  weight: 'Weight',
  bmi: 'BMI',
  fat: 'Body fat',
  muscle: 'Muscle',
  water: 'Water',
  bone: 'Bone',
  bmr: 'BMR',
};

const ORDER: FieldKey[] = ['weight', 'bmi', 'fat', 'muscle', 'water', 'bone', 'bmr'];

const shiftDay = (date: string, by: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + by));
};

// Log a check-in. Only weight is required; the rest comes from a scan if there is one.
// Pass ?id= to edit one. One check-in per day: a second on the same day replaces it.
export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useSQLiteContext();
  const units = useUnits();
  const [date, setDate] = useState(localDate());
  const [text, setText] = useState<Record<FieldKey, string>>({
    weight: '', bmi: '', fat: '', muscle: '', water: '', bone: '', bmr: '',
  });
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);
  // The day a Health Connect reading was filled in from, to say where the numbers came from.
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCheckin(db, id).then((c) => {
      if (c) {
        const show = (k: FieldKey, v: number | null) =>
          v === null ? '' : k === 'weight' || k === 'bone' ? units.show(v) : formatNumber(v);
        setDate(c.date);
        setText(Object.fromEntries(ORDER.map((k) => [k, show(k, c[k])])) as Record<FieldKey, string>);
      }
      setLoaded(true);
    });
  }, [db, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: FieldKey) => (v: string) => setText((t) => ({ ...t, [k]: v }));
  const today = localDate();

  // Fills the form from the latest weigh-in in Health Connect (a smart scale's app puts
  // it there). Nothing is saved until the user looks it over and taps Save.
  const fillFromHealth = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await readLatestBody();
      if ('problem' in result) {
        notify(...HEALTH_PROBLEMS[result.problem]);
        return;
      }
      const r = result.reading;
      // A value outside the sanity limits is left for the user to type.
      const ok = (k: FieldKey, v: number | null): v is number => v !== null && inLimits(k, v);
      if (!ok('weight', r.weight)) {
        notify(...HEALTH_PROBLEMS.empty);
        return;
      }
      setDate(r.date);
      setText((t) => ({
        ...t,
        weight: units.show(r.weight),
        fat: ok('fat', r.fat) ? formatNumber(r.fat) : t.fat,
        water: ok('water', r.water) ? formatNumber(r.water) : t.water,
        bone: ok('bone', r.bone) ? units.show(r.bone) : t.bone,
        bmr: ok('bmr', r.bmr) ? String(r.bmr) : t.bmr,
      }));
      setImportedFrom(r.date);
      haptic.success();
    } finally {
      setImporting(false);
    }
  };

  // Parses every field to stored units (kg). Returns the first problem, if any.
  const read = (): { input: CheckinInput } | { problem: string } => {
    const values = {} as Record<FieldKey, number | null>;
    for (const k of ORDER) {
      const raw = text[k].trim();
      if (!raw) {
        if (k === 'weight') return { problem: 'Weight is needed.' };
        values[k] = null;
        continue;
      }
      const n = k === 'bmr' ? parseWhole(raw) : parseDecimal(raw);
      const stored = n === null ? null : k === 'weight' || k === 'bone' ? units.toKg(n) : n;
      if (stored === null || !inLimits(k, stored)) {
        return { problem: `${FIELD_NAMES[k]} looks off. Check the number.` };
      }
      values[k] = stored;
    }
    return { input: { date, ...values, weight: values.weight! } };
  };

  const save = async () => {
    const result = read();
    if ('problem' in result) {
      notify('Check that again', result.problem);
      return;
    }
    setBusy(true);
    try {
      await saveCheckin(db, result.input, id);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive({
      title: 'Delete this check-in?',
      message: `The ${formatDay(date)} check-in will be gone for good.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteCheckin(db, id);
    router.back();
  };

  const w = units.units;
  const fields: [FieldKey, string, string][] = [
    ['weight', `Weight ${w}`, '0.0'],
    ['bmi', 'BMI', 'optional'],
    ['fat', 'Body fat %', 'optional'],
    ['muscle', 'Muscle %', 'optional'],
    ['water', 'Water %', 'optional'],
    ['bone', `Bone ${w}`, 'optional'],
    ['bmr', 'BMR kcal', 'optional'],
  ];

  return (
    <StackScreen
      label={id ? 'Edit check-in' : 'Check in'}
      footer={
        <PrimaryButton
          label="Save check-in"
          onPress={save}
          disabled={!loaded || busy || !text.weight.trim()}
        />
      }
    >
      {loaded && (
        <FadeScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={rise(60)} style={styles.dateRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              onPress={() => setDate((d) => shiftDay(d, -1))}
              style={styles.dateButton}
            >
              <BackIcon color={colors.inkMuted} />
            </Pressable>
            <View style={styles.dateText}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.date}>{date === today ? `Today · ${formatDay(date)}` : formatDay(date)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              accessibilityState={{ disabled: date >= today }}
              disabled={date >= today}
              onPress={() => setDate((d) => shiftDay(d, 1))}
              style={styles.dateButton}
            >
              <ChevronRightIcon color={date >= today ? colors.inkFaint : colors.inkMuted} size={size.iconMd} />
            </Pressable>
          </Animated.View>

          <Text style={styles.meta}>
            {importedFrom
              ? `Filled from Health Connect, weighed ${formatDay(importedFrom)}. Check it, then save.`
              : 'Only weight is needed. Copy the rest from a scan if you have one.'}
          </Text>

          {healthImportAvailable && !id && (
            <Animated.View entering={rise(90)}>
              <OutlineButton
                label={importing ? 'Reading…' : 'Fill from Health Connect'}
                icon={<DownloadIcon color={colors.ink} />}
                onPress={fillFromHealth}
              />
            </Animated.View>
          )}

          <View style={styles.grid}>
            {fields.map(([k, label, placeholder], i) => (
              <Animated.View key={k} entering={rise(stagger(i, 120))} style={styles.cell}>
                <NumberField
                  label={label}
                  value={text[k]}
                  onChangeText={set(k)}
                  placeholder={placeholder}
                  whole={k === 'bmr'}
                  // With an import on offer the keyboard waits, so the button isn't covered.
                  autoFocus={!id && k === 'weight' && !healthImportAvailable}
                />
              </Animated.View>
            ))}
          </View>

          {id && (
            <Pressable accessibilityRole="button" onPress={remove} style={styles.delete}>
              <Text style={styles.deleteLabel}>Delete check-in</Text>
            </Pressable>
          )}
        </FadeScrollView>
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6], paddingTop: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dateButton: {
    width: size.tapTarget,
    height: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { flex: 1, alignItems: 'center', gap: space[1] },
  date: { ...type.heading, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], rowGap: space[4] },
  // Two per row, as a flex basis so larger text can't push a third onto the line.
  cell: { flexGrow: 1, flexBasis: '45%' },
  delete: { minHeight: size.tapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  deleteLabel: { ...type.bodyStrong, color: colors.redText },
});
