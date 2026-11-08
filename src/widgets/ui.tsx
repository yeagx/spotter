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

type TextToken = { fontFamily: string; fontSize: number; lineHeight: number };

// Height a line of text takes at the user's font size. Android pads a line out to the
// font's full bounding box: Michroma's is 1.77× its size, Manrope's up to 1.55×. Budget
// for that, so rows are dropped rather than clipped (it was cutting the "g" off "kg").
const FONT_BOX = { display: 1.8, sans: 1.55 };
export const lineH = (style: TextToken, b: Box) =>
  Math.ceil(
    Math.max(style.lineHeight, style.fontSize * (style.fontFamily === fonts.display ? FONT_BOX.display : FONT_BOX.sans)) *
      b.fs,
  );

// How many rows of `rowHeight` (with `gap` between them) fit in `space`.
export const rowsThatFit = (space: number, rowHeight: number, gap: number) =>
  Math.max(0, Math.floor((space + gap) / (rowHeight + gap)));

// Small widgets get a tighter margin so the content has room to breathe.
export const padFor = (b: Box) => (Math.min(b.w, b.h) < 100 ? space[2] : space[4]);

// Launchers hand out very different sizes for the same cells: a 4x2 is about 110dp tall
// on some phones and over 250dp on others. A widget with room to spare steps its type up
// one size, so it fills its card instead of leaving the bottom half empty.
const ROOMY_H = 190;
export type Scale = {
  roomy: boolean;
  label: TextToken; // uppercase label
  title: TextToken; // a day's name
  row: TextToken; // list and stat rows
  num: TextToken; // numbers inside rows
  gap: number; // between rows
};
const LABEL_ROOMY = { ...type.labelWide, fontSize: type.labelWide.fontSize + 1, lineHeight: type.labelWide.lineHeight + 2 };
export const scaleFor = (b: Box, minW = 0): Scale =>
  b.h >= ROOMY_H && b.w >= minW
    ? { roomy: true, label: LABEL_ROOMY, title: type.title, row: type.body, num: type.numeralXs, gap: space[1] }
    : { roomy: false, label: type.labelWide, title: type.heading, row: type.caption, num: type.numeralCaption, gap: 0 };

// One row holding both a sans name and a display number is as tall as the taller one.
export const rowH = (s: Scale, b: Box) => Math.max(lineH(s.row, b), lineH(s.num, b));

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
export const Label = ({ text, color = colors.inkMuted, align, style = type.labelWide }: TextProps & { style?: TextToken }) => (
  <TextWidget
    text={text.toUpperCase()}
    maxLines={1}
    truncate="END"
    style={{
      fontFamily: fonts.display,
      fontSize: style.fontSize,
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

// A label on the left, a value pushed to the right: a stat row. Its height follows its
// text, so nothing is cut off at any font size.
export function Row({ label, value, s }: { label: string; value: string; s: Scale }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: space[2] }}>
      <Line text={label} style={s.row} color={colors.inkMuted} />
      <FlexWidget style={{ flex: 1, alignItems: 'flex-end' }}>
        <Line text={value} style={s.row} align="right" />
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
