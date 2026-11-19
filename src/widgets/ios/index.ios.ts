import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { createWidget, widgetsDirectory, type Widget } from 'expo-widgets';
import { AppState } from 'react-native';

import { onDataChanged } from '@/db/changes';
import { getProfile } from '@/db/profile';
import type { Weekday } from '@/db/types';
import { weekdayName } from '@/lib/week';

import {
  bestLiftChoices,
  bestLiftOf,
  bodyModel,
  link,
  meModel,
  monthModel,
  startUri,
  todayModel,
  topLiftId,
} from '../data';
import { schemaReady, widgetDb } from '../db';
import { SpotterWidget } from './layout';
import { IOS_WIDGETS, iosWidgetTheme, type IosWidgetName, type IosWidgetProps } from './props';

// iPhone home screen widgets (WidgetKit, through expo-widgets). Loaded from index.ts on
// iOS only. Unlike Android, an iPhone widget can't run the app's code to draw itself:
// the app works out what each one shows (the same models as Android, from data.ts) and
// hands it over, here, whenever the data changes or the app comes back to the front.

type Config = { lift?: string };

const widgets = Object.fromEntries(
  IOS_WIDGETS.map((name) => [name, createWidget<IosWidgetProps, Config>(name, SpotterWidget as never)]),
) as Record<IosWidgetName, Widget<IosWidgetProps, Config>>;

// The fonts and the mark, copied once per launch into the container the widgets share
// with the app (they can't read the app's own files). The extension registers the fonts.
const FONTS: [string, number][] = [
  ['Michroma-Regular', require('@expo-google-fonts/michroma/400Regular/Michroma_400Regular.ttf')],
  ['Manrope-Medium', require('@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf')],
  ['Manrope-Bold', require('@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf')],
  ['Manrope-ExtraBold', require('@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf')],
];
const LOGO = require('../../../assets/logo.png');

let shared: Promise<string | null> | null = null;

// Returns the logo's file:// url in the shared container, or null without one.
function shareAssets(): Promise<string | null> {
  shared ??= (async () => {
    if (!widgetsDirectory) return null;
    const fonts = new Directory(widgetsDirectory, 'fonts');
    if (!fonts.exists) fonts.create({ intermediates: true });
    for (const [name, module] of FONTS) {
      const target = new File(fonts, `${name}.ttf`);
      if (!target.exists) await copyAsset(module, target);
    }
    const logo = new File(widgetsDirectory, 'logo.png');
    if (!logo.exists) await copyAsset(LOGO, logo);
    return logo.uri;
  })().catch(() => {
    shared = null;
    return null;
  });
  return shared;
}

async function copyAsset(module: number, target: File) {
  const [asset] = await Asset.loadAsync(module);
  if (asset.localUri) new File(asset.localUri).copy(target);
}

// The profile photo, copied next to the widgets (or removed when there's none).
function sharePhoto(uri: string | null): string | null {
  if (!widgetsDirectory) return null;
  const copy = new File(widgetsDirectory, 'me.jpg');
  try {
    if (copy.exists) copy.delete();
    if (!uri) return null;
    new File(uri).copy(copy);
    return copy.uri;
  } catch {
    return null;
  }
}

const nextMidnight = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
};

// Redraws every widget from the current data. Widgets not on the home screen cost
// nothing beyond writing their props.
export async function refreshIosWidgets() {
  try {
    const db = await widgetDb();
    const ready = await schemaReady(db);
    const logo = await shareAssets();
    const base = { t: iosWidgetTheme(), ready, logo, links: { home: link(), editSplit: link('edit-split') } };
    const props = (w: IosWidgetName, m: Record<string, unknown> | null, extra = {}): IosWidgetProps => ({
      ...base,
      w,
      m,
      ...extra,
    });
    const profile = ready ? await getProfile(db) : null;
    if (!ready || !profile) {
      for (const name of IOS_WIDGETS) widgets[name].updateSnapshot(props(name, null));
      return;
    }

    // Today: what it is now, then at midnight a card that says the day has moved on
    // (the widget can't work out the new day by itself; opening Spotter does).
    const midnight = nextMidnight();
    const tomorrow = (midnight.getDay() === 0 ? 7 : midnight.getDay()) as Weekday;
    widgets.Today.updateTimeline([
      { date: new Date(), props: props('Today', await todayModel(db)) },
      { date: midnight, props: props('Today', { kind: 'nextDay', label: weekdayName(tomorrow) }) },
    ]);

    const month = await monthModel(db);
    widgets.Month.updateSnapshot(
      props('Month', month.kind === 'month' ? { ...month, uri: link(`recap?month=${month.month}`) } : month),
    );

    // Best lift: the heaviest lift by default, or the one picked in the widget's settings
    // (press and hold → Edit widget). Every pickable lift goes along, the list too.
    const choices = (await bestLiftChoices(db)).slice(0, 40);
    widgets.BestLift.setConfigurationParameterEnum(
      'lift',
      [
        { name: 'Heaviest lift', value: 'top' },
        ...choices.map((ch) => ({ name: ch.name, value: ch.id, subtitle: ch.best ?? undefined })),
      ],
    );
    const lifts: Record<string, Record<string, unknown>> = {};
    for (const ch of choices) lifts[ch.id] = await bestLiftOf(db, profile, ch.id);
    const top = await topLiftId(db);
    const fallback = top ? (lifts[top] ?? (await bestLiftOf(db, profile, top))) : { kind: 'empty', name: null, uri: link() };
    widgets.BestLift.updateSnapshot(props('BestLift', fallback, { lifts }));

    const body = await bodyModel(db);
    widgets.BodyStats.updateSnapshot(props('BodyStats', { ...body, uri: link('body') }));

    widgets.Start.updateSnapshot(props('Start', { kind: 'start', uri: await startUri(db) }));

    const me = await meModel(db);
    const meProps =
      me.kind === 'me' ? { ...me, photo: sharePhoto(me.photo), uri: link('profile') } : me;
    widgets.Me.updateSnapshot(props('Me', meProps));
    widgets.MeSmall.updateSnapshot(props('MeSmall', meProps));
  } catch (e) {
    if (__DEV__) console.warn('iPhone widgets refresh failed', e);
  }
}

// A set logged, a session ended, a check-in saved, the plan or profile changed: redraw.
// Writes come in bursts, so wait for a quiet moment (as on Android).
const QUIET_MS = 600;
let timer: ReturnType<typeof setTimeout> | undefined;
const soon = () => {
  clearTimeout(timer);
  timer = setTimeout(refreshIosWidgets, QUIET_MS);
};
onDataChanged(soon);
AppState.addEventListener('change', (state) => {
  if (state === 'active') soon();
});
soon();
