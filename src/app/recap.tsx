import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';
import Animated, { Keyframe, ReduceMotion } from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { DrawnCheck } from '@/components/DrawnCheck';
import { FadeScrollView } from '@/components/FadeScrollView';
import { DownloadIcon, ShareIcon } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { PressableScale } from '@/components/PressableScale';
import { SlantStrip } from '@/components/Slant';
import { StackScreen } from '@/components/StackScreen';
import { getRecap, type Recap } from '@/db/recap';
import { formatDay, isMonthKey, monthKey, monthName } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { easeOut, rise, stagger, webSafe } from '@/lib/motion';
import { saveCard, shareCard } from '@/lib/shareCard';
import { formatNumber } from '@/lib/units';
import { useProfile, useUnits } from '@/state/profile';
import { colors, motion, radius, size, space, type } from '@/theme';

// The card tips up into place, like a card being handed over.
const cardIn = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ perspective: 900 }, { translateY: 40 }, { rotateX: '14deg' }, { scale: 0.96 }],
  },
  100: {
    opacity: 1,
    transform: [{ perspective: 900 }, { translateY: 0 }, { rotateX: '0deg' }, { scale: 1 }],
    easing: easeOut,
  },
})
  .delay(120)
  .duration(motion.riseMs)
  .reduceMotion(ReduceMotion.System);

// Monthly recap: sessions done against planned, best lift, new bests, and body-fat change
// when the month has two check-ins to compare. Save or share it as an image.
export default function RecapScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const month = isMonthKey(params.month) ? params.month : monthKey();
  const db = useSQLiteContext();
  const units = useUnits();
  const { profile } = useProfile();
  const [recap, setRecap] = useState<Recap>();
  // Off by default: the card is shared outside the app, so putting your face and name
  // on it is your call.
  const [showMe, setShowMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const shot = useRef<HostInstance>(null);

  useEffect(() => {
    getRecap(db, month).then(setRecap);
  }, [db, month]);

  // The image is named after the month, e.g. spotter-november-2026.png, so it reads well
  // in the gallery and in whatever it's shared to.
  const fileName = `spotter-${monthName(month).toLowerCase()}-${month.slice(0, 4)}`;
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
  const save = () => run(() => saveCard(shot, fileName, 'recap'));
  const share = () => run(() => shareCard(shot, fileName, `${monthName(month)} recap`));

  const lines = recap
    ? [
        {
          label: 'Best lift',
          value: recap.bestLift
            ? `${recap.bestLift.name} ${units.show(recap.bestLift.kg)} ${units.units}`
            : '—',
          red: false,
        },
        { label: 'New bests', value: String(recap.newBests), red: recap.newBests > 0 },
        ...(recap.fat
          ? [{ label: 'Body fat', value: `${signedPercent(recap.fat.change)}`, red: false }]
          : []),
      ]
    : [];
  const bars = recap ? Math.max(recap.planned, recap.done) : 0;

  return (
    <StackScreen
      label="Your month"
      close
      footer={
        <Animated.View entering={rise(900)} style={styles.footer}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showMe }}
            onPress={() => {
              haptic.select();
              setShowMe((v) => !v);
            }}
            style={styles.toggle}
          >
            <View style={[styles.box, showMe && styles.boxOn]}>{showMe && <DrawnCheck />}</View>
            <Text style={styles.toggleLabel}>Show my name and photo on the card</Text>
          </Pressable>
          <View style={styles.actions}>
            <PressableScale accessibilityRole="button" onPress={save} disabled={!recap || busy} style={[styles.action, styles.save]}>
              <DownloadIcon />
              <Text style={styles.saveLabel}>Save</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" onPress={share} disabled={!recap || busy} style={[styles.action, styles.share]}>
              <ShareIcon />
              <Text style={styles.shareLabel}>Share</Text>
            </PressableScale>
          </View>
        </Animated.View>
      }
    >
      {recap && (
        // Scrolls on short phones so the card never clips. The ground-coloured frame is
        // part of the image, so the card's rounded corners sit on dark wherever it's shared.
        <FadeScrollView contentContainerStyle={styles.scroll}>
          <View ref={shot} collapsable={false} style={styles.shot}>
            <Animated.View entering={webSafe(cardIn, 120, motion.riseMs)} style={styles.card}>
              <View style={styles.cardTop}>
                {showMe && profile ? (
                  <View style={styles.identity}>
                    <Avatar name={profile.name} photoUri={profile.photoUri} size={size.avatarS} />
                    <View style={styles.identityText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {profile.name}
                      </Text>
                      <Text style={styles.monthSmall}>{monthName(month)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.month}>{monthName(month)}</Text>
                )}
                <Logo height={size.logoXs} />
              </View>

              <Animated.View entering={rise(600)} style={styles.count}>
                <CountUp value={recap.done} delay={600} style={styles.hero} numberOfLines={1} adjustsFontSizeToFit />
                <Text style={styles.countLabel}>
                  {recap.done === 1 ? 'session' : 'sessions'} of {recap.planned} planned
                </Text>
              </Animated.View>

              {bars > 0 && (
                <SlantStrip
                  grow
                  delay={800}
                  height={size.stripTick}
                  gap={space[1]}
                  bars={Array.from({ length: bars }, (_, i) => ({
                    color: i < recap.done ? colors.spotterRed : colors.surfaceRaised,
                  }))}
                />
              )}

              <View style={styles.grow} />

              <View>
                {lines.map((l, i) => (
                  <Animated.View key={l.label} entering={rise(stagger(i, 1300))} style={styles.line}>
                    <Text style={styles.lineLabel}>{l.label}</Text>
                    <Text style={[styles.lineValue, l.red && styles.lineRed]} numberOfLines={2}>
                      {l.value}
                    </Text>
                  </Animated.View>
                ))}
              </View>

              {recap.fat && (
                <Text style={styles.meta}>
                  Body fat from your check-ins on {formatDay(recap.fat.from)} and {formatDay(recap.fat.to)}.
                </Text>
              )}
              <Animated.Text entering={rise(1600)} style={styles.lock}>
                locked in.
              </Animated.Text>
            </Animated.View>
          </View>
        </FadeScrollView>
      )}
    </StackScreen>
  );
}

