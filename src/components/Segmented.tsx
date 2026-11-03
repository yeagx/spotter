import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { colors, radius, size, space, type } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T | null; // null: nothing chosen yet
  onChange: (value: T) => void;
};

// A small set of mutually exclusive choices on one track, e.g. "Estimate for me /
// I know my number". The chosen one lifts to surface-raised; no red, it's not an action.
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.item, on && styles.itemOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={2}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: space[1],
    padding: space[1],
    borderRadius: radius.sm + space[1],
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    minHeight: size.tapTarget,
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOn: { backgroundColor: colors.surfaceRaised },
  label: { ...type.captionStrong, color: colors.inkMuted, textAlign: 'center' },
  labelOn: { color: colors.ink },
});
