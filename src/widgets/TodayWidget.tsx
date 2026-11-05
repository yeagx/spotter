import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { colors, size, space, type } from '@/theme';

import { link, type TodayModel, type WeekBar } from './data';
import { stripSvg } from './svg';
import { Card, Label, Line, SetUp, lineH, padFor, rowsThatFit, type Box } from './ui';

// Today (4x2): the day label with the week beside it as seven slanted bars, the day's
// name with a red Start, then its first exercises with last weights and a count of the
// rest. List rows drop from the bottom when the widget is short.

const PILL_H = size.stripBar;
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

  if (m.kind === 'noPlan') {
    return (
      <Card uri={link('edit-split')} label="Today. No plan yet." pad={pad}>
        <Label text={m.label} />
        <Line text="No plan yet" style={type.heading} />
        <Line text="Build your split in Spotter." style={type.caption} color={colors.inkMuted} />
      </Card>
    );
  }

  const titleH = Math.max(lineH(type.heading, b), PILL_H);
  const listSpace = b.h - pad * 2 - lineH(type.labelWide, b) - space[1] - titleH - space[2];
  const slots = rowsThatFit(listSpace, lineH(type.caption, b), 0);

  if (m.kind === 'rest') {
    return (
      <Card uri={link()} label={`${m.label}. ${m.next ?? ''}`} pad={pad}>
        <Header label={m.label} week={m.week} b={b} />
        <FlexWidget style={{ height: space[1] }} />
        <Line text="Rest day." style={type.heading} />
        {slots > 0 && m.next && <Line text={m.next} style={type.caption} color={colors.inkMuted} />}
      </Card>
    );
  }

  // Up to three exercises, then "+N more · X sets". Short on room, exercises go first
  // and the summary keeps count of what's hidden.
  const max = Math.min(3, m.exercises.length);
  const shown = slots >= max + 1 ? max : Math.max(0, slots - 1);
  const more = m.exercises.length - shown;
  const summary =
    m.state === 'done'
      ? 'done today. good session.'
      : more > 0
        ? `+${more} more · ${m.sets} sets`
        : `${m.sets} sets`;

  const pill = m.state === 'done' ? null : m.state === 'resume' ? 'Resume' : 'Start';
  const pillW = pill ? Math.round((pill.length * type.bodyStrong.fontSize * 0.62 + space[4] * 2) * b.fs) : 0;

  return (
    <Card uri={m.uri} label={`${m.label}. ${m.title}. ${summary}`} pad={pad}>
      <Header label={m.label} week={m.week} b={b} />
      <FlexWidget style={{ height: space[1] }} />
      <FlexWidget style={{ width: 'match_parent', height: titleH, flexDirection: 'row', alignItems: 'center', flexGap: space[3] }}>
        <FlexWidget style={{ flex: 1 }}>
          <Line text={m.title} style={type.heading} />
        </FlexWidget>
        {pill && (
          <FlexWidget
            style={{
              width: pillW,
              height: PILL_H,
              borderRadius: PILL_H / 2,
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
      {slots > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: space[2] }}>
          {m.exercises.slice(0, shown).map((e, i) => (
            <ExerciseRow key={i} name={e.name} last={e.last} b={b} />
          ))}
          <Line text={summary} style={type.caption} color={colors.inkMuted} />
        </FlexWidget>
      )}
    </Card>
  );
}

// Day label on the left, the week on the right. The week goes first if it would crowd
// the label.
function Header({ label, week, b }: { label: string; week: WeekBar[]; b: Box }) {
  const pad = padFor(b);
  const showWeek = b.w - pad * 2 - WEEK_W >= WEEK_W;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: space[3] }}>
      <FlexWidget style={{ flex: 1 }}>
        <Label text={label} />
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

function ExerciseRow({ name, last, b }: { name: string; last: string | null; b: Box }) {
  return (
    <FlexWidget style={{ width: 'match_parent', height: lineH(type.caption, b), flexDirection: 'row', alignItems: 'center', flexGap: space[2] }}>
      <FlexWidget style={{ flex: 1 }}>
        <Line text={name} style={type.caption} />
      </FlexWidget>
      {last && <Line text={last} style={type.numeralCaption} align="right" />}
    </FlexWidget>
  );
}
