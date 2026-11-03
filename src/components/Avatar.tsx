import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/theme';

type Props = { name: string; photoUri: string | null; size: number };

// The user's photo, or the first letter of their name when there isn't one.
export function Avatar({ name, photoUri, size }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '·';
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={[styles.base, circle]} accessibilityIgnoresInvertColors />;
  }
  // Initial scales with the circle: bodyStrong at the small size, avatarInitial at large.
  const textStyle = size >= 80 ? type.avatarInitial : type.bodyStrong;
  return (
    <View style={[styles.base, circle]}>
      <Text style={[textStyle, styles.initial]} maxFontSizeMultiplier={1.2}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { color: colors.ink, fontFamily: type.button.fontFamily },
});
