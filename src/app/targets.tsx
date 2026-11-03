import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/Buttons';
import { FadeScrollView } from '@/components/FadeScrollView';
import { StackScreen } from '@/components/StackScreen';
import { TargetsForm, readTargets, type TargetsDraft } from '@/components/TargetsForm';
import { latestCheckin, type Checkin } from '@/db/checkins';
import { getSplit } from '@/db/plan';
import { DEFAULT_TRAINING_DAYS, estimateCalories } from '@/lib/calories';
import { notify } from '@/lib/confirm';
import { formatNumber, parseDecimal } from '@/lib/units';
import { useProfile, useUnits } from '@/state/profile';
import { space } from '@/theme';

// Edit target weight, target fat and daily calories after onboarding.
export default function TargetsScreen() {
  const db = useSQLiteContext();
  const { profile, update } = useProfile();
  const units = useUnits();
  const [latest, setLatest] = useState<Checkin | null>(null);
  const [trainingDays, setTrainingDays] = useState(DEFAULT_TRAINING_DAYS);
  const [draft, setDraft] = useState<TargetsDraft>(() => ({
    targetKg: profile?.targetKg ? units.show(profile.targetKg) : '',
    targetFat: profile?.targetFat ? formatNumber(profile.targetFat) : '',
    mode: profile?.calorieMode ?? 'estimate',
    kcal: profile?.calorieTarget ? String(profile.calorieTarget) : '',
  }));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLatest(await latestCheckin(db));
      const split = await getSplit(db);
      const days = split?.days.filter((d) => d.weekday !== null).length;
      if (days) setTrainingDays(days);
    })();
  }, [db]);

  if (!profile) return null;

  const estimate = latest ? estimateCalories(latest, profile.goal, trainingDays) : 0;

  const save = async () => {
    const parsed = readTargets(draft, units.toKg, parseDecimal);
    if ('problem' in parsed) {
      notify('Check that again', parsed.problem);
      return;
    }
    setBusy(true);
    try {
      await update({ ...parsed, calorieMode: draft.mode });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StackScreen
      label="Targets"
      footer={<PrimaryButton label="Save targets" onPress={save} disabled={busy} />}
    >
      <FadeScrollView contentContainerStyle={styles.content}>
        <TargetsForm draft={draft} onChange={setDraft} estimate={estimate} weightUnit={units.units} />
      </FadeScrollView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space[2] },
});
