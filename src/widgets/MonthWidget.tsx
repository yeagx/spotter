import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { colors, size, space, type } from '@/theme';

import { link, type MonthModel } from './data';
import { stripSvg } from './svg';
import { Card, Label, Row, SetUp, Spacer, lineH, padFor, rowsThatFit, type Box } from './ui';

// Month (4x2): sessions done against planned as a big number with a strip beside it
// (one bar per planned session, red once done), then best lift, new bests and body-fat
// change. Stat rows drop from the bottom when the widget is short.

// Room the "9 / 18" takes before the strip starts; the strip fills the rest.
const NUMBER_W_PER_CHAR = type.numeralL.fontSize * 0.9;

export function MonthWidget({ m, b }: { m: MonthModel; b: Box }) {
  if (m.kind === 'setup') return <SetUp b={b} />;
  const pad = padFor(b);
  const inner = b.w - pad * 2;
  const { recap } = m;

  const rows: [string, string][] = [];
  if (m.best) rows.push(['Best lift', m.best]);
  rows.push(['New bests', String(recap.newBests)]);
  if (m.fat) rows.push(['Body fat', m.fat]); // only with two or more check-ins

  const heroH = lineH(type.numeralL, b);
  const top = lineH(type.labelWide, b) + space[1] + heroH + space[3];
  const slots = rowsThatFit(b.h - pad * 2 - top, lineH(type.caption, b), space[1]);

  const total = Math.max(recap.planned, recap.done);
  const numberW =
    String(recap.done).length * NUMBER_W_PER_CHAR * b.fs +
    (recap.planned ? (String(recap.planned).length + 2) * type.numeralS.fontSize * 0.9 * b.fs : 0);
  const stripW = Math.floor(inner - numberW - space[4]);
  const bars = Array.from({ length: total }, (_, i) => ({
    color: i < recap.done ? colors.spotterRed : colors.surfaceRaised,
  }));
  // Long months on a narrow widget: thinner gaps so bars stay visible; no room, no strip.
  const gap = total > 1 && (stripW - space[1] * (total - 1)) / total < space[1] ? 1 : space[1];
  const showStrip = total > 0 && stripW >= total * 2;

  const sessions = recap.planned ? `${recap.done} of ${recap.planned} sessions` : `${recap.done} sessions`;

  return (
    <Card uri={link(`recap?month=${m.month}`)} label={`${m.name}. ${sessions}.`} pad={pad}>
      <Label text={`${m.name} · sessions`} />
      <FlexWidget style={{ height: space[1] }} />
      <FlexWidget style={{ width: 'match_parent', height: heroH, flexDirection: 'row', alignItems: 'flex-end', flexGap: space[2] }}>
        <TextWidget
          text={String(recap.done)}
          maxLines={1}
          style={{ fontFamily: type.numeralL.fontFamily, fontSize: type.numeralL.fontSize, color: colors.ink }}
        />
        {recap.planned > 0 && (
          <TextWidget
            text={`/ ${recap.planned}`}
            maxLines={1}
            style={{ fontFamily: type.numeralS.fontFamily, fontSize: type.numeralS.fontSize, color: colors.inkMuted }}
          />
        )}
        <Spacer />
        {showStrip && (
          <SvgWidget
            svg={stripSvg(bars, stripW, size.weekBar, gap)}
            style={{ width: stripW, height: size.weekBar, marginBottom: space[2] }}
          />
        )}
      </FlexWidget>
      <Spacer />
      {slots > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: space[1] }}>
          {rows.slice(0, slots).map(([label, value]) => (
            <Row key={label} label={label} value={value} b={b} />
          ))}
        </FlexWidget>
      )}
    </Card>
  );
}
