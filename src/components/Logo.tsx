import { Image, type ImageStyle, type StyleProp } from 'react-native';

// The mark, lifted off design/logo/spotter-mark-dark.png by scripts/make-brand-assets.py.
// Never recoloured or redrawn; only sized by height, width follows its own aspect ratio.
const SOURCE = require('../../assets/logo.png');
// 419 × 480 as written by the script; read from the asset where the platform allows.
const resolved = Image.resolveAssetSource?.(SOURCE);
export const LOGO_ASPECT = resolved?.width && resolved.height ? resolved.width / resolved.height : 419 / 480;

// blurRadius is only for the launch and start animations, which bring it into focus.
type Props = { height: number; style?: StyleProp<ImageStyle>; blurRadius?: number };

export function Logo({ height: h, style, blurRadius }: Props) {
  return (
    <Image
      source={SOURCE}
      accessibilityLabel="Spotter"
      style={[{ height: h, width: h * LOGO_ASPECT }, style]}
      resizeMode="contain"
      blurRadius={blurRadius}
    />
  );
}
