import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import { LOGO_ASPECT } from '@/components/Logo';
import { colors, fonts, size, space, type } from '@/theme';

import { Card, lineH, padFor, type Box } from './ui';

const LOGO = require('../../assets/logo.png');

// Start (1x1): the mark and a red START. One tap starts today's session (or resumes the
// one in progress). The logo is dropped before the button is squeezed.
export function StartWidget({ uri, b }: { uri: string; b: Box }) {
  const pad = padFor(b);
  const pillH = lineH(type.labelWide, b) + space[1] * 2;
  const logoH = Math.min(size.logoXs, b.h - pad * 2 - pillH - space[2]);
  const pillW = b.w - pad * 2;

  return (
    <Card uri={uri} label="Start today's session" pad={pad} center>
      {logoH >= space[4] && (
        <ImageWidget image={LOGO} imageHeight={logoH} imageWidth={Math.round(logoH * LOGO_ASPECT)} />
      )}
      {logoH >= space[4] && <FlexWidget style={{ height: space[2] }} />}
      <FlexWidget
        style={{
          width: pillW,
          height: pillH,
          borderRadius: pillH / 2,
          backgroundColor: colors.spotterRed,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* No extra tracking: Michroma is already wide, and a 1x1 has little room. */}
        <TextWidget
          text="START"
          maxLines={1}
          style={{ fontFamily: fonts.display, fontSize: type.labelWide.fontSize, color: colors.onRed }}
        />
      </FlexWidget>
    </Card>
  );
}
