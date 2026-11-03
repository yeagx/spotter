import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { colors, radius, size, space, type } from '@/theme';

type Props = { label: string; selected: boolean; onPress: () => void; raised?: boolean };

// Filter chip. Selected is ink-on-white rather than red: red stays for actions.
// `raised` when it sits on a card.
export function Chip({ label, selected, onPress, raised }: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={SLOP}
      style={[styles.chip, raised && styles.chipRaised, selected && styles.chipOn]}
    >
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </PressableScale>
  );
}

// Brings the 36px chip's touch area up to 44.
const SLOP = { top: (size.tapTarget - size.chip) / 2, bottom: (size.tapTarget - size.chip) / 2 };

const styles = StyleSheet.create({
  chip: {
    minHeight: size.chip,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRaised: { backgroundColor: colors.surfaceRaised },
  chipOn: { backgroundColor: colors.ink },
  label: { ...type.captionStrong, color: colors.inkMuted },
  labelOn: { color: colors.ground },
});
