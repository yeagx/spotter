import { useEffect, useState } from 'react';
import { View, type ColorValue, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { slantPoints, stripBoxes } from '@/lib/slant';
import { motion } from '@/theme';

// The slant, the one decorative move. The geometry lives in src/lib/slant.ts.

export type StripBar = { color: ColorValue; value?: number }; // value 0..1 of the height

type StripProps = {
  bars: StripBar[];
  height: number;
  gap: number;
  // Bars rise from the baseline one after another the first time the strip shows.
  grow?: boolean;
  delay?: number;
};

// Close to the app's cubic-bezier(.16,1,.3,1): fast off the mark, a long settle.
const settle = (t: number) => 1 - (1 - t) ** 4;

// Milliseconds since the strip started growing, or null once every bar has landed
// (and always null when it isn't asked to grow, or reduce-motion is on).
function useGrowth(enabled: boolean, delay: number, bars: number) {
  const reduceMotion = useReducedMotion();
  const animate = enabled && !reduceMotion;
  const [elapsed, setElapsed] = useState<number | null>(animate ? 0 : null);

  useEffect(() => {
    if (!animate) return;
    const total = motion.barMs + motion.staggerMs * bars;
    let frame = 0;
    let began = 0;
    const step = (now: number) => {
      if (!began) began = now;
      const ms = now - began;
      if (ms >= total) {
        setElapsed(null);
        return;
      }
      setElapsed(ms);
      frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    // Runs once, for the bars the strip first showed.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return elapsed;
}

// A row of slanted bars that fills its width, bottom-aligned. The first bar keeps a
// straight left edge and the last a straight right edge, so the strip sits flush.
export function SlantStrip({ bars, height, gap, grow = false, delay = 0 }: StripProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const elapsed = useGrowth(grow, delay, bars.length);
  const grown = (i: number) =>
    elapsed === null ? 1 : settle(Math.min(1, Math.max(0, (elapsed - i * motion.staggerMs) / motion.barMs)));
  const boxes =
    width > 0 ? stripBoxes(bars.map((b, i) => (b.value ?? 1) * grown(i)), width, height, gap) : [];

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
