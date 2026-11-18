import { useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';

import { colors, space } from '@/theme';

// A shared card (session, monthly recap) is a fixed 4:5 picture: the shape chat apps and
// feeds show whole instead of cropping. It's laid out at CANVAS_W × CANVAS_H on every
// phone and scaled to the width it has here, so the image is identical everywhere.
// Text inside should pass allowFontScaling={false}: it's a picture, and type grown by
// the system font size would spill out of a fixed frame.
export const CANVAS_W = 420;
export const CANVAS_H = 525;
// The image's pixel size, for saveCard / shareCard.
export const SHARE_OUT = { width: 1080, height: 1350 };

type Props = {
  shotRef: RefObject<HostInstance | null>; // the view captured as the image
  children: ReactNode; // the card, which fills the canvas inside the dark border
};

export function ShareCanvas({ shotRef, children }: Props) {
  const [width, setWidth] = useState(0);
  const scale = width / CANVAS_W;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.frame, { height: CANVAS_H * scale }]}>
      {width > 0 && (
        <View style={[styles.scaler, { transform: [{ scale }] }]}>
          {/* Dark ground with the card inset, so it reads as a card wherever it lands. */}
          <View ref={shotRef} collapsable={false} style={styles.canvas}>
            {children}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%' },
  // Laid out at the canvas size, then scaled from its top-left corner to the frame's width.
  scaler: { width: CANVAS_W, height: CANVAS_H, transformOrigin: 'top left' },
  canvas: { width: CANVAS_W, height: CANVAS_H, padding: space[6], backgroundColor: colors.ground },
});
