import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { colors, space, type } from '@/theme';

import { link, type BodyModel } from './data';
import { Card, Label, Line, Row, SetUp, Spacer, lineH, padFor, rowsThatFit, scaleFor, type Box } from './ui';

// Body (2x2): the last check-in. Weight is the hero; change, target, fat and muscle
// follow and drop from the bottom when there isn't room.

export function BodyWidget({ m, b }: { m: BodyModel; b: Box }) {
  if (m.kind === 'setup') return <SetUp b={b} />;
  const pad = padFor(b);
  const uri = link('body');
  const s = scaleFor(b);
  const hero = s.roomy ? type.numeralL : type.numeralM;

  if (m.kind === 'empty') {
    return (
      <Card uri={uri} label="Body. Add your first check-in." pad={pad}>
        <Label text="Body" style={s.label} />
        <Spacer />
        <Line text="Add your first check-in." style={s.roomy ? type.heading : type.bodyStrong} lines={2} />
      </Card>
    );
  }

  const lines: [string, string][] = [];
  if (m.change) lines.push(['Since last', m.change]);
  if (m.target) lines.push(['Target', m.target]);
  if (m.fat) lines.push(['Fat', m.fat]);
  if (m.muscle) lines.push(['Muscle', m.muscle]);

  const top = lineH(s.label, b) + space[1] + lineH(hero, b) + space[2];
  const slots = rowsThatFit(b.h - pad * 2 - top, lineH(s.row, b), space[1]);

  return (
    <Card uri={uri} label={`Body, ${m.date}. ${m.weight} ${m.unit}.`} pad={pad}>
      <Label text={`Body · ${m.date}`} style={s.label} />
      <FlexWidget style={{ height: space[1] }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: space[1] }}>
        <TextWidget
          text={m.weight}
          maxLines={1}
          style={{ fontFamily: hero.fontFamily, fontSize: hero.fontSize, color: colors.ink }}
        />
        <TextWidget
          text={m.unit}
          maxLines={1}
          style={{ fontFamily: s.row.fontFamily, fontSize: s.row.fontSize, color: colors.inkMuted }}
        />
      </FlexWidget>
      <Spacer />
      {slots > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: space[1] }}>
          {lines.slice(0, slots).map(([label, value]) => (
            <Row key={label} label={label} value={value} s={s} />
          ))}
        </FlexWidget>
      )}
    </Card>
  );
}
