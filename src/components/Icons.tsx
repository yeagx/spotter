import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, size } from '@/theme';

// Thin line icons from the mockups. Same 24-unit grid and 1.5px stroke as TabIcons.

type IconProps = { color?: ColorValue; size?: number };

const stroke = {
  fill: 'none',
  strokeWidth: size.iconStroke,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Icon({
  color = colors.inkMuted,
  size: s = size.iconSm,
  strokeWidth,
  children,
}: IconProps & { strokeWidth?: number; children: ReactNode }) {
  return (
    <Svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={strokeWidth ?? stroke.strokeWidth}
      stroke={color}
    >
      {children}
    </Svg>
  );
}

export const BackIcon = (p: IconProps) => (
  <Icon size={size.iconMd} color={colors.ink} {...p}>
    <Path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 9l6 6 6-6" />
  </Icon>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 15l6-6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9 6l6 6-6 6" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon size={size.iconXs} {...p}>
    <Path d="M12 5v14" />
    <Path d="M5 12h14" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="11" cy="11" r="6.5" />
    <Path d="M16 16l4 4" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9 7l8 5-8 5z" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon size={size.iconMd} color={colors.ink} {...p}>
    <Path d="M6 6l12 12" />
    <Path d="M18 6L6 18" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon size={size.iconMd} color={colors.onRed} strokeWidth={2} {...p}>
    <Path d="M5 12h14" />
    <Path d="M13 6l6 6-6 6" />
  </Icon>
);

// The demo placeholder's loop arrow.
export const LoopIcon = (p: IconProps) => (
  <Icon size={36} color={colors.inkFaint} {...p}>
    <Path d="M4 7h11a4 4 0 0 1 0 8H7" />
    <Path d="M9 4.5L6 7l3 2.5" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
    <Circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon color={colors.ink} {...p}>
    <Path d="M12 4v11" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M5 20h14" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon color={colors.onRed} {...p}>
    <Path d="M12 15V4" />
    <Path d="M7 9l5-5 5 5" />
    <Path d="M5 14v5h14v-5" />
  </Icon>
);

// Heavier stroke so the tick reads at 16px on red.
export const CheckIcon = (p: IconProps) => (
  <Icon size={size.iconXs} color={colors.onRed} strokeWidth={2.5} {...p}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
