import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { FadeScrollView } from '@/components/FadeScrollView';
import { PressableScale } from '@/components/PressableScale';
import { StackScreen } from '@/components/StackScreen';
import { getSplit } from '@/db/plan';
import { TEMPLATES, applyTemplate, type Template } from '@/db/templates';
import { confirmDestructive } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { rise, stagger } from '@/lib/motion';
import { inWeekOrder, weekdayShort } from '@/lib/week';
import { colors, radius, size, space, type } from '@/theme';

// Pick a ready-made split. It replaces the plan in one go; every day, exercise and
// number stays editable afterwards, so it's a starting point, not a program to follow.
export default function PlansScreen() {
  const db = useSQLiteContext();
  const [chosen, setChosen] = useState<Template | null>(null);
  const [exercisesNow, setExercisesNow] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSplit(db).then((split) => setExercisesNow(split?.days.reduce((n, d) => n + d.exercises.length, 0) ?? 0));
  }, [db]);

  const use = async () => {
    if (!chosen || busy) return;
    if (exercisesNow > 0) {
      const ok = await confirmDestructive({
        title: 'Replace your plan?',
        message: `Your days and exercises become ${chosen.name}. Past sessions and bests stay.`,
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await applyTemplate(db, chosen);
      haptic.success();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StackScreen
      label="Ready-made plans"
      footer={
        <PrimaryButton
          label={chosen ? `Use ${chosen.name}` : 'Pick a plan'}
          onPress={use}
          disabled={!chosen || busy}
          haptic={null}
        />
      }
    >
      <FadeScrollView contentContainerStyle={styles.content}>
        <Animated.Text entering={rise(60)} style={styles.meta}>
          A starting point. Change any day, exercise or number after.
        </Animated.Text>
        {TEMPLATES.map((t, i) => {
          const selected = chosen?.id === t.id;
          const weekdays = inWeekOrder(t.days.map((d) => d.weekday));
          return (
            <Animated.View key={t.id} entering={rise(stagger(i, 120))}>
              <PressableScale
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setChosen(t)}
                haptic="select"
                style={[styles.card, selected && styles.cardOn]}
              >
                <View style={styles.head}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.label}>
                    {t.days.length} days · {weekdays.map(weekdayShort).join(' ')}
                  </Text>
                </View>
                <Text style={styles.meta}>{t.line}</Text>
                <View style={styles.days}>
                  {weekdays.map((w) => {
                    const day = t.days.find((d) => d.weekday === w)!;
                    return (
                      <View key={w} style={styles.day}>
                        <Text style={styles.dayLabel}>{weekdayShort(w)}</Text>
                        <Text style={styles.dayName} numberOfLines={1}>
                          {day.name}
                        </Text>
                        <Text style={styles.meta}>{day.items.length} exercises</Text>
                      </View>
                    );
                  })}
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}
      </FadeScrollView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[4], paddingTop: space[2] },
  meta: { ...type.caption, color: colors.inkMuted },
  label: { ...type.labelWide, color: colors.inkMuted },
  card: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: size.ring,
    borderColor: colors.surface,
  },
  cardOn: { borderColor: colors.ink },
  head: { gap: space[1] },
  name: { ...type.heading, color: colors.ink },
  days: { gap: space[1] },
  day: { flexDirection: 'row', alignItems: 'baseline', gap: space[3] },
  dayLabel: { ...type.labelWide, color: colors.inkMuted, minWidth: size.dayColumn },
  dayName: { ...type.bodyStrong, color: colors.ink, flex: 1 },
});
