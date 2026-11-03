import { useId } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, size, space, type } from '@/theme';

type Props = Omit<TextInputProps, 'style' | 'keyboardType'> & {
  label: string;
  whole?: boolean; // whole numbers only (kcal), else decimals
};

// Labelled number input with the big display numerals, used for body stats and targets.
export function NumberField({ label, whole, ...props }: Props) {
  const id = useId();
  return (
    <View style={styles.root}>
      <Text nativeID={id} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <TextInput
        accessibilityLabelledBy={id}
        accessibilityLabel={label}
        keyboardType={whole ? 'number-pad' : 'decimal-pad'}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.inkMuted}
        cursorColor={colors.ink}
        maxLength={7}
        maxFontSizeMultiplier={1.4}
        {...props}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, gap: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  input: {
    ...type.numeralS,
    minHeight: size.buttonPrimary,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.ink,
  },
});
