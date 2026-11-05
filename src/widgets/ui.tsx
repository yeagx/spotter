import type { ReactNode } from 'react';
import { FlexWidget, TextWidget, type WidgetInfo } from 'react-native-android-widget';

import { colors, fonts, radius, space, type } from '@/theme';

// Building blocks shared by every widget: the card, labels and text, all from the
// app's tokens. Widget sizes are in dp, like the app's layout units.

export type Box = { w: number; h: number; fs: number }; // width, height, font scale

// Text grows with the system font size, so every height budget is scaled by it too.
export const boxOf = (info: WidgetInfo): Box => ({
  w: info.width,
  h: info.height,
  fs: Math.max(1, info.screenInfo?.fontScale ?? 1),
});

// Height a line of text takes at the user's font size. Android pads text above and below
// (Michroma most of all), so a line can be taller than the token's lineHeight; budget
// for the padded size so rows drop rather than clip.
const FONT_BOX = 1.4;
export const lineH = (style: { fontSize: number; lineHeight: number }, b: Box) =>
  Math.ceil(Math.max(style.lineHeight, style.fontSize * FONT_BOX) * b.fs);

// How many rows of `rowHeight` (with `gap` between them) fit in `space`.
export const rowsThatFit = (space: number, rowHeight: number, gap: number) =>
  Math.max(0, Math.floor((space + gap) / (rowHeight + gap)));

// Small widgets get a tighter margin so the content has room to breathe.
export const padFor = (b: Box) => (Math.min(b.w, b.h) < 100 ? space[2] : space[4]);

type CardProps = {
  uri?: string; // deep link; without one the tap just opens the app
  label: string; // what a screen reader says for the whole widget
  pad: number;
  children: ReactNode;
  center?: boolean;
};

// The widget itself: surface on the home screen, radius-lg, one tap target.
export function Card({ uri, label, pad, children, center }: CardProps) {
  return (
    <FlexWidget
      clickAction={uri ? 'OPEN_URI' : 'OPEN_APP'}
      clickActionData={uri ? { uri } : undefined}
      accessibilityLabel={label}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: pad,
        flexDirection: 'column',
        ...(center ? { alignItems: 'center', justifyContent: 'center' } : {}),
      }}
    >
      {children}
    </FlexWidget>
  );
}

type TextProps = {
  text: string;
  color?: `#${string}`;
  align?: 'left' | 'center' | 'right';
};

// Uppercase wide label in the display family ("TUESDAY · DAY 2").
export const Label = ({ text, color = colors.inkMuted, align }: TextProps) => (
  <TextWidget
    text={text.toUpperCase()}
    maxLines={1}
    truncate="END"
    style={{
      fontFamily: fonts.display,
      fontSize: type.labelWide.fontSize,
      letterSpacing: type.labelWide.letterSpacing,
      color,
      textAlign: align,
    }}
  />
);

type Style = { fontFamily: string; fontSize: number };

// Text in a token style; one line by default, truncating at the end instead of wrapping.
export const Line = ({
  text,
  color = colors.ink,
  align,
  style,
  lines = 1,
}: TextProps & { style: Style; lines?: number }) => (
  <TextWidget
    text={text}
    maxLines={lines}
    truncate="END"
    style={{ fontFamily: style.fontFamily, fontSize: style.fontSize, color, textAlign: align }}
  />
);

// A label on the left, a value pushed to the right: a stat row.
export function Row({ label, value, b }: { label: string; value: string; b: Box }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: lineH(type.caption, b),
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: space[2],
      }}
    >
      <Line text={label} style={type.caption} color={colors.inkMuted} />
      <FlexWidget style={{ flex: 1, alignItems: 'flex-end' }}>
        <Line text={value} style={type.caption} align="right" />
      </FlexWidget>
    </FlexWidget>
  );
}

// Fills the space between blocks so the last one sits at the bottom.
export const Spacer = () => <FlexWidget style={{ flex: 1 }} />;

// Shown before onboarding (no data yet) and as the quiet fallback if anything goes
// wrong (hint null). A tap opens the app.
export function SetUp({ b, hint = 'Open to set up.' }: { b: Box; hint?: string | null }) {
  return (
    <Card label="Spotter" pad={padFor(b)}>
      <Line text="Spotter" style={type.heading} />
      {hint && <Line text={hint} style={type.caption} color={colors.inkMuted} />}
    </Card>
  );
}
