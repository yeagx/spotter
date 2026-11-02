import type { ColorValue } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { size } from '@/theme';

type IconProps = { color: ColorValue };

const stroke = {
  fill: 'none',
  strokeWidth: size.iconStroke,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function TodayIcon({ color }: IconProps) {
  return (
    <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" {...stroke} stroke={color}>
      <Path d="M6.5 6.5v11" />
      <Path d="M17.5 6.5v11" />
      <Path d="M3.5 9v6" />
      <Path d="M20.5 9v6" />
      <Path d="M6.5 12h11" />
    </Svg>
  );
}

export function PlanIcon({ color }: IconProps) {
  return (
    <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" {...stroke} stroke={color}>
      <Rect x="4" y="5" width="16" height="15" rx="2" />
      <Path d="M4 10h16" />
      <Path d="M9 3v4" />
      <Path d="M15 3v4" />
    </Svg>
  );
}

export function BodyIcon({ color }: IconProps) {
  return (
    <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" {...stroke} stroke={color}>
      <Path d="M4 18l5-6 4 3 7-9" />
      <Path d="M15 6h5v5" />
    </Svg>
  );
}
