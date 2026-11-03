import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { FadeScrollView } from '@/components/FadeScrollView';
import { useContentColumn } from '@/hooks/useContentColumn';
import { colors, layout, space } from '@/theme';

type Props = {
  children: ReactNode;
  // Tab screens skip 'bottom': the tab bar already pads for the gesture bar.
  edges?: Edge[];
  // Pinned below the scroll area, e.g. a primary button.
  footer?: ReactNode;
};

// Base for every tab screen: safe areas, a scroll view so content that grows with the
// system font size never clips, and the centered column on wide screens.
export function Screen({ children, edges = ['top', 'right', 'bottom', 'left'], footer }: Props) {
  const { isWide } = useContentColumn();

  return (
    <SafeAreaView edges={edges} style={styles.root}>
      <FadeScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.column, isWide && styles.columnWide]}>{children}</View>
      </FadeScrollView>
      {footer && <View style={[styles.footer, isWide && styles.columnWide]}>{footer}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  scroll: {
    flexGrow: 1,
  },
  column: {
    width: '100%',
    paddingHorizontal: space[4],
    paddingTop: space[8],
  },
  columnWide: {
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  footer: {
    width: '100%',
    paddingHorizontal: space[4],
    paddingBottom: space[4],
  },
});
