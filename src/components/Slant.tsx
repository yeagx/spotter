import { useState } from 'react';
import { View, type ColorValue, type LayoutChangeEvent } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { slant } from '@/theme';

// The slant, the one decorative move. Every shape is a polygon cut inside its own box,
// never a rotated or skewed element, so nothing overflows its container.

// Horizontal offset of the cut for a w × h box: the logo's ~26° angle, capped so tall
// narrow bars keep a flat top.
const cutFor = (w: number, h: number) => Math.min(h * slant, w * 0.34);

type Edge = 'slant' | 'straight';

function points(x: number, y: number, w: number, h: number, left: Edge, right: Edge) {
  const c = cutFor(w, h);
  const top = y;
  const bottom = y + h;
  const tl = left === 'slant' ? x + c : x;
  const br = right === 'slant' ? x + w - c : x + w;
  return `${tl},${top} ${x + w},${top} ${br},${bottom} ${x},${bottom}`;
}

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
  const n = bars.length;
  const w = n ? (width - gap * (n - 1)) / n : 0;

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {width > 0 && w > 0 && (
        <Svg width={width} height={height}>
          {bars.map((b, i) => {
            const h = Math.max(1, height * (b.value ?? 1));
            return (
              <Polygon
                key={i}
                points={points(
                  i * (w + gap),
                  height - h,
                  w,
                  h,
                  i === 0 ? 'straight' : 'slant',
                  i === n - 1 ? 'straight' : 'slant',
                )}
                fill={b.color}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

// A single free-standing slanted bar (both ends cut), e.g. a week-strip day or a cue mark.
export function SlantBar({ width, height, color }: { width: number; height: number; color: ColorValue }) {
  return (
    <Svg width={width} height={height}>
      <Polygon points={points(0, 0, width, height, 'slant', 'slant')} fill={color} />
    </Svg>
  );
}
