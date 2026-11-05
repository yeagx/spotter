import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { colors, space, type } from '@/theme';

import { link, type BodyModel } from './data';
import { Card, Label, Line, Row, SetUp, Spacer, lineH, padFor, rowsThatFit, type Box } from './ui';

// Body (2x2): the last check-in. Weight is the hero; change, target, fat and muscle
// follow and drop from the bottom when there isn't room.

export function BodyWidget({ m, b }: { m: BodyModel; b: Box }) {
  if (m.kind === 'setup') return <SetUp b={b} />;
  const pad = padFor(b);
  const uri = link('body');

  if (m.kind === 'empty') {
    return (
      <Card uri={uri} label="Body. Add your first check-in." pad={pad}>
        <Label text="Body" />
        <Spacer />
        <Line text="Add your first check-in." style={type.bodyStrong} lines={2} />
      </Card>
    );
  }

  const lines: [string, string][] = [];
  if (m.change) lines.push(['Since last', m.change]);
  if (m.target) lines.push(['Target', m.target]);
  if (m.fat) lines.push(['Fat', m.fat]);
  if (m.muscle) lines.push(['Muscle', m.muscle]);

  const top = lineH(type.labelWide, b) + space[1] + lineH(type.numeralM, b) + space[2];
  const slots = rowsThatFit(b.h - pad * 2 - top, lineH(type.caption, b), space[1]);

  return (
    <Card uri={uri} label={`Body, ${m.date}. ${m.weight} ${m.unit}.`} pad={pad}>
      <Label text={`Body · ${m.date}`} />
      <FlexWidget style={{ height: space[1] }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: space[1] }}>
        <TextWidget
          text={m.weight}
          maxLines={1}
          style={{ fontFamily: type.numeralM.fontFamily, fontSize: type.numeralM.fontSize, color: colors.ink }}
        />
        <TextWidget
          text={m.unit}
          maxLines={1}
          style={{ fontFamily: type.caption.fontFamily, fontSize: type.caption.fontSize, color: colors.inkMuted }}
        />
      </FlexWidget>
      <Spacer />
      {slots > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: space[1] }}>
          {lines.slice(0, slots).map(([label, value]) => (
            <Row key={label} label={label} value={value} b={b} />
          ))}
        </FlexWidget>
      )}
    </Card>
  );
}
