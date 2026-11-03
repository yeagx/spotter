import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, layout } from '@/theme';

type Props = { edge: 'bottom' | 'right' };

// Stands in for a scrollbar: content melts into the ground at the scroll edge.
// Drawn as an SVG gradient over the content, so it needs no extra native module.
// Place inside a relatively positioned parent that wraps the scroll view.
export function EdgeFade({ edge }: Props) {
  // SVG gradient ids are global on web, and useId's ":r0:" isn't valid in url().
  const id = `fade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const vertical = edge === 'bottom';

  return (
    <View pointerEvents="none" style={vertical ? styles.bottom : styles.right}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <Stop offset="0" stopColor={colors.ground} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.ground} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: layout.fadeY },
  right: { position: 'absolute', top: 0, bottom: 0, right: 0, width: layout.fadeX },
});
