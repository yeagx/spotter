import { useId } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { colors, radius, size, space, type } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  textStyle?: TextStyle; // defaults to heading; the split name uses title
};

// Labelled input on surface-raised. Grows with the system font size instead of clipping.
export function TextField({ label, textStyle = type.heading, ...props }: Props) {
  const id = useId();
  return (
    <View style={styles.root}>
      <Text nativeID={id} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabelledBy={id}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.inkMuted}
        cursorColor={colors.ink}
        {...props}
        style={[styles.input, textStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  input: {
    minHeight: size.buttonPrimary,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.ink,
  },
});
