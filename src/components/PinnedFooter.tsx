import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { KeyboardStickyView, useReanimatedKeyboardAnimation } from '@/lib/keyboard';
import { colors, space } from '@/theme';

// How far the footer's ground reaches past its own box: out to the screen-edge gutter on
// both sides, and down to the keyboard (the column's bottom padding).
const BLEED = space[4];
// The fade above the footer while typing. Kept short so a focused field, which the
// scroll view keeps FOOTER_CLEARANCE above the keyboard, is never under it.
const FADE = space[4];

// The primary action pinned at the bottom of a screen. When the keyboard opens it moves
// up with it, in step, and sits just above it (the safe-area gap below it is no longer
// needed then, so it's taken back out).
//
// Riding up, it passes over the scroll content, so it carries its own ground with a
// short fade on top: rows slide under it cleanly instead of showing through the gaps
// around the button. The backdrop only shows while the keyboard is open; at rest the
// scroll view's own fade does that job.
export function PinnedFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const id = `footerFade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }} style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.backdrop, backdrop]}>
        <Svg width="100%" height={FADE}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.ground} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.ground} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={FADE} fill={`url(#${id})`} />
        </Svg>
        <View style={styles.ground} />
      </Animated.View>
      {children}
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
  backdrop: {
    position: 'absolute',
    top: -FADE,
    bottom: -BLEED,
    left: -BLEED,
    right: -BLEED,
  },
  ground: { flex: 1, backgroundColor: colors.ground },
});
