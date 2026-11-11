import { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/theme';

type Props = Omit<TextProps, 'children'> & {
  value: number;
  format?: (n: number) => string;
  delay?: number;
};

// Close to the app's cubic-bezier(.16,1,.3,1): fast off the mark, a long settle.
const settle = (t: number) => 1 - (1 - t) ** 4;

// A hero number that runs up to its value once, then holds. Later changes run from the
// number already showing, so a new check-in moves 72.9 to 72.4 instead of restarting
// from zero. With reduce-motion on, the number is just there.
export function CountUp({ value, format = String, delay = 0, ...props }: Props) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const from = useRef(reduceMotion ? value : 0);
  const whole = Number.isInteger(value);

  useEffect(() => {
    if (reduceMotion || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    let frame = 0;
    let began = 0;
    const step = (now: number) => {
      if (!began) began = now;
      const t = Math.min(1, (now - began) / motion.countMs);
      const n = start + (value - start) * settle(t);
      from.current = n;
      setShown(t === 1 ? value : n);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay, reduceMotion]);

  return (
    <Text accessibilityLabel={format(value)} {...props}>
      {format(whole ? Math.round(shown) : shown)}
    </Text>
  );
}
