import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, space, type } from '@/theme';

type Props = {
  label: string;
  title: string;
  note: string;
};

// Temporary screen body until each tab is built. Shows all three font faces
// (Michroma label, Manrope 800 title, Manrope 500 caption) so fonts are easy to verify.
export function PlaceholderScreen({ label, title, note }: Props) {
  return (
    <Screen edges={['top', 'right', 'left']}>
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[1],
  },
  label: { ...type.labelWide, color: colors.inkMuted },
  title: { ...type.title, color: colors.ink },
  note: { ...type.caption, color: colors.inkMuted },
});
