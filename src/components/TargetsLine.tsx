import { StyleSheet, Text, type TextProps } from 'react-native';

import type { Exercise } from '@/db/types';
import { targetParts } from '@/lib/labels';
import { colors, type } from '@/theme';

// What an exercise works, on one line: the main muscles in ink, then "also ..." in muted,
// e.g. "Upper chest · also Front delts, Triceps". Used in the library picker, Workout
// and the exercise page, so it reads the same everywhere.
export function TargetsLine({ exercise, style, ...props }: { exercise: Exercise } & Omit<TextProps, 'children'>) {
  const { primary, secondary } = targetParts(exercise);
  return (
    <Text
      accessibilityLabel={`Works ${primary}${secondary ? `, ${secondary}` : ''}`}
      {...props}
      style={[styles.line, style]}
    >
      <Text style={styles.primary}>{primary}</Text>
      {secondary ? ` · ${secondary}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: colors.inkMuted },
  primary: { ...type.captionStrong, color: colors.ink },
});
