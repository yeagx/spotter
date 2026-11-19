import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { colors, radius, size, space, type } from '@/theme';

import { link, type TodayModel, type WeekBar } from './data';
import { stripSvg } from './svg';
import { Card, Label, Line, SetUp, Spacer, lineH, padFor, rowH, rowsThatFit, scaleFor, type Box, type Scale } from './ui';

// Today (4x2): the day label with the week beside it as seven slanted bars, the day's
// name with a red Start, then as many whole exercises as fit, with last weights, and a
// line at the bottom with the totals. A longer day turns into pages: "1 / 2 ›" at the
// bottom shows the next ones. (Not a scrolling list: on the home screen it fights the
// launcher's swipe up and cuts its last row in half.) With room to spare the type
// steps up.

// What the page tap sends; register.tsx turns it into a redraw on that page.
export const TODAY_PAGE = 'TODAY_PAGE';

const WEEK_BAR_W = space[3];
const WEEK_W = WEEK_BAR_W * 7 + space[1] * 6;
const BAR_COLOR: Record<WeekBar, string> = {
  done: colors.spotterRed,
  today: colors.ink,
  planned: colors.inkMuted,
  rest: colors.surfaceRaised,
};

export function TodayWidget({ m, b, page = 0 }: { m: TodayModel; b: Box; page?: number }) {
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
  // The bottom line (totals, and the page button) is a touch taller than a row; what's
  // left above it holds whole exercises, a page at a time.
  const bottomH = Math.max(rowH(s, b), PAGE_TAP);
  const perPage = rowsThatFit(listSpace - bottomH - s.gap, rowH(s, b), s.gap);
  const pages = perPage > 0 ? Math.ceil(all / perPage) : 1;
  const at = pages > 0 ? page % pages : 0;
  const shown = m.exercises.slice(at * perPage, at * perPage + perPage);

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
      {shown.length > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: s.gap, marginTop: space[2] }}>
          {shown.map((e, i) => (
            <ExerciseRow key={i} name={e.name} last={e.last} s={s} />
          ))}
        </FlexWidget>
      )}
      <Spacer />
      {listSpace >= bottomH && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: space[3] }}>
          <FlexWidget style={{ flex: 1 }}>
            <Line text={summary} style={s.row} color={colors.inkMuted} />
          </FlexWidget>
          {pages > 1 && (
            // Its own tap: flips the page instead of opening the app.
            <FlexWidget
              clickAction={TODAY_PAGE}
              clickActionData={{ page: at + 1 }}
              accessibilityLabel={`Page ${at + 1} of ${pages}. Show the next exercises.`}
              style={{
                height: Math.max(rowH(s, b), PAGE_TAP),
                paddingHorizontal: space[3],
                borderRadius: radius.md,
                backgroundColor: colors.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Line text={`${at + 1} / ${pages}  ›`} style={s.num} />
            </FlexWidget>
          )}
        </FlexWidget>
      )}
    </Card>
  );
}

// The page button: a comfortable thumb target on a home screen, as tall as the room allows.
const PAGE_TAP = size.stripBar;

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
