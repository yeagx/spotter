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
import { sessionSummary, type SessionSummary } from '@/db/sessions';
import { formatClock, formatDay, localDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { easeOut, rise, stagger, webSafe } from '@/lib/motion';
import { saveCard, shareCard } from '@/lib/shareCard';
import { formatLift } from '@/lib/tracking';
import { useProfile, useUnits } from '@/state/profile';
import { colors, motion, radius, size, space, type } from '@/theme';

// More exercises than this and the card stops being a card; the rest are counted.
const MAX_LINES = 7;

// The card tips up into place, like a card being handed over (same move as the recap).
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

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// One session as a card: what was moved, each exercise's top set, and any new bests.
// Save or share it as an image.
export default function SessionCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const units = useUnits();
  const { profile } = useProfile();
  const [summary, setSummary] = useState<SessionSummary | null>();
  // Off by default: the card leaves the app, so your face and name on it is your call.
  const [showMe, setShowMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const shot = useRef<HostInstance>(null);

  useEffect(() => {
    sessionSummary(db, id).then(setSummary);
  }, [db, id]);

  if (summary === null || (summary && summary.sets === 0)) {
    return (
      <StackScreen label="Your session" close>
        <Text style={styles.meta}>There’s nothing logged in this session.</Text>
      </StackScreen>
    );
  }

  const date = summary ? localDate(new Date(summary.session.startedAt)) : '';
  const fileName = `spotter-session-${date}`;
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

  const title = summary?.dayName ?? 'Session';
  const volume = summary ? units.fromKg(summary.volumeKg) : 0;
  const byVolume = volume > 0;
  const lines = summary?.lines.slice(0, MAX_LINES) ?? [];
  const more = summary ? summary.lines.length - lines.length : 0;
  const bests = summary?.lines.filter((l) => l.isBest).length ?? 0;
  const mostSets = Math.max(1, ...(summary?.lines.map((l) => l.sets) ?? []));
  const duration = summary
    ? formatClock((summary.session.finishedAt ?? Date.now()) - summary.session.startedAt)
    : '';

  return (
    <StackScreen
      label="Your session"
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
            <PressableScale
              accessibilityRole="button"
              onPress={() => run(() => saveCard(shot, fileName, 'session card'))}
              disabled={!summary || busy}
              style={[styles.action, styles.save]}
            >
              <DownloadIcon />
              <Text style={styles.saveLabel}>Save</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              onPress={() => run(() => shareCard(shot, fileName, `${title} · ${formatDay(date)}`))}
              disabled={!summary || busy}
              style={[styles.action, styles.share]}
            >
              <ShareIcon />
              <Text style={styles.shareLabel}>Share</Text>
            </PressableScale>
          </View>
        </Animated.View>
      }
    >
      {summary && (
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
                      <Text style={styles.dateSmall} numberOfLines={1}>
                        {title} · {formatDay(date)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.identityText}>
                    <Text style={styles.day} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={styles.dateSmall}>{formatDay(date)}</Text>
                  </View>
                )}
                <Logo height={size.logoXs} />
              </View>

              <Animated.View entering={rise(500)} style={styles.count}>
                <CountUp
                  value={byVolume ? Math.round(volume) : summary.sets}
                  format={thousands}
                  delay={500}
                  style={styles.hero}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
                <Text style={styles.countLabel}>
                  {byVolume ? `${units.units} moved` : summary.sets === 1 ? 'set' : 'sets'}
                </Text>
                <Text style={styles.meta}>
                  {summary.lines.length} {summary.lines.length === 1 ? 'exercise' : 'exercises'} · {summary.sets}{' '}
                  {summary.sets === 1 ? 'set' : 'sets'} · {duration}
                </Text>
              </Animated.View>

              {/* One bar per exercise, as tall as its share of the work; red set a new best. */}
              <SlantStrip
                grow
                delay={700}
                height={size.stripTick}
                gap={space[1]}
                bars={summary.lines.map((l) => ({
                  color: l.isBest ? colors.spotterRed : colors.inkMuted,
                  value: 0.3 + 0.7 * (l.sets / mostSets),
                }))}
              />

              <View style={styles.grow} />

              <View>
                {lines.map((l, i) => (
                  <Animated.View key={l.exerciseId} entering={rise(stagger(i, 1100))} style={styles.line}>
                    <Text style={styles.lineLabel} numberOfLines={1}>
                      {l.name}
                    </Text>
                    <Text style={[styles.lineValue, l.isBest && styles.lineRed]} numberOfLines={1}>
                      {formatLift(l.top, l.tracking, units)}
                    </Text>
                  </Animated.View>
                ))}
              </View>

              {(more > 0 || bests > 0) && (
                <Text style={styles.meta}>
                  {[
                    more > 0 && `and ${more} more`,
                    bests > 0 && `${bests} new ${bests === 1 ? 'best' : 'bests'}, in red`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
              <Animated.Text entering={rise(1700)} style={styles.lock}>
                good session.
              </Animated.Text>
            </Animated.View>
          </View>
        </FadeScrollView>
      )}
    </StackScreen>
  );
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  day: { ...type.heading, color: colors.ink },
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
  lineLabel: { ...type.body, color: colors.inkMuted, flexShrink: 1 },
  lineValue: { ...type.numeralXs, color: colors.ink, textAlign: 'right' },
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
  dateSmall: { ...type.labelWide, color: colors.inkMuted },
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
