import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { colors, size, space, type } from '@/theme';

import { link, type TodayModel, type WeekBar } from './data';
import { stripSvg } from './svg';
import { Card, Label, Line, SetUp, Spacer, lineH, padFor, rowH, rowsThatFit, scaleFor, type Box, type Scale } from './ui';

// Today (4x2): the day label with the week beside it as seven slanted bars, the day's
// name with a red Start, then the day's exercises with last weights, and a line at the
// bottom with the totals.
//
// The exercises fill whatever room the widget has; a longer day runs on under a fade at
// the bottom edge, like the app's own scroll edges. It doesn't scroll: some launchers
// (OnePlus among them) take every swipe for themselves, and a widget can't stop them, so
// a list that scrolls on one phone would fight the app drawer on another. A tap opens
// the day in Spotter, everywhere. With room to spare the type steps up.

// The surface colour at no opacity, for the fade's top edge.
const SURFACE_CLEAR = 'rgba(22, 22, 22, 0)';

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
        <Header label={m.label} short={m.labelShort} week={m.week} b={b} s={s} />
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
  // Room left for exercises above the totals line. The rows are drawn as they are and
  // clipped by the box; the fade only goes on when the day runs past it, so a short day
  // never has its last row dimmed.
  const roomForRows = listSpace - rowH(s, b) - space[1];
  const overflows = all * (rowH(s, b) + s.gap) - s.gap > roomForRows;

  const pill = m.state === 'done' ? null : m.state === 'resume' ? 'Resume' : 'Start';
  const pillW = pill ? Math.round((pill.length * type.bodyStrong.fontSize * 0.62 + space[4] * 2) * b.fs) : 0;

  return (
    <Card uri={m.uri} label={`${m.label}. ${m.title}. ${summary}`} pad={pad}>
      <Header label={m.label} short={m.labelShort} week={m.week} b={b} s={s} />
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
      {slots > 1 && all > 0 ? (
        <FlexWidget style={{ width: 'match_parent', flex: 1, marginTop: space[2], overflow: 'hidden' }}>
          <OverlapWidget style={{ width: 'match_parent', height: 'match_parent', overflow: 'hidden' }}>
            <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', flexGap: s.gap }}>
              {m.exercises.map((e, i) => (
                <ExerciseRow key={i} name={e.name} last={e.last} s={s} />
              ))}
            </FlexWidget>
            {overflows && (
              <FlexWidget style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'flex-end' }}>
                <FlexWidget
                  style={{
                    width: 'match_parent',
                    height: rowH(s, b) + s.gap,
                    backgroundGradient: { from: SURFACE_CLEAR, to: colors.surface, orientation: 'TOP_BOTTOM' },
                  }}
                />
              </FlexWidget>
            )}
          </OverlapWidget>
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
function Header({ label, short, week, b, s }: { label: string; short: string; week: WeekBar[]; b: Box; s: Scale }) {
  const pad = padFor(b);
  const showWeek = b.w - pad * 2 - WEEK_W >= WEEK_W;
  // "THURSDAY · DAY 4" doesn't fit beside the week on most 4x2s; "THU · DAY 4" does.
  const room = b.w - pad * 2 - (showWeek ? WEEK_W + space[3] : 0);
  const text = labelWidth(label, s, b) <= room ? label : short;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: space[3] }}>
      <FlexWidget style={{ flex: 1 }}>
        <Label text={text} style={s.label} />
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

// Michroma is wide: a capital runs close to its font size, plus the label's tracking.
const labelWidth = (text: string, s: Scale, b: Box) =>
  text.length * (s.label.fontSize * 0.95 + type.labelWide.letterSpacing) * b.fs;

// Height follows the text (Michroma's numbers sit in a taller box than the names), so a
// weight like "25 kg" is never cut off.
function ExerciseRow({ name, last, s }: { name: string; last: string | null; s: Scale }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: space[2] }}>
      <FlexWidget style={{ flex: 1 }}>
        <Line text={name} style={s.row} />
      </FlexWidget>
      {last && <Line text={last} style={s.num} align="right" />}
    </FlexWidget>
  );
}
