import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton, SmallButton } from '@/components/Buttons';
import { Chip } from '@/components/Chip';
import { ChevronRightIcon } from '@/components/Icons';
import { Screen } from '@/components/Screen';
import { SlantBar } from '@/components/Slant';
import { TrendChart } from '@/components/TrendChart';
import { listCheckins, type Checkin } from '@/db/checkins';
import { getSplit } from '@/db/plan';
import { STATS, barScale, positionOn, rangeFor, standing, type Range, type StatDef } from '@/lib/body';
import { estimateCalories, restingBurn } from '@/lib/calories';
import { formatDay, monthKey, monthName } from '@/lib/dates';
import { rise, stagger } from '@/lib/motion';
import { formatNumber } from '@/lib/units';
import { useProfile, useUnits } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

const TAB_EDGES = ['top', 'right', 'left'] as const;

type TrendKey = 'weight' | 'fat' | 'muscle';
const TRENDS: { key: TrendKey; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'fat', label: 'Body fat' },
  { key: 'muscle', label: 'Muscle' },
];

const MARKER = { width: size.markerWidth, height: size.markerHeight };

export default function BodyScreen() {
  const db = useSQLiteContext();
  const { profile } = useProfile();
  const units = useUnits();
  const [checkins, setCheckins] = useState<Checkin[]>();
  const [trainingDays, setTrainingDays] = useState(0);
  const [trend, setTrend] = useState<TrendKey>('weight');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const list = await listCheckins(db);
        const split = await getSplit(db);
        if (!active) return;
        setCheckins(list);
        setTrainingDays(split?.days.filter((d) => d.weekday !== null).length ?? 0);
      })();
      return () => {
        active = false;
      };
    }, [db]),
  );

  const checkIn = () => router.push('/checkin');

  if (!checkins || !profile) return <Screen edges={[...TAB_EDGES]}>{null}</Screen>;

  const latest = checkins[checkins.length - 1];
  if (!latest) {
    return (
      <Screen edges={[...TAB_EDGES]} footer={<PrimaryButton label="Check in" onPress={checkIn} />}>
        <Animated.View entering={rise()} style={styles.titleBlock}>
          <Text style={styles.label}>No check-ins yet</Text>
          <Text style={styles.title}>Body</Text>
          <Text style={styles.meta}>Log your weight, and the rest of a scan if you have one.</Text>
        </Animated.View>
      </Screen>
    );
  }

  const previous = checkins[checkins.length - 2];
  const weightUnit = units.units;
  const kcal =
    profile.calorieMode === 'custom' && profile.calorieTarget
      ? profile.calorieTarget
      : estimateCalories(latest, profile.goal, trainingDays);
  const bmr = latest.bmr ?? Math.round(restingBurn(latest));

  // Trend options only appear for stats with at least two readings.
  const series = (key: TrendKey) =>
    checkins.flatMap((c) => (c[key] === null ? [] : [{ date: c.date, value: c[key] as number }]));
  const available = TRENDS.filter((t) => t.key === 'weight' || series(t.key).length >= 2);
  const shown = available.some((t) => t.key === trend) ? trend : 'weight';
  const points = series(shown);
  const display = (v: number) => (shown === 'weight' ? units.fromKg(v) : v);
  const trendUnit = shown === 'weight' ? ` ${weightUnit}` : '%';
  const change = points.length >= 2 ? display(points[points.length - 1].value) - display(points[0].value) : 0;
  const thisMonth = monthKey();

  return (
    <Screen edges={[...TAB_EDGES]}>
      <View style={styles.content}>
        <Animated.View entering={rise()} style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.label}>Last check-in · {formatDay(latest.date)}</Text>
            <Text style={styles.title}>Body</Text>
          </View>
          <SmallButton label="Check in" onPress={checkIn} primary />
        </Animated.View>

        <Animated.View entering={rise(90)} style={styles.titleBlock}>
          <Text style={styles.label}>Weight</Text>
          <View style={styles.hero}>
            <Text style={styles.heroNumber} numberOfLines={1} adjustsFontSizeToFit>
              {units.show(latest.weight)}
            </Text>
            <Text style={styles.heroUnit}>
              {weightUnit}
              {latest.bmi ? ` · BMI ${formatNumber(latest.bmi)}` : ''}
            </Text>
          </View>
          <Text style={styles.meta}>
            {[
              previous && `${signed(units.fromKg(latest.weight) - units.fromKg(previous.weight))} ${weightUnit} since ${formatDay(previous.date)}`,
              profile.targetKg && `target ${units.show(profile.targetKg)} ${weightUnit}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Animated.View>

        <View style={styles.grid}>
          {STATS.map((stat, i) => (
            <StatCard
              key={stat.key}
              stat={stat}
              value={latest[stat.key]}
              range={rangeFor(stat.key, profile.sex, latest.weight)}
              delay={stagger(i, 180)}
              format={(v) => (stat.unit === 'weight' ? units.show(v) : formatNumber(v))}
              convert={(v) => (stat.unit === 'weight' ? units.fromKg(v) : v)}
              unit={stat.unit === 'weight' ? weightUnit : '%'}
            />
          ))}
        </View>
        <Animated.View entering={rise(500)}>
          {profile.sex ? (
            <Text style={styles.meta}>
              The grey band is the {profile.sex === 'male' ? 'men’s' : 'women’s'} adult range;
              the white mark is you. A guide from your scan, not a verdict.
            </Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} hitSlop={space[2]}>
              <Text style={styles.meta}>
                Normal ranges differ for men and women.{' '}
                <Text style={styles.link}>Set yours in Profile</Text> to see them.
              </Text>
            </Pressable>
          )}
        </Animated.View>

        <Animated.View entering={rise(520)} style={[styles.card, styles.targetCard]}>
          <View style={styles.titleBlock}>
            <Text style={styles.label}>Daily target</Text>
            <View style={styles.valueRow}>
              <Text style={styles.statNumber}>{kcal}</Text>
              <Text style={styles.meta}>kcal</Text>
            </View>
          </View>
          <View style={styles.bmr}>
            <Text style={styles.label}>{latest.bmr ? 'BMR' : 'BMR est.'}</Text>
            <Text style={styles.bmrNumber}>{bmr}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={rise(600)} style={[styles.card, styles.trendCard]}>
          <View style={styles.trendHead}>
            <Text style={styles.label}>Trend</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/recap', params: { month: thisMonth } })}
              hitSlop={space[3]}
            >
              <Text style={styles.link}>{monthName(thisMonth)} recap</Text>
            </Pressable>
          </View>
          {available.length > 1 && (
            <View style={styles.chips}>
              {available.map((t) => (
                <Chip key={t.key} label={t.label} selected={shown === t.key} onPress={() => setTrend(t.key)} raised />
              ))}
            </View>
          )}
          <TrendChart values={points.map((p) => display(p.value))} />
          <Text style={styles.meta}>
            {points.length < 2
              ? 'Your trend starts at your next check-in.'
              : `${signed(change)}${trendUnit} since ${formatDay(points[0].date)}`}
          </Text>
        </Animated.View>

        <Animated.View entering={rise(680)} style={styles.history}>
          <Text style={styles.label}>Check-ins</Text>
          <View style={styles.card}>
            {[...checkins].reverse().map((c, i, list) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityHint="Edit this check-in"
                onPress={() => router.push({ pathname: '/checkin', params: { id: c.id } })}
                style={[styles.historyRow, i < list.length - 1 && styles.divider]}
              >
                <Text style={styles.historyDate}>{formatDay(c.date)}</Text>
                <Text style={styles.historyValue}>
                  {units.show(c.weight)} {weightUnit}
                  {c.fat !== null ? ` · ${formatNumber(c.fat)}%` : ''}
                </Text>
                <ChevronRightIcon />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}

// "+0.4" / "−1.2" with a real minus sign; "0" for no change.
function signed(n: number) {
  const r = Number(formatNumber(n));
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

type StatCardProps = {
  stat: StatDef;
  value: number | null;
  range: Range | null; // null until the profile has a sex
  delay: number;
  format: (v: number) => string;
  convert: (v: number) => number;
  unit: string;
};

const STANDING_WORDS = { below: 'Below', in: 'In', above: 'Above' } as const;

function StatCard({ stat, value, range, delay, format, convert, unit }: StatCardProps) {
  const scale = range ? barScale(range) : null;
  const left = range && scale ? positionOn(range.lo, scale) : 0;
  const right = range && scale ? positionOn(range.hi, scale) : 0;
  const bounds = range ? `${formatNumber(convert(range.lo))}–${formatNumber(convert(range.hi))}` : '';
  const caption =
    value === null
      ? 'Add it at your next check-in'
      : range
        ? `${STANDING_WORDS[standing(value, range)]} ${range.word} range · ${bounds}`
        : 'No range until sex is set';
  return (
    <Animated.View entering={rise(delay)} style={[styles.card, styles.stat]}>
      <Text style={styles.label} numberOfLines={1}>
        {stat.label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
          {value === null ? '—' : format(value)}
        </Text>
        {value !== null && <Text style={styles.meta}>{unit}</Text>}
      </View>
      <View style={styles.track}>
        {range && (
          <View style={[styles.normal, { left: `${left * 100}%`, width: `${(right - left) * 100}%` }]} />
        )}
        {value !== null && scale && (
          <View style={[styles.marker, { left: `${positionOn(value, scale) * 100}%` }]}>
            <SlantBar width={MARKER.width} height={MARKER.height} color={colors.ink} />
          </View>
        )}
      </View>
      <Text style={styles.meta}>{caption}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[4],
  },
  titleBlock: { flexShrink: 1, gap: space[1] },
  label: { ...type.labelWide, color: colors.inkMuted },
  title: { ...type.titleL, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  link: { ...type.captionStrong, color: colors.ink },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  heroNumber: { ...type.numeralXl, color: colors.ink, flexShrink: 1 },
  heroUnit: { ...type.body, color: colors.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  card: { borderRadius: radius.md, backgroundColor: colors.surface },
  // Two per row: (100% - one gap) / 2, as a flex basis so text growth can't break it.
  stat: { flexGrow: 1, flexBasis: '45%', padding: space[4], gap: space[3] },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  statNumber: { ...type.numeralM, color: colors.ink, flexShrink: 1 },
  track: {
    height: size.stripThin,
    borderRadius: size.stripThin / 2,
    backgroundColor: colors.surfaceRaised,
    marginVertical: (MARKER.height - size.stripThin) / 2,
  },
  normal: {
    position: 'absolute',
    top: 0,
    height: size.stripThin,
    borderRadius: size.stripThin / 2,
    backgroundColor: colors.inkMuted,
  },
  marker: {
    position: 'absolute',
    top: -(MARKER.height - size.stripThin) / 2,
    marginLeft: -MARKER.width / 2,
  },
  targetCard: {
    padding: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  bmr: { alignItems: 'flex-end', gap: space[1] },
  bmrNumber: { ...type.numeralXs, color: colors.inkMuted },
  trendCard: { padding: space[4], gap: space[3] },
  trendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  history: { gap: space[2] },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.tapTarget,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  divider: { borderBottomWidth: size.divider, borderBottomColor: colors.hairline },
  historyDate: { ...type.bodyStrong, color: colors.ink, minWidth: size.thumb },
  historyValue: { ...type.body, color: colors.inkMuted, flex: 1 },
});
