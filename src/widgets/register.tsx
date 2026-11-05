import { AppState } from 'react-native';
import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
  requestWidgetUpdate,
} from 'react-native-android-widget';

import { onDataChanged } from '@/db/changes';

import { BestLiftConfig } from './BestLiftConfig';
import { clearBestLiftChoice } from './data';
import { WIDGET_NAMES, renderWidget, widgetDb } from './render';

// Android home screen widgets. Loaded from the entry file (index.ts), only in builds
// that include the native module.

// Android asks for a widget to be drawn when it's added, resized, or on its own
// schedule (updatePeriodMillis in app.json, which is how Today rolls over after midnight).
registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget: draw }) => {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      draw(await renderWidget(widgetInfo.widgetName, widgetInfo));
      break;
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

// Coming back to the app (perhaps the next day) is a cheap moment to catch up.
AppState.addEventListener('change', (state) => {
  if (state === 'active') refreshWidgets();
});
