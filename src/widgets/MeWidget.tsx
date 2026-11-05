import {
  FlexWidget,
  ImageWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type ImageWidgetSource,
} from 'react-native-android-widget';

import { colors, fonts, size, space, type } from '@/theme';

import { link, type MeModel } from './data';
import { ringSvg } from './svg';
import { Card, Line, Row, SetUp, Spacer, lineH, padFor, rowsThatFit, type Box } from './ui';

// Me: the profile photo (or initial) inside a red ring that fills with this month's
// sessions done / planned. The wide one adds name, goal · split and three stats; the
// small one keeps photo, name and "X of Y this month". Stats drop first when short.

const RING = space[1]; // ring stroke

// Under this width the wide layout has no room for its stat column.
const WIDE_MIN_W = size.avatarM * 2 + space[4] * 3;

export function MeWidget({ m, b }: { m: MeModel; b: Box }) {
  if (m.kind === 'setup') return <SetUp b={b} />;
  return b.w >= WIDE_MIN_W ? <Wide m={m} b={b} /> : <Small m={m} b={b} />;
}

type Me = Extract<MeModel, { kind: 'me' }>;

const label = (m: Me) =>
  `${m.name}. ${m.planned ? `${m.done} of ${m.planned}` : m.done} sessions this month.`;

function Wide({ m, b }: { m: Me; b: Box }) {
  const pad = padFor(b);
  const countH = lineH(type.numeralCaption, b);
  const d = Math.min(size.avatarM, b.h - pad * 2 - countH - space[1]);

  const rows: [string, string][] = [];
  if (m.best) rows.push(['Best', m.best]);
  if (m.weight) rows.push(['Weight', m.weight]);
  rows.push(['New bests', String(m.newBests)]);
  const top = lineH(type.heading, b) + lineH(type.caption, b) + space[2];
  const slots = rowsThatFit(b.h - pad * 2 - top, lineH(type.caption, b), space[1]);

  return (
    <Card uri={link('profile')} label={label(m)} pad={pad}>
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'row', flexGap: space[4] }}>
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', flexGap: space[1] }}>
          <Avatar m={m} d={d} />
          <TextWidget
            text={m.planned ? `${m.done}/${m.planned}` : String(m.done)}
            maxLines={1}
            style={{ fontFamily: type.numeralCaption.fontFamily, fontSize: type.numeralCaption.fontSize, color: colors.ink }}
          />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column' }}>
          <Line text={m.name} style={type.heading} />
          {m.subtitle ? <Line text={m.subtitle} style={type.caption} color={colors.inkMuted} /> : null}
          <Spacer />
          {slots > 0 && (
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: space[1] }}>
              {rows.slice(0, slots).map(([k, v]) => (
                <Row key={k} label={k} value={v} b={b} />
              ))}
            </FlexWidget>
          )}
        </FlexWidget>
      </FlexWidget>
    </Card>
  );
}

function Small({ m, b }: { m: Me; b: Box }) {
  const pad = padFor(b);
  const nameH = lineH(type.bodyStrong, b);
  const countH = lineH(type.caption, b);
  // The ring keeps its size; the text lines go before it shrinks below a thumb.
  const room = b.h - pad * 2;
  const withCount = room - nameH - countH - space[2] >= size.avatarS;
  const withName = room - nameH - space[1] >= size.avatarS;
  const textH = (withName ? nameH + space[1] : 0) + (withCount ? countH : 0);
  const d = Math.min(size.avatarM, b.w - pad * 2, room - textH);

  return (
    <Card uri={link('profile')} label={label(m)} pad={pad} center>
      <Avatar m={m} d={d} />
      {withName && <FlexWidget style={{ height: space[1] }} />}
      {withName && <Line text={m.name} style={type.bodyStrong} align="center" />}
      {withCount && (
        <Line
          text={m.planned ? `${m.done} of ${m.planned} this month` : `${m.done} this month`}
          style={type.caption}
          color={colors.inkMuted}
          align="center"
        />
      )}
    </Card>
  );
}

function Avatar({ m, d }: { m: Me; d: number }) {
  const p = Math.max(0, d - (RING + space[1]) * 2); // photo diameter inside the ring
  const progress = m.planned ? m.done / m.planned : 0;
  return (
    <OverlapWidget style={{ width: d, height: d }}>
      <SvgWidget
        svg={ringSvg(d, RING, progress, colors.surfaceRaised, colors.spotterRed)}
        style={{ width: d, height: d }}
      />
      <FlexWidget style={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
        {m.photo ? (
          <ImageWidget
            // A file:// uri: the native side reads local files and scales them to this size,
            // though the TypeScript type only lists the remote and data: forms.
            image={m.photo as unknown as ImageWidgetSource}
            imageWidth={p}
            imageHeight={p}
            radius={p / 2}
            resizeMode="cover"
          />
        ) : (
          <FlexWidget
            style={{
              width: p,
              height: p,
              borderRadius: p / 2,
              backgroundColor: colors.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={m.initial}
              maxLines={1}
              style={{ fontFamily: fonts.sans800, fontSize: Math.round(p * 0.4), color: colors.ink }}
            />
          </FlexWidget>
        )}
      </FlexWidget>
    </OverlapWidget>
  );
}
