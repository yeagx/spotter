import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CameraIcon } from '@/components/Icons';
import { colors, radius, size, space, type } from '@/theme';

// A progress photo in its 3:4 frame (a phone held upright). Width comes from the parent
// (flex), height follows the ratio, so two or three sit side by side at any screen size.
// With no uri it's an empty slot showing a camera and the pose name.
type Props = {
  uri: string | undefined;
  label?: string; // pose or date, shown on the frame
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ProgressPhoto({ uri, label, onPress, accessibilityLabel }: Props) {
  const body = uri ? (
    <>
      <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      {label && (
        <View style={styles.tag}>
          <Text style={styles.tagText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </>
  ) : (
    <View style={styles.empty}>
      <CameraIcon color={colors.inkMuted} size={size.iconMd} />
      {label && (
        <Text style={styles.emptyText} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
  if (!onPress) return <View style={styles.frame}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.frame, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], padding: space[2] },
  emptyText: { ...type.labelWide, color: colors.inkMuted },
  tag: {
    position: 'absolute',
    left: space[2],
    bottom: space[2],
    maxWidth: '90%',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.sm,
    backgroundColor: colors.scrim,
  },
  tagText: { ...type.labelWide, color: colors.ink },
});
