import type { WidgetInfo } from 'react-native-android-widget';

import { BestLiftWidget } from './BestLiftWidget';
import { BodyWidget } from './BodyWidget';
import { bestLiftModel, bodyModel, meModel, monthModel, startUri, todayModel } from './data';
import { schemaReady, widgetDb } from './db';
import { MeWidget } from './MeWidget';
import { MonthWidget } from './MonthWidget';
import { StartWidget } from './StartWidget';
import { TodayWidget } from './TodayWidget';
import { SetUp, boxOf } from './ui';

// Names match the "widgets" list in app.json.
export const WIDGET_NAMES = ['Today', 'Month', 'BestLift', 'Body', 'Start', 'Me', 'MeSmall'] as const;

export { widgetDb };

export async function renderWidget(name: string, info: WidgetInfo) {
  const b = boxOf(info);
  try {
    const db = await widgetDb();
    if (!(await schemaReady(db))) return <SetUp b={b} />;
    switch (name) {
      case 'Today':
        return <TodayWidget m={await todayModel(db)} b={b} />;
      case 'Month':
        return <MonthWidget m={await monthModel(db)} b={b} />;
      case 'BestLift':
        return <BestLiftWidget m={await bestLiftModel(db, info.widgetId)} b={b} />;
      case 'Body':
        return <BodyWidget m={await bodyModel(db)} b={b} />;
      case 'Start':
        return <StartWidget uri={await startUri(db)} b={b} />;
      case 'Me':
      case 'MeSmall':
        return <MeWidget m={await meModel(db)} b={b} />;
    }
  } catch {
    // Fall through to the quiet card: a widget should never show an error.
  }
  return <SetUp b={b} hint={null} />;
}
