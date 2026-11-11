import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { getMeta, setMeta } from '@/db/meta';
import { haptic } from '@/lib/haptics';
import { BARS, loadBar } from '@/lib/plates';
import { formatNumber, parseDecimal } from '@/lib/units';
import { useUnits } from '@/state/profile';
import { colors, size, type } from '@/theme';

// "20 kg bar · each side 20 + 10 + 2.5": what to slide on for the weight in the set
// you're about to do, so nobody does plate maths between sets. Tap it to change the bar
// (20, 15, 10 kg); the choice is remembered per exercise, since a curl bar isn't a
// squat bar. Barbell exercises only.
export function PlateLine({ exerciseId, value }: { exerciseId: string; value: string }) {
  const db = useSQLiteContext();
  const { units } = useUnits();
  const bars = BARS[units];
  const key = `bar:${units}:${exerciseId}`;
  const [bar, setBar] = useState(bars[0]);

  useEffect(() => {
    let active = true;
    setBar(bars[0]);
    getMeta(db, key).then((saved) => {
      const n = Number(saved);
      if (active && saved && bars.includes(n)) setBar(n);
    });
    return () => {
      active = false;
    };
  }, [db, key, bars]);

  const total = parseDecimal(value);
  if (total === null || total <= 0) return null;

  const cycle = () => {
    const next = bars[(bars.indexOf(bar) + 1) % bars.length];
    setBar(next);
    haptic.select();
    setMeta(db, key, String(next)).catch(() => {});
  };

  const load = loadBar(total, bar, units);
  const detail =
    load.kind === 'under'
      ? 'lighter than the bar'
      : load.kind === 'empty'
        ? 'nothing on it'
        : `each side ${grouped(load.perSide)}${load.makes !== null ? ` · makes ${formatNumber(load.makes, 2)}` : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${bar} ${units} bar, ${detail}`}
      accessibilityHint="Changes the bar weight"
      onPress={cycle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.text}>
        <Text style={styles.bar}>
          {bar} {units} bar
        </Text>
        {' · '}
        {detail}
      </Text>
    </Pressable>
  );
}

// [20, 20, 5, 2.5] reads as "2 × 20 + 5 + 2.5".
function grouped(plates: number[]) {
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([p, n]) => (n > 1 ? `${n} × ${formatNumber(p, 2)}` : formatNumber(p, 2))).join(' + ');
}

const styles = StyleSheet.create({
  row: { minHeight: size.tapTarget, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  text: { ...type.caption, color: colors.inkMuted },
  bar: { ...type.captionStrong, color: colors.ink },
});
