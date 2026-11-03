// Web preview stand-ins: react-native-keyboard-controller has no web build, and a
// browser handles its own keyboard, so plain views do the job.
import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type ViewProps } from 'react-native';

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
