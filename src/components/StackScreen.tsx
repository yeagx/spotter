import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackIcon, CloseIcon } from '@/components/Icons';
import { PinnedFooter } from '@/components/PinnedFooter';
import { PressableScale } from '@/components/PressableScale';
import { useContentColumn } from '@/hooks/useContentColumn';
import { rise } from '@/lib/motion';
import { colors, layout, radius, size, space, type } from '@/theme';

type Props = {
  label: string; // small caps title in the header, e.g. "EDIT SPLIT"
  children: ReactNode;
  footer?: ReactNode; // the pinned primary button
  close?: boolean; // an X instead of a back arrow, for screens that are a moment, not a step
};

// Base for screens pushed over the tabs: back button and label on top, content in the
// middle (each screen decides what scrolls), primary action pinned at the bottom above
// the gesture bar. The footer rides up with the keyboard instead of being covered.
export function StackScreen({ label, children, footer, close }: Props) {
  const { isWide } = useContentColumn();

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.column, isWide && styles.columnWide]}>
        <Animated.View entering={rise()} style={styles.header}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={close ? 'Close' : 'Back'}
            onPress={() => router.back()}
            style={styles.back}
          >
            {close ? <CloseIcon /> : <BackIcon />}
          </PressableScale>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.headerEnd} />
        </Animated.View>
        <View style={styles.fill}>{children}</View>
        {footer && <PinnedFooter>{footer}</PinnedFooter>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  fill: { flex: 1 },
  column: {
    flex: 1,
    width: '100%',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[4],
    gap: space[4],
  },
  columnWide: { maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  back: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.labelWide, color: colors.inkMuted, flexShrink: 1, textAlign: 'center' },
  // Mirrors the back button so the label stays centered.
  headerEnd: { width: size.tapTarget },
});
