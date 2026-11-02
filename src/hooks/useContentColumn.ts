import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme';

// Horizontal inset that keeps content in a centered maxContentWidth column on wide
// screens, and returns 0 on phones so content stretches edge to edge (minus margins).
export function useContentColumn() {
  const { width } = useWindowDimensions();
  const isWide = width > layout.wideBreakpoint;
  const inset = isWide ? (width - layout.maxContentWidth) / 2 : 0;
  return { isWide, inset };
}
