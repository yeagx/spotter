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
import { ProgressPhoto } from '@/components/ProgressPhoto';
import { SHARE_OUT, ShareCanvas } from '@/components/ShareCanvas';
import { SlantStrip } from '@/components/Slant';
import { StackScreen } from '@/components/StackScreen';
import { listProgressPhotos } from '@/db/checkins';
import { getRecap, type Recap } from '@/db/recap';
import { formatDay, isMonthKey, monthKey, monthName } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { easeOut, rise, stagger, webSafe } from '@/lib/motion';
import { monthPair } from '@/lib/progress';
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
  // Same for progress photos, and more so: off unless the user turns it on.
  const [pair, setPair] = useState<ReturnType<typeof monthPair>>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const shot = useRef<HostInstance>(null);

  useEffect(() => {
    getRecap(db, month).then(setRecap);
    listProgressPhotos(db).then((photos) => setPair(monthPair(photos, month)));
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
  const save = () => run(() => saveCard(shot, fileName, 'recap', SHARE_OUT));
  const share = () => run(() => shareCard(shot, fileName, `${monthName(month)} recap`, SHARE_OUT));

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
          <Toggle label="Show my name and photo on the card" on={showMe} onChange={setShowMe} />
          {pair && <Toggle label="Show my progress photos" on={showPhotos} onChange={setShowPhotos} />}
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
        // Scrolls on short phones so the card never clips.
        <FadeScrollView contentContainerStyle={styles.scroll}>
          <ShareCanvas shotRef={shot}>
            <Animated.View entering={webSafe(cardIn, 120, motion.riseMs)} style={styles.card}>
              <View style={styles.cardTop}>
                {showMe && profile ? (
                  <View style={styles.identity}>
                    <Avatar name={profile.name} photoUri={profile.photoUri} size={size.avatarS} />
                    <View style={styles.identityText}>
                      <Text allowFontScaling={false} style={styles.name} numberOfLines={1}>
                        {profile.name}
                      </Text>
                      <Text allowFontScaling={false} style={styles.monthSmall}>
                        {monthName(month)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text allowFontScaling={false} style={styles.month}>
                    {monthName(month)}
                  </Text>
                )}
                <Logo height={size.logoXs} />
              </View>

              {/* With photos on, before and after sit beside the count, so the card keeps its shape. */}
              <View style={styles.heroRow}>
                <Animated.View entering={rise(600)} style={styles.count}>
                  <CountUp
                    value={recap.done}
                    delay={600}
                    allowFontScaling={false}
                    style={styles.hero}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text allowFontScaling={false} style={styles.countLabel}>
                    {recap.done === 1 ? 'session' : 'sessions'} of {recap.planned} planned
                  </Text>
                </Animated.View>
                {pair && showPhotos && (
                  <Animated.View entering={rise()} style={styles.photos}>
                    <ProgressPhoto uri={pair.before.uri} label={formatDay(pair.before.date)} />
                    <ProgressPhoto uri={pair.after.uri} label={formatDay(pair.after.date)} />
                  </Animated.View>
                )}
              </View>

              {bars > 0 && (
                <SlantStrip
                  grow
                  delay={800}
                  height={size.stripBar}
                  gap={space[1]}
                  bars={Array.from({ length: bars }, (_, i) => ({
                    color: i < recap.done ? colors.spotterRed : colors.surfaceRaised,
                  }))}
                />
              )}

              <View style={styles.lines}>
                {lines.map((l, i) => (
                  <Animated.View key={l.label} entering={rise(stagger(i, 1300))} style={styles.line}>
                    <Text allowFontScaling={false} style={styles.lineLabel}>
                      {l.label}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={[styles.lineValue, l.red && styles.lineRed]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {l.value}
                    </Text>
                  </Animated.View>
                ))}
              </View>

              <View style={styles.cardEnd}>
                <Animated.Text allowFontScaling={false} entering={rise(1600)} style={styles.lock}>
                  locked in.
                </Animated.Text>
                {recap.fat && (
                  <Text allowFontScaling={false} style={styles.meta} numberOfLines={1}>
                    Body fat {formatDay(recap.fat.from)} → {formatDay(recap.fat.to)}
                  </Text>
                )}
              </View>
            </Animated.View>
          </ShareCanvas>
        </FadeScrollView>
      )}
    </StackScreen>
  );
}

// A checkbox line under the card: what goes on it is the user's call.
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={() => {
        haptic.select();
        onChange(!on);
      }}
      style={styles.toggle}
    >
      <View style={[styles.box, on && styles.boxOn]}>{on && <DrawnCheck />}</View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

// "−1.1%" / "+0.4%" with a real minus sign.
function signedPercent(n: number) {
  const r = Number(formatNumber(n));
  if (r === 0) return '0%';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}%`;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center' },
  card: {
    flex: 1,
    padding: space[6],
    gap: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { ...type.labelWide, color: colors.ink },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  count: { flex: 1, gap: space[1] },
  // Half the card; each photo keeps its 3:4 frame, so the height follows.
  photos: { width: '50%', flexDirection: 'row', gap: space[2] },
  hero: { ...type.numeralHero, color: colors.ink },
  countLabel: { ...type.body, fontFamily: type.bodyStrong.fontFamily, color: colors.inkMuted },
  // Takes the slack, so the lines sit low and every month's card ends the same way.
  lines: { marginTop: 'auto' },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[2],
    borderTopWidth: size.divider,
    borderTopColor: colors.hairline,
  },
  lineLabel: { ...type.body, color: colors.inkMuted },
  lineValue: { ...type.numeralR, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  lineRed: { color: colors.redText },
  meta: { ...type.caption, color: colors.inkMuted, flexShrink: 1, textAlign: 'right' },
  cardEnd: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] },
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
