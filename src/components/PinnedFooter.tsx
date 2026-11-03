import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardStickyView } from '@/lib/keyboard';
import { space } from '@/theme';

// The primary action pinned at the bottom of a screen. When the keyboard opens it moves
// up with it, in step, and sits just above it (the safe-area gap below it is no longer
// needed then, so it's taken back out).
export function PinnedFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }} style={styles.root}>
      {children}
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
});
