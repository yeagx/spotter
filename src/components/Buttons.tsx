import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { PlusIcon } from '@/components/Icons';
import { colors, radius, size, space, type } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

// The one red action on a screen. Fixed 56px tall: buttons never shrink.
// Disabled drops to surface-raised so red only appears once there's something to do.
export function PrimaryButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primary, disabled && styles.primaryDisabled]}
    >
      <Text style={[styles.primaryLabel, disabled && styles.labelDisabled]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

// Full-width outline button, e.g. "Add exercise" under a list.
export function OutlineButton({
  label,
  onPress,
  icon = <PlusIcon color={colors.ink} />,
}: ButtonProps & { icon?: ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.outline}>
      {icon}
      <Text style={styles.outlineLabel}>{label}</Text>
    </PressableScale>
  );
}

// Compact 44px button, e.g. "Edit" on Plan. `raised` when it sits on a card;
// `primary` when it's the screen's main action (Body's "Check in").
export function SmallButton({
  label,
  onPress,
  disabled,
  raised,
  primary,
}: ButtonProps & { raised?: boolean; primary?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.small, raised && styles.smallRaised, primary && styles.smallPrimary]}
    >
      <Text
        style={[
          styles.smallLabel,
          primary && styles.smallPrimaryLabel,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: size.buttonPrimary,
    borderRadius: radius.md,
    backgroundColor: colors.spotterRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  primaryDisabled: {
    backgroundColor: colors.surfaceRaised,
  },
  primaryLabel: { ...type.button, color: colors.onRed },
  labelDisabled: { color: colors.inkMuted },
  outline: {
    minHeight: size.buttonPrimary,
    borderRadius: radius.md,
    borderWidth: size.ring,
    borderColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
  },
  outlineLabel: { ...type.bodyStrong, color: colors.ink },
  small: {
    minHeight: size.tapTarget,
    minWidth: size.tapTarget,
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallRaised: { backgroundColor: colors.surfaceRaised },
  smallPrimary: { backgroundColor: colors.spotterRed },
  smallPrimaryLabel: { fontFamily: type.button.fontFamily, color: colors.onRed },
  smallLabel: { ...type.bodyStrong, color: colors.ink },
});
