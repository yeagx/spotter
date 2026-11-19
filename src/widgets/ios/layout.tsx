import {
  Capsule,
  Circle,
  HStack,
  Image,
  Rectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  clipShape,
  clipped,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  offset,
  padding,
  resizable,
  rotationEffect,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { IosWidgetProps } from './props';

// The iPhone home screen widgets, drawn by SwiftUI (expo-widgets) from the same models as
// the Android ones (src/widgets/data.ts). The app works out what each shows and passes it
// in as props; this function only lays it out.
//
// It runs inside the widget extension, in its own small JS runtime: no imports, no
// module-level values, nothing from the app. That's why every helper lives inside it and
// the theme (colours, fonts, sizes from src/theme.ts) arrives in props.t. One function
// serves all seven widgets, switching on props.w, so the helpers exist once.
export function SpotterWidget(props: IosWidgetProps, env: WidgetEnvironment<{ lift?: string }>) {
  'widget';
  const t = props.t;
  const c = t.c;
  const fam = env.widgetFamily ?? 'systemMedium';
  const small = fam === 'systemSmall';
  const roomy = fam === 'systemLarge' || fam === 'systemExtraLarge';
  // Width inside the padding, from the smallest iPhone sizes of each family. Only used
  // to cap the slant on narrow bars; layout itself is SwiftUI's.
  const innerW = (small ? 148 : 321) - t.pad * 2;

  // ---------- text ----------
  const txt = (s: string, family: string, size: number, color: string, extra: unknown[] = []) => (
    <Text modifiers={[font({ family, size }), foregroundStyle(color), lineLimit(1), ...(extra as never[])]}>{s}</Text>
  );
  const label = (s: string, color = c.muted, size = roomy ? t.label + 1 : t.label) =>
    txt(s.toUpperCase(), t.f.display, size, color, [kerning(t.labelKern)]);
  const row = (s: string, color = c.ink) => txt(s, t.f.sans500, roomy ? t.body : t.caption, color);
  const num = (s: string, color = c.ink) => txt(s, t.f.display, roomy ? t.numXs : t.numCaption, color);
  const hero = (s: string, size: number) => txt(s, t.f.display, size, c.ink, [minimumScaleFactor(0.5)]);
  const fill = frame({ maxWidth: Infinity, alignment: 'leading' });

  // A label on the left, a value pushed right.
  const stat = (k: string, v: string) => (
    <HStack key={k} spacing={t.s2}>
      {row(k, c.muted)}
      <Spacer />
      {row(v)}
    </HStack>
  );

  // ---------- the slant ----------
  // A bar cut inside its own box, like the app's polygons (lib/slant.ts): a slanted left
  // edge drops the top-left corner, a slanted right edge the bottom-right one. SwiftUI
  // here has no polygons, so each cut is a surface-coloured block turned to the same
  // angle and laid over the corner, and the bar is clipped to its box: nothing is drawn
  // outside it.
  const bar = (key: string, color: string, h: number, cut: number, left: boolean, right: boolean, w?: number) => {
    const deg = (Math.atan(cut / h) * 180) / Math.PI;
    const cos = Math.cos(Math.atan(cut / h));
    const D = h * 2 + cut;
    const L = h * 3 + D;
    const block = (x: number) => (
      <Rectangle
        modifiers={[
          foregroundStyle(c.surface),
          frame({ width: D, height: L }),
          rotationEffect(deg),
          offset({ x }),
          frame({ width: 0, height: 0 }),
        ]}
      />
    );
    const size = w ? frame({ width: w, height: h }) : frame({ height: h });
    return (
      <ZStack key={key} alignment="trailing" modifiers={[size, ...(w ? [] : [frame({ maxWidth: Infinity })]), clipped()]}>
        <ZStack alignment="leading">
          <Rectangle modifiers={[foregroundStyle(color), size, ...(w ? [] : [frame({ maxWidth: Infinity })])]} />
          {left && cut > 0 ? block(cut / 2 - D / (2 * cos)) : null}
        </ZStack>
        {right && cut > 0 ? block(-cut / 2 + D / (2 * cos)) : null}
      </ZStack>
    );
  };
  // A row of bars, bottom-aligned, `values` 0..1 of `h`. Straight outer edges so the strip
  // sits flush. `barW` fixes each bar's width (the week); otherwise they share `width`.
  const strip = (colors: string[], h: number, gap: number, width: number, values?: number[], barW?: number) => {
    const n = colors.length;
    const w = barW ?? (width - gap * (n - 1)) / Math.max(1, n);
    return (
      <HStack spacing={gap} alignment="bottom">
        {colors.map((col, i) => {
          const bh = Math.max(1, h * (values ? values[i] : 1));
          return bar(`b${i}`, col, bh, Math.min(bh * t.slant, w * 0.34), i > 0, i < n - 1, barW);
        })}
      </HStack>
    );
  };
  const weekColor = (k: string) => (k === 'done' ? c.red : k === 'today' ? c.ink : k === 'planned' ? c.muted : c.raised);
  const week = (bars: string[]) => strip(bars.map(weekColor), t.weekBar, t.s1, 0, undefined, t.weekBarW);

  // ---------- the card ----------
  const card = (uri: string | null, children: unknown, center = false) => (
    <VStack
      alignment={center ? 'center' : 'leading'}
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: center ? 'center' : 'topLeading' }),
        padding({ all: small ? t.pad - t.s1 : t.pad }),
        background(c.surface),
        containerBackground(c.surface, 'widget'),
        ...(uri ? [widgetURL(uri)] : []),
      ]}
    >
      {children as never}
    </VStack>
  );
  const setup = (hint: string | null) =>
    card(
      null,
      <>
        {txt('Spotter', t.f.sans700, t.heading, c.ink)}
        {hint ? row(hint, c.muted) : null}
      </>,
    );
  const gap = (h: number) => <Spacer modifiers={[frame({ height: h })]} />;
  const pill = (s: string, h: number) => (
    <Text
      modifiers={[
        font({ family: t.f.sans700, size: t.bodyStrong }),
        foregroundStyle(c.onRed),
        lineLimit(1),
        padding({ horizontal: t.s4 }),
        frame({ height: h }),
        background(c.red),
        clipShape('capsule'),
      ]}
    >
      {s}
    </Text>
  );

  const m = props.m as Record<string, any> | null;
  if (!m || m.kind === 'setup') return setup(props.ready === false ? null : 'Open to set up.');

  // ---------- Today ----------
  if (props.w === 'Today') {
    // Past midnight the app hasn't been opened yet, so the day it last saw is over.
    if (m.kind === 'nextDay') {
      return card(
        props.links.home,
        <>
          {label(m.label)}
          <Spacer />
          {txt('Tap for today’s session.', t.f.sans700, roomy ? t.title : t.heading, c.ink, [lineLimit(2)])}
        </>,
      );
    }
    if (m.kind === 'noPlan') {
      return card(
        props.links.editSplit,
        <>
          {label(m.label)}
          <Spacer />
          {txt('No plan yet', t.f.sans800, roomy ? t.title : t.heading, c.ink)}
          {row('Build your split in Spotter.', c.muted)}
        </>,
      );
    }
    const header = (
      <HStack spacing={t.s3} modifiers={[fill]}>
        {label(m.labelShort)}
        <Spacer />
        {week(m.week)}
      </HStack>
    );
    if (m.kind === 'rest') {
      return card(
        props.links.home,
        <>
          {header}
          {gap(t.s1)}
          {txt('Rest day.', t.f.sans800, roomy ? t.title : t.heading, c.ink)}
          <Spacer />
          {m.next ? row(m.next, c.muted) : null}
        </>,
      );
    }
    const all = m.exercises.length as number;
    const summary =
      m.state === 'done' ? 'done today. good session.' : `${all} ${all === 1 ? 'exercise' : 'exercises'} · ${m.sets} sets`;
    const button = m.state === 'done' ? null : m.state === 'resume' ? 'Resume' : 'Start';
    // About this many rows fit above the totals line; past it the list fades out at the
    // bottom like the app's scroll edges (it can't scroll: widgets don't).
    const fits = roomy ? 9 : 3;
    const shown = (m.exercises as { name: string; last: string | null }[]).slice(0, fits + 1);
    return card(
      m.uri,
      <>
        {header}
        {gap(t.s1)}
        <HStack spacing={t.s3} modifiers={[fill]}>
          {txt(m.title, t.f.sans800, roomy ? t.title : t.heading, c.ink)}
          <Spacer />
          {button ? pill(button, roomy ? t.chip : t.stripBar) : null}
        </HStack>
        {gap(t.s2)}
        <ZStack alignment="bottom" modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }), clipped()]}>
          <VStack spacing={roomy ? t.s1 : 2} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
            {shown.map((e, i) => (
              <HStack key={`e${i}`} spacing={t.s2}>
                {row(e.name)}
                <Spacer />
                {e.last ? num(e.last) : null}
              </HStack>
            ))}
          </VStack>
          {all > fits ? (
            <Rectangle
              modifiers={[
                foregroundStyle({
                  type: 'linearGradient',
                  colors: [c.surfaceClear, c.surface],
                  startPoint: { x: 0.5, y: 0 },
                  endPoint: { x: 0.5, y: 1 },
                }),
                frame({ height: t.fade }),
                frame({ maxWidth: Infinity }),
              ]}
            />
          ) : null}
        </ZStack>
        {gap(t.s1)}
        {row(summary, c.muted)}
      </>,
    );
  }

  // ---------- Month ----------
  if (props.w === 'Month') {
    const r = m.recap;
    const total = Math.max(r.planned, r.done);
    const rows: unknown[] = [];
    if (m.best) rows.push(stat('Best lift', m.best));
    rows.push(stat('New bests', String(r.newBests)));
    if (m.fat) rows.push(stat('Body fat', m.fat));
    const bars = Array.from({ length: total }, (_, i) => (i < r.done ? c.red : c.raised));
    return card(
      m.uri,
      <>
        {label(`${m.name} · sessions`)}
        {gap(t.s1)}
        <HStack spacing={t.s2} alignment="bottom" modifiers={[fill]}>
          {hero(String(r.done), roomy ? t.numXl : t.numL)}
          {r.planned > 0 ? txt(`/ ${r.planned}`, t.f.display, roomy ? t.numM : t.numS, c.muted) : null}
          <Spacer />
          {total > 0 ? (
            <VStack modifiers={[frame({ width: innerW * 0.45 }), padding({ bottom: t.s2 })]}>
              {strip(bars, t.weekBar, total > 16 ? 1 : t.s1, innerW * 0.45)}
            </VStack>
          ) : null}
        </HStack>
        <Spacer />
        <VStack spacing={t.s1} modifiers={[fill]}>
          {(roomy ? rows : rows.slice(0, 2)) as never}
        </VStack>
      </>,
    );
  }

  // ---------- Best lift ----------
  if (props.w === 'BestLift') {
    const pick = env.configuration?.lift;
    const lift = (pick && props.lifts?.[pick]) || m;
    if (lift.kind === 'empty') {
      return card(
        lift.uri,
        <>
          {row(lift.name ?? 'Best lift', c.muted)}
          <Spacer />
          {txt('No lifts yet.', t.f.sans700, roomy ? t.heading : t.bodyStrong, c.ink)}
        </>,
      );
    }
    const kgs = (lift.history as { kg: number }[]).map((s) => s.kg);
    const lo = Math.min(...kgs);
    const hi = Math.max(...kgs);
    const last = kgs.length - 1;
    const colors = kgs.map((kg, i) => (i === last && lift.newBest ? c.red : kg === hi ? c.ink : c.muted));
    const values = kgs.map((kg) => (hi > lo ? 1 / 3 + ((2 / 3) * (kg - lo)) / (hi - lo) : 1));
    return card(
      lift.uri,
      <>
        {row(lift.name, c.muted)}
        {gap(t.s1)}
        <HStack spacing={t.s1} alignment="lastTextBaseline">
          {hero(lift.bestKg, roomy ? t.numL : t.numM)}
          {row(lift.bestRest, c.muted)}
        </HStack>
        {lift.newBest ? gap(t.s1) : null}
        {lift.newBest ? label('new best', c.redText) : null}
        <Spacer />
        {kgs.length > 0 ? strip(colors, small ? t.chartHistory * 0.75 : t.chartHistory, t.s1, innerW, values) : null}
      </>,
    );
  }

  // ---------- Body ----------
  if (props.w === 'BodyStats') {
    if (m.kind === 'empty') {
      return card(
        m.uri,
        <>
          {label('Body')}
          <Spacer />
          {txt('Add your first check-in.', t.f.sans700, t.bodyStrong, c.ink, [lineLimit(2)])}
        </>,
      );
    }
    const rows: unknown[] = [];
    if (m.change) rows.push(stat('Since last', m.change));
    if (m.target) rows.push(stat('Target', m.target));
    if (m.fat) rows.push(stat('Fat', m.fat));
    if (m.muscle) rows.push(stat('Muscle', m.muscle));
    return card(
      m.uri,
      <>
        {label(`Body · ${m.date}`)}
        {gap(t.s1)}
        <HStack spacing={t.s1} alignment="lastTextBaseline">
          {hero(m.weight, small ? t.numM : t.numL)}
          {row(m.unit, c.muted)}
        </HStack>
        <Spacer />
        <VStack spacing={t.s1} modifiers={[fill]}>
          {(small ? rows.slice(0, 2) : rows) as never}
        </VStack>
      </>,
    );
  }

  // ---------- Start ----------
  if (props.w === 'Start') {
    if (fam === 'accessoryCircular') {
      return (
        <ZStack modifiers={[widgetURL(m.uri)]}>
          <Circle modifiers={[foregroundStyle(c.raised)]} />
          {txt('GO', t.f.display, t.numCaption, c.ink)}
        </ZStack>
      );
    }
    return card(
      m.uri,
      <>
        {props.logo ? (
          <Image uiImage={props.logo} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ height: t.logo })]} />
        ) : null}
        {props.logo ? gap(t.s3) : null}
        <Text
          modifiers={[
            font({ family: t.f.display, size: t.label }),
            foregroundStyle(c.onRed),
            lineLimit(1),
            frame({ maxWidth: Infinity }),
            frame({ height: t.stripBar }),
            background(c.red),
            clipShape('capsule'),
          ]}
        >
          START
        </Text>
      </>,
      true,
    );
  }

  // ---------- Me / Me (small) ----------
  if (props.w === 'Me' || props.w === 'MeSmall') {
    const d = small ? t.avatarS * 2 : t.avatarM;
    const photo = (
      <ZStack modifiers={[frame({ width: d, height: d })]}>
        <Circle modifiers={[foregroundStyle(c.raised)]} />
        {m.photo ? (
          <Image
            uiImage={m.photo}
            modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ width: d, height: d }), clipShape('circle')]}
          />
        ) : (
          txt(m.initial, t.f.sans800, d * 0.4, c.ink)
        )}
      </ZStack>
    );
    const bars = Array.from({ length: Math.max(m.planned, m.done) }, (_, i) => (i < m.done ? c.red : c.raised));
    const count = m.planned ? `${m.done} of ${m.planned} this month` : `${m.done} this month`;
    if (small || props.w === 'MeSmall') {
      return card(
        m.uri,
        <>
          {photo}
          {gap(t.s2)}
          {txt(m.name, t.f.sans700, t.bodyStrong, c.ink)}
          {row(count, c.muted)}
          {bars.length > 0 ? gap(t.s2) : null}
          {bars.length > 0 ? strip(bars, t.stripThin, bars.length > 16 ? 1 : 2, innerW) : null}
        </>,
        true,
      );
    }
    const rows: unknown[] = [];
    if (m.best) rows.push(stat('Best', m.best));
    if (m.weight) rows.push(stat('Weight', m.weight));
    rows.push(stat('New bests', String(m.newBests)));
    return card(
      m.uri,
      <HStack spacing={t.s4} alignment="top" modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
        <VStack spacing={t.s2} modifiers={[frame({ width: d })]}>
          {photo}
          {txt(m.planned ? `${m.done}/${m.planned}` : String(m.done), t.f.display, t.numCaption, c.ink)}
          {bars.length > 0 ? strip(bars, t.stripThin, bars.length > 12 ? 1 : 2, d) : null}
        </VStack>
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
          {txt(m.name, t.f.sans800, roomy ? t.title : t.heading, c.ink)}
          {m.subtitle ? row(m.subtitle, c.muted) : null}
          <Spacer />
          <VStack spacing={t.s1}>{(roomy ? rows : rows.slice(0, 2)) as never}</VStack>
        </VStack>
      </HStack>,
    );
  }

  return setup(null);
}
