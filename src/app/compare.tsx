import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip } from '@/components/Chip';
import { FadeScrollView } from '@/components/FadeScrollView';
import { BackIcon, ChevronRightIcon, DownloadIcon, ShareIcon } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { PressableScale } from '@/components/PressableScale';
import { ProgressPhoto } from '@/components/ProgressPhoto';
import { StackScreen } from '@/components/StackScreen';
import { POSES, listProgressPhotos, type Pose, type ProgressPhoto as Photo } from '@/db/checkins';
import { formatDay, timeApart } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { POSE_NAMES } from '@/lib/labels';
import { rise, stagger } from '@/lib/motion';
import { byPose, mainPose } from '@/lib/progress';
import { saveCard, shareCard } from '@/lib/shareCard';
import { formatNumber } from '@/lib/units';
import { useUnits } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

// Two progress photos side by side, with what changed between them. Starts on the first
// and the latest; the arrows move either one through the other check-ins with that pose.
// Save or share the pair as an image (the user's call; nothing leaves the phone otherwise).
export default function CompareScreen() {
  const params = useLocalSearchParams<{ pose?: string }>();
  const db = useSQLiteContext();
  const units = useUnits();
  const [groups, setGroups] = useState<Record<Pose, Photo[]>>();
  const [pose, setPose] = useState<Pose | null>(null);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [busy, setBusy] = useState(false);
  const shot = useRef<HostInstance>(null);

  const choose = (p: Pose, g = groups) => {
    setPose(p);
    setFrom(0);
    setTo(Math.max(0, (g?.[p].length ?? 1) - 1));
  };

  useEffect(() => {
    listProgressPhotos(db).then((photos) => {
      const g = byPose(photos);
      setGroups(g);
      const asked = POSES.find((p) => p === params.pose && g[p].length > 0);
      const start = asked ?? mainPose(g);
      if (start) choose(start, g);
    });
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = groups && pose ? groups[pose] : [];
  const before = list[from];
  const after = list[to];
  const pair = list.length >= 2 && before && after;
  const poses = groups ? POSES.filter((p) => groups[p].length > 0) : [];

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    haptic.press();
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  const fileName = `spotter-progress-${after?.date ?? 'photos'}`;
  const save = () => run(() => saveCard(shot, fileName, 'comparison'));
  const share = () => run(() => shareCard(shot, fileName, 'Progress'));

  const lines = pair
    ? [
        {
          label: 'Weight',
          value: `${signed(units.fromKg(after.weight) - units.fromKg(before.weight))} ${units.units}`,
        },
        ...(before.fat !== null && after.fat !== null
          ? [{ label: 'Body fat', value: `${signed(after.fat - before.fat)}%` }]
          : []),
        { label: 'Apart', value: timeApart(before.date, after.date) },
      ]
    : [];

  return (
    <StackScreen
      label="Compare"
      close
      footer={
        pair ? (
          <Animated.View entering={rise(400)} style={styles.actions}>
            <PressableScale accessibilityRole="button" onPress={save} disabled={busy} style={[styles.action, styles.save]}>
              <DownloadIcon />
              <Text style={styles.saveLabel}>Save</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" onPress={share} disabled={busy} style={[styles.action, styles.share]}>
              <ShareIcon />
              <Text style={styles.shareLabel}>Share</Text>
            </PressableScale>
          </Animated.View>
        ) : undefined
      }
    >
      {groups && (
        <FadeScrollView contentContainerStyle={styles.content}>
          {poses.length > 1 && (
            <Animated.View entering={rise()} style={styles.chips}>
              {poses.map((p) => (
                <Chip key={p} label={POSE_NAMES[p]} selected={pose === p} onPress={() => choose(p)} />
              ))}
            </Animated.View>
          )}

          {!pose ? (
            <Text style={styles.meta}>No photos yet. Add some when you check in.</Text>
          ) : (
            <>
              <View ref={shot} collapsable={false} style={styles.shot}>
                <Animated.View entering={rise(60)} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.label}>{POSE_NAMES[pose]}</Text>
                    <Logo height={size.logoXs} />
                  </View>
                  <View style={styles.photos}>
                    <ProgressPhoto uri={before?.uri} label={before && formatDay(before.date)} />
                    {pair ? (
                      <ProgressPhoto uri={after.uri} label={formatDay(after.date)} />
                    ) : (
                      <ProgressPhoto uri={undefined} label="Next" />
                    )}
                  </View>
                  {lines.length > 0 && (
                    <View>
                      {lines.map((l, i) => (
                        <Animated.View key={l.label} entering={rise(stagger(i, 200))} style={styles.line}>
                          <Text style={styles.lineLabel}>{l.label}</Text>
                          <Text style={styles.lineValue} numberOfLines={1} adjustsFontSizeToFit>
                            {l.value}
                          </Text>
                        </Animated.View>
                      ))}
                    </View>
                  )}
                </Animated.View>
              </View>

              {pair ? (
                <Animated.View entering={rise(300)} style={styles.pickers}>
                  <Stepper
                    label="Before"
                    date={before.date}
                    onPrev={from > 0 ? () => setFrom(from - 1) : undefined}
                    onNext={from < to - 1 ? () => setFrom(from + 1) : undefined}
                  />
                  <Stepper
                    label="After"
                    date={after.date}
                    onPrev={to > from + 1 ? () => setTo(to - 1) : undefined}
                    onNext={to < list.length - 1 ? () => setTo(to + 1) : undefined}
                  />
                </Animated.View>
              ) : (
                <Text style={styles.meta}>
                  One {POSE_NAMES[pose].toLowerCase()} photo so far. Take another at a later check-in to see them side by side.
                </Text>
              )}
            </>
          )}
        </FadeScrollView>
      )}
    </StackScreen>
  );
}

// "Before · 12 Oct" with arrows to step through the other check-ins.
function Stepper({
  label,
  date,
  onPrev,
  onNext,
}: {
  label: string;
  date: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const arrow = (enabled: boolean) => (enabled ? colors.ink : colors.inkFaint);
  return (
    <View style={styles.stepper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperDate}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: earlier check-in`}
          accessibilityState={{ disabled: !onPrev }}
          disabled={!onPrev}
          onPress={() => {
            haptic.select();
            onPrev?.();
          }}
          style={styles.arrow}
        >
          <BackIcon color={arrow(Boolean(onPrev))} />
        </Pressable>
        <Text style={styles.date} numberOfLines={1}>
          {formatDay(date)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: later check-in`}
          accessibilityState={{ disabled: !onNext }}
          disabled={!onNext}
          onPress={() => {
            haptic.select();
            onNext?.();
          }}
          style={styles.arrow}
        >
          <ChevronRightIcon color={arrow(Boolean(onNext))} size={size.iconMd} />
        </Pressable>
      </View>
    </View>
  );
}

// "+0.4" / "−1.2" with a real minus sign; "0" for no change.
function signed(n: number) {
  const r = Number(formatNumber(n));
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

const styles = StyleSheet.create({
  content: { gap: space[6], paddingTop: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  shot: { backgroundColor: colors.ground },
  card: { padding: space[4], gap: space[4], borderRadius: radius.lg, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photos: { flexDirection: 'row', gap: space[2] },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[3],
    borderTopWidth: size.divider,
    borderTopColor: colors.hairline,
  },
  lineLabel: { ...type.body, color: colors.inkMuted },
  lineValue: { ...type.numeralR, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  pickers: { gap: space[2] },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingLeft: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  stepperDate: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  arrow: { width: size.tapTarget, height: size.tapTarget, alignItems: 'center', justifyContent: 'center' },
  date: { ...type.bodyStrong, color: colors.ink, textAlign: 'center', flexShrink: 1 },
  actions: { flexDirection: 'row', gap: space[2] },
  action: {
    flex: 1,
    height: size.buttonPrimary,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  save: { backgroundColor: colors.surfaceRaised },
  share: { backgroundColor: colors.spotterRed },
  saveLabel: { ...type.bodyStrong, fontFamily: type.button.fontFamily, color: colors.ink },
  shareLabel: { ...type.bodyStrong, fontFamily: type.button.fontFamily, color: colors.onRed },
});