// "−1.1%" / "+0.4%" with a real minus sign.
function signedPercent(n: number) {
  const r = Number(formatNumber(n));
  if (r === 0) return '0%';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}%`;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  shot: { flexGrow: 1, backgroundColor: colors.ground },
  card: {
    flexGrow: 1,
    padding: space[6],
    gap: space[6],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { ...type.labelWide, color: colors.ink },
  count: { gap: space[1] },
  hero: { ...type.numeralHero, color: colors.ink },
  countLabel: { ...type.body, fontFamily: type.bodyStrong.fontFamily, color: colors.inkMuted },
  grow: { flexGrow: 1, minHeight: space[2] },
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
  lineRed: { color: colors.redText },
  meta: { ...type.caption, color: colors.inkMuted },
  lock: { ...type.numeralXs, color: colors.ink },
  footer: { gap: space[3] },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: size.tapTarget },
  box: {
    width: size.check,
    height: size.check,
    borderRadius: radius.sm,
    borderWidth: size.ring,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.spotterRed, borderColor: colors.spotterRed },
  toggleLabel: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexShrink: 1 },
  identityText: { flexShrink: 1 },
  name: { ...type.bodyStrong, color: colors.ink },
  monthSmall: { ...type.labelWide, color: colors.inkMuted },
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
  save: { backgroundColor: colors.surface },
  share: { backgroundColor: colors.spotterRed },
  saveLabel: { ...type.bodyStrong, fontFamily: type.button.fontFamily, color: colors.ink },
  shareLabel: { ...type.bodyStrong, fontFamily: type.button.fontFamily, color: colors.onRed },
});
