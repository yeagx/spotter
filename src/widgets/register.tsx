import { AppState } from 'react-native';
import {
  getWidgetInfo,
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
  requestWidgetUpdate,
  requestWidgetUpdateById,
  type WidgetInfo,
} from 'react-native-android-widget';

import { onDataChanged } from '@/db/changes';

import { BestLiftConfig } from './BestLiftConfig';
import { clearBestLiftChoice } from './data';
import { WIDGET_NAMES, renderWidget, widgetDb } from './render';

// Android home screen widgets. Loaded from the entry file (index.ts), only in builds
// that include the native module.

// After a widget is placed, some launchers (OnePlus among them) report its real size a
// moment later. These redraws pick that up, so it never sits shrunk waiting for a tap.
const SETTLE_MS = [1500, 5000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The size a render was queued with can be stale by the time it runs: the first render
// after placing a widget cold-starts JS and can finish after a resize render queued
// behind it. So every render reads the widget's size again, right before drawing.
async function fresh(info: WidgetInfo): Promise<WidgetInfo> {
  try {
    const now = (await getWidgetInfo(info.widgetName)).find((w) => w.widgetId === info.widgetId);
    return now ? { ...info, width: now.width, height: now.height } : info;
  } catch {
    return info;
  }
}

const redraw = (info: WidgetInfo) =>
  requestWidgetUpdateById({
    widgetName: info.widgetName,
    widgetId: info.widgetId,
    renderWidget: (live) => renderWidget(live.widgetName, live),
  }).catch(() => {});

// Android asks for a widget to be drawn when it's added, resized, or on its own
// schedule (updatePeriodMillis in app.json, which is how Today rolls over after midnight).
registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget: draw }) => {
  switch (widgetAction) {
    case 'WIDGET_ADDED': {
      const info = await fresh(widgetInfo);
      draw(await renderWidget(info.widgetName, info));
      for (const ms of SETTLE_MS) {
        await wait(ms);
        await redraw(info);
      }
      break;
    }
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const info = await fresh(widgetInfo);
      draw(await renderWidget(info.widgetName, info));
      break;
    }
    case 'WIDGET_DELETED':
      if (widgetInfo.widgetName === 'BestLift') {
        await clearBestLiftChoice(await widgetDb(), widgetInfo.widgetId).catch(() => {});
      }
      break;
    default:
      // Taps open deep links (OPEN_URI) natively; nothing to handle here.
      break;
  }
});

registerWidgetConfigurationScreen(BestLiftConfig);

// Redraws every placed widget from the current data. Widgets not on the home screen
// cost nothing: Android reports none and nothing renders.
export function refreshWidgets() {
  for (const name of WIDGET_NAMES) {
    requestWidgetUpdate({ widgetName: name, renderWidget: (info) => renderWidget(name, info) }).catch(() => {});
  }
}

// A set logged, a session ended, a check-in saved, the plan or profile changed: redraw.
// Writes come in bursts (saving a day writes every exercise), so wait for a quiet moment.
const QUIET_MS = 600;
let timer: ReturnType<typeof setTimeout> | undefined;
onDataChanged(() => {
  clearTimeout(timer);
  timer = setTimeout(refreshWidgets, QUIET_MS);
});

// Coming back to the app (perhaps the next day) is a cheap moment to catch up. Waits a
// beat so redrawing never competes with the app's own first frames.
AppState.addEventListener('change', (state) => {
  if (state === 'active') setTimeout(refreshWidgets, QUIET_MS);
});
