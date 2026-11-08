// Web preview stand-ins: react-native-keyboard-controller has no web build, and a
// browser handles its own keyboard, so plain views do the job.
import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type ViewProps } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export function KeyboardProvider({ children }: { children: ReactNode } & Record<string, unknown>) {
  return <>{children}</>;
}

export function KeyboardAwareScrollView({
  bottomOffset: _bottomOffset,
  ...props
}: ScrollViewProps & { bottomOffset?: number }) {
  return <ScrollView {...props} />;
}

export function KeyboardStickyView({
  offset: _offset,
  ...props
}: ViewProps & { offset?: { closed?: number; opened?: number } }) {
  return <View {...props} />;
}

// The browser's keyboard never covers the page, so it always reads as closed.
export function useReanimatedKeyboardAnimation() {
  const progress = useSharedValue(0);
  const height = useSharedValue(0);
  return { progress, height };
}
