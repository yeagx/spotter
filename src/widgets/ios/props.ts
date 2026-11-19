import { colors, radius, size, slant, space, type } from '@/theme';

// What the iPhone widgets are handed. The layout (layout.tsx) runs in the widget
// extension and can't import anything, so the theme travels with the data.

// Names match app.json's expo-widgets list. Not "Body": SwiftUI's widget bundle already
// has a type by that name, and the generated Swift wouldn't compile.
export const IOS_WIDGETS = ['Today', 'Month', 'BestLift', 'BodyStats', 'Start', 'Me', 'MeSmall'] as const;
export type IosWidgetName = (typeof IOS_WIDGETS)[number];

// The fonts by their PostScript names, which is how the widget extension registers them
// (the app copies the files into the shared container, see index.ios.ts).
export const IOS_WIDGET_FONTS = {
  display: 'Michroma-Regular',
  sans500: 'Manrope-Medium',
  sans700: 'Manrope-Bold',
  sans800: 'Manrope-ExtraBold',
} as const;

type Palette = Record<'surface' | 'surfaceClear' | 'raised' | 'ink' | 'muted' | 'red' | 'redText' | 'onRed', string>;

export const iosWidgetTheme = () => ({
  c: {
    surface: colors.surface,
    surfaceClear: `${colors.surface}00`, // the surface at no opacity: the fade's top edge
    raised: colors.surfaceRaised,
    ink: colors.ink,
    muted: colors.inkMuted,
    red: colors.spotterRed,
    redText: colors.redText,
    onRed: colors.onRed,
  } as Palette,
  f: IOS_WIDGET_FONTS,
  slant,
  pad: space[4],
  s1: space[1],
  s2: space[2],
  s3: space[3],
  s4: space[4],
  radius: radius.lg,
  label: type.labelWide.fontSize,
  labelKern: type.labelWide.letterSpacing,
  caption: type.caption.fontSize,
  body: type.body.fontSize,
  bodyStrong: type.bodyStrong.fontSize,
  heading: type.heading.fontSize,
  title: type.title.fontSize,
  numCaption: type.numeralCaption.fontSize,
  numXs: type.numeralXs.fontSize,
  numS: type.numeralS.fontSize,
  numM: type.numeralM.fontSize,
  numL: type.numeralL.fontSize,
  numXl: type.numeralXl.fontSize,
  weekBar: size.weekBar,
  weekBarW: space[3],
  stripThin: size.stripThin,
  stripBar: size.stripBar,
  chip: size.chip,
  chartHistory: size.chartHistory,
  logo: size.logoXs,
  avatarS: size.avatarS,
  avatarM: size.avatarM,
  fade: size.stripBar,
});

export type IosWidgetTheme = ReturnType<typeof iosWidgetTheme>;

export type IosWidgetProps = {
  w: IosWidgetName;
  t: IosWidgetTheme;
  m: Record<string, unknown> | null; // the widget's model from data.ts, with its link as `uri`
  ready: boolean; // false until the app has set up its database
  links: { home: string; editSplit: string };
  lifts?: Record<string, Record<string, unknown>>; // Best lift: every pickable lift by id
  logo?: string | null; // file:// url of the mark in the shared container
};
