import { useState } from 'react';
import { View, type ColorValue, type LayoutChangeEvent } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { slantPoints, stripBoxes } from '@/lib/slant';

// The slant, the one decorative move. The geometry lives in src/lib/slant.ts.

export type StripBar = { color: ColorValue; value?: number }; // value 0..1 of the height

type StripProps = {
  bars: StripBar[];
  height: number;
  gap: number;
};

// A row of slanted bars that fills its width, bottom-aligned. The first bar keeps a
// straight left edge and the last a straight right edge, so the strip sits flush.
export function SlantStrip({ bars, height, gap }: StripProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const boxes = width > 0 ? stripBoxes(bars.map((b) => b.value ?? 1), width, height, gap) : [];

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {boxes.length > 0 && (
        <Svg width={width} height={height}>
          {boxes.map((b, i) => (
            <Polygon
              key={i}
              points={slantPoints(b.x, b.y, b.w, b.h, b.left, b.right)}
              fill={bars[i].color}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

// A single free-standing slanted bar (both ends cut), e.g. a week-strip day or a cue mark.
export function SlantBar({ width, height, color }: { width: number; height: number; color: ColorValue }) {
  return (
    <Svg width={width} height={height}>
      <Polygon points={slantPoints(0, 0, width, height, 'slant', 'slant')} fill={color} />
    </Svg>
  );
}
