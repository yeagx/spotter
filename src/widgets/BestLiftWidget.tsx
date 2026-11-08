import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { colors, size, space, type } from '@/theme';

import type { BestLiftModel } from './data';
import { stripSvg } from './svg';
import { Card, Label, Line, SetUp, Spacer, lineH, padFor, scaleFor, type Box } from './ui';

// Best lift (2x2): one exercise, its best set, its last six sessions as slanted bars
// (height = top weight that day). The latest bar and "new best" go red only when that
// session set a new best.

export function BestLiftWidget({ m, b }: { m: BestLiftModel; b: Box }) {
  if (m.kind === 'setup') return <SetUp b={b} />;
  const pad = padFor(b);
  const inner = b.w - pad * 2;
  const s = scaleFor(b);
  const hero = s.roomy ? type.numeralL : type.numeralM;

  if (m.kind === 'empty') {
    return (
      <Card uri={m.uri} label={`${m.name ?? 'Best lift'}. No lifts yet.`} pad={pad}>
        <Line text={m.name ?? 'Best lift'} style={s.row} color={colors.inkMuted} />
        <Spacer />
        <Line text="No lifts yet." style={s.roomy ? type.heading : type.bodyStrong} lines={2} />
      </Card>
    );
  }

  // Name, number, then the bars take whatever height is left; "new best" needs a line.
  const used =
    lineH(s.row, b) + space[1] + lineH(hero, b) + (m.newBest ? space[1] + lineH(s.label, b) : 0);
  // A tall widget lets the bars grow, up to twice the in-app chart.
  const barsH = Math.min(size.chartHistory * (s.roomy ? 2 : 1), b.h - pad * 2 - used - space[2]);
  const showBars = barsH >= size.stripThin * 2 && m.history.length > 0;

  const kgs = m.history.map((s) => s.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const last = m.history.length - 1;
  const bars = m.history.map((s, i) => ({
    // A floor of a third keeps light days visible next to heavy ones.
    value: hi > lo ? 1 / 3 + ((2 / 3) * (s.kg - lo)) / (hi - lo) : 1,
    color: i === last && m.newBest ? colors.spotterRed : s.kg === hi ? colors.ink : colors.inkMuted,
  }));

  return (
    <Card uri={m.uri} label={`${m.name}. Best ${m.best}.${m.newBest ? ' New best.' : ''}`} pad={pad}>
      <Line text={m.name} style={s.row} color={colors.inkMuted} />
      <FlexWidget style={{ height: space[1] }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: space[1] }}>
        <TextWidget
          text={m.bestKg}
          maxLines={1}
          style={{ fontFamily: hero.fontFamily, fontSize: hero.fontSize, color: colors.ink }}
        />
        <TextWidget
          text={m.bestRest}
          maxLines={1}
          truncate="END"
          style={{ fontFamily: s.row.fontFamily, fontSize: s.row.fontSize, color: colors.inkMuted }}
        />
      </FlexWidget>
      {m.newBest && (
        <FlexWidget style={{ marginTop: space[1] }}>
          <Label text="new best" color={colors.redText} style={s.label} />
        </FlexWidget>
      )}
      <Spacer />
      {showBars && (
        <SvgWidget svg={stripSvg(bars, inner, barsH, space[1])} style={{ width: inner, height: barsH }} />
      )}
    </Card>
  );
}
