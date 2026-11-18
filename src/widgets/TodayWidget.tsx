import { FlexWidget, ListWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { colors, size, space, type } from '@/theme';

import { link, type TodayModel, type WeekBar } from './data';
import { stripSvg } from './svg';
import { Card, Label, Line, SetUp, Spacer, lineH, padFor, rowH, rowsThatFit, scaleFor, type Box, type Scale } from './ui';

// Today (4x2): the day label with the week beside it as seven slanted bars, the day's
// name with a red Start, then every exercise with its last weight in a list that scrolls
// when the day is longer than the widget, and a line at the bottom with the totals. With
// room to spare the type steps up.

const WEEK_BAR_W = space[3];
const WEEK_W = WEEK_BAR_W * 7 + space[1] * 6;
const BAR_COLOR: Record<WeekBar, string> = {
  done: colors.spotterRed,
  today: colors.ink,
  planned: colors.inkMuted,
  rest: colors.surfaceRaised,
};

export function TodayWidget({ m, b }: { m: TodayModel; b: Box }) {
  if (m.kind === 'setup') return <SetUp b={b} />;
  const pad = padFor(b);
  const s = scaleFor(b, WEEK_W * 2);

  if (m.kind === 'noPlan') {
    return (
      <Card uri={link('edit-split')} label="Today. No plan yet." pad={pad}>
        <Label text={m.label} style={s.label} />
        <Spacer />
        <Line text="No plan yet" style={s.title} />
        <Line text="Build your split in Spotter." style={s.row} color={colors.inkMuted} />
      </Card>
    );
  }

  const pillH = s.roomy ? size.chip : size.stripBar;
  const titleH = Math.max(lineH(s.title, b), pillH);
  const listSpace = b.h - pad * 2 - lineH(s.label, b) - space[1] - titleH - space[2];
  const slots = rowsThatFit(listSpace, rowH(s, b), s.gap);

  if (m.kind === 'rest') {
    return (
      <Card uri={link()} label={`${m.label}. ${m.next ?? ''}`} pad={pad}>
        <Header label={m.label} week={m.week} b={b} s={s} />
        <FlexWidget style={{ height: space[1] }} />
        <Line text="Rest day." style={s.title} />
        <Spacer />
        {slots > 0 && m.next && <Line text={m.next} style={s.row} color={colors.inkMuted} />}
      </Card>
    );
  }

  const all = m.exercises.length;
  const summary =
    m.state === 'done'
      ? 'done today. good session.'
      : `${all} ${all === 1 ? 'exercise' : 'exercises'} · ${m.sets} sets`;
  // The list scrolls, so it takes whatever room is left above the summary line (one row
  // of it is the summary's).
  const listRows = slots - 1;

  const pill = m.state === 'done' ? null : m.state === 'resume' ? 'Resume' : 'Start';
  const pillW = pill ? Math.round((pill.length * type.bodyStrong.fontSize * 0.62 + space[4] * 2) * b.fs) : 0;

  return (
    <Card uri={m.uri} label={`${m.label}. ${m.title}. ${summary}`} pad={pad}>
      <Header label={m.label} week={m.week} b={b} s={s} />
      <FlexWidget style={{ height: space[1] }} />
      <FlexWidget style={{ width: 'match_parent', height: titleH, flexDirection: 'row', alignItems: 'center', flexGap: space[3] }}>
        <FlexWidget style={{ flex: 1 }}>
          <Line text={m.title} style={s.title} />
        </FlexWidget>
        {pill && (
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
            <TextWidget
              text={pill}
              maxLines={1}
              style={{ fontFamily: type.bodyStrong.fontFamily, fontSize: type.bodyStrong.fontSize, color: colors.onRed }}
            />
          </FlexWidget>
        )}
      </FlexWidget>
      {listRows > 0 ? (
        // Rows in a list don't take the card's tap, so each one opens the same place.
        <FlexWidget style={{ width: 'match_parent', flex: 1, marginTop: space[2] }}>
          <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
            {m.exercises.map((e, i) => (
              <ExerciseRow key={i} name={e.name} last={e.last} s={s} uri={m.uri} />
            ))}
          </ListWidget>
        </FlexWidget>
      ) : (
        <Spacer />
      )}
      {slots > 0 && (
        <FlexWidget style={{ width: 'match_parent', marginTop: space[1] }}>
          <Line text={summary} style={s.row} color={colors.inkMuted} />
        </FlexWidget>
      )}
    </Card>
  );
}

// Day label on the left, the week on the right. The week goes first if it would crowd
// the label.
function Header({ label, week, b, s }: { label: string; week: WeekBar[]; b: Box; s: Scale }) {
  const pad = padFor(b);
  const showWeek = b.w - pad * 2 - WEEK_W >= WEEK_W;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: space[3] }}>
      <FlexWidget style={{ flex: 1 }}>
        <Label text={label} style={s.label} />
      </FlexWidget>
      {showWeek && (
        <SvgWidget
          svg={stripSvg(week.map((k) => ({ color: BAR_COLOR[k] })), WEEK_W, size.weekBar, space[1])}
          style={{ width: WEEK_W, height: size.weekBar }}
        />
      )}
    </FlexWidget>
  );
}

// Height follows the text (Michroma's numbers sit in a taller box than the names), so a
// weight like "25 kg" is never cut off.
function ExerciseRow({ name, last, s, uri }: { name: string; last: string | null; s: Scale; uri: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: space[2],
        paddingVertical: s.gap / 2,
      }}
    >
      <FlexWidget style={{ flex: 1 }}>
        <Line text={name} style={s.row} />
      </FlexWidget>
      {last && <Line text={last} style={s.num} align="right" />}
    </FlexWidget>
  );
}
