import { Platform, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { EdgeFade } from '@/components/EdgeFade';
import { KeyboardAwareScrollView } from '@/lib/keyboard';
import { layout, size, space } from '@/theme';

// How far above the keyboard a focused field sits: clear of the pinned button that rides
// on the keyboard (its height plus the gaps around it), so the field and its title stay
// visible while typing.
export const FOOTER_CLEARANCE = size.buttonPrimary + space[4] * 2;

type Props = ScrollViewProps & { bottomOffset?: number };

// Vertical scroll area with no scrollbar and a fade at the bottom edge, for content
// above a pinned button. Extra bottom padding lets the last row scroll clear of the fade.
// It scrolls a focused field into view above the keyboard and pinned button.
export function FadeScrollView({
  contentContainerStyle,
  children,
  bottomOffset = FOOTER_CLEARANCE,
  ...props
}: Props) {
  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={bottomOffset}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // react-native-web dismisses on any scroll, even the browser bringing a focused
        // field into view, so typing would lose focus. Phones only dismiss on a drag.
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        {...props}
        contentContainerStyle={[contentContainerStyle, styles.content]}
      >
        {children}
      </KeyboardAwareScrollView>
      <EdgeFade edge="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: layout.fadeY },
});
