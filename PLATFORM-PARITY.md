# Platform parity

Spotter has to do the same things on Android and iPhone. This file lists everything that behaves differently or only exists on one of them, and what's planned for iOS.

**Rule:** a new feature is built for both platforms, and this file is updated in the same commit.

How iOS is built and tested: there's no Mac and no iPhone on hand. The GitHub Action `.github/workflows/ios-ipa.yml` builds an unsigned IPA on a macOS runner, and a friend installs it with AltStore, SideStore or Sideloadly. So every iOS change has to get through `expo prebuild` (config plugins only, no hand-edited `ios/` folder) and is checked on a real iPhone only through that friend.

Status: **works** = same behaviour on both. **Partial** = there on iOS, but weaker. **Missing** = not on iOS yet. **Apple doesn't allow** = no public iOS API does it; the closest equivalent is proposed.

Last audited: v1.7.2. Every row below builds: test IPA from commit `2889741` ([run 44583487410](https://github.com/yeagx/spotter/actions/runs/44583487410)), with the App Group in the app and the widget extension, and HealthKit in the app. Nothing here has been run on an iPhone yet; the test checklist covers each row.

## Shared (no platform code)

These are plain React Native / Expo code, so they behave the same on iOS. They've never been run on an iPhone, so they're in the friend's test list anyway.

Onboarding, plan and day editing, exercise library and picker, custom exercises (photo or clip), workout mode (demo loop, set rows, rest timer, "locked in."), leaving and resuming a session, body check-ins and charts, progress photos, monthly recap and session cards, Profile, What's new, fonts, motion, launch animation, SQLite storage.

## Differences

| # | Feature | Android | iOS today | Status | Bringing it to iOS |
|---|---|---|---|---|---|
| 1 | **Home screen widgets** (Today, Month, Best lift, Body, Start, Me, Me small) | `react-native-android-widget`: JSX drawn to a bitmap, refreshed as you train. Loaded only on Android (`index.ts`). | WidgetKit through `expo-widgets`: one SwiftUI layout for all seven (`src/widgets/ios/layout.tsx`), fed the same models as Android (`data.ts`) by `src/widgets/ios/index.ios.ts` whenever data changes or the app comes forward. Michroma/Manrope and the slanted bars as on Android. Sizes: Today, Month, Me medium/large; Best lift, Body small/medium; Me (small) small; Start small and lock screen. At midnight Today switches to “Tap for today’s session” until the app runs (iOS widgets can't run app code). A patch (`patches/expo-widgets+…`) finds the App Group the sideloader really granted. | Works (untested on iPhone) | Done. |
| 2 | **Best lift: choose the lift** | Reconfigurable widget opens `BestLiftConfig`. | Press and hold → Edit Widget → Lift (Heaviest lift, or any lift you've logged or planned). iOS 17+; on 16.x the widget isn't offered (iOS 16 has no widget settings without a separate Intents extension). | Works on iOS 17+ | Done. |
| 3 | **Tap a widget, the app opens out of it** | Patched to an activity `PendingIntent` so launchers animate it. | iOS zooms the app out of the widget itself. Taps deep-link with `widgetURL` (Start opens the session, Today the day, Body, Month's recap, Me → Profile, Best lift → the exercise). | Works (untested on iPhone) | Done. |
| 4 | **Workout on the lock screen** (next set, rest end, Log set / Skip rest buttons) | One sticky notification with action buttons, updated as you go (`liveWorkoutNotice.ts`). | A **Live Activity** on the lock screen and Dynamic Island (`liveWorkout.ios.ts`, layout `src/widgets/ios/workoutActivity.tsx`): set, exercise, weight × reps, a live rest countdown that turns into “rest’s up.” at the end even with Spotter asleep, and Log set / Skip rest (iOS 17+; 16.x shows it without buttons). Falls back to the notification if Live Activities are off for Spotter. | Works (untested on iPhone) | Done. |
| 5 | **Rest's up, phone locked** | Scheduled notification, alarm-clock delivery, own sound, two firm buzzes. | Scheduled notification with the same sound, on time (iOS doesn't hold local notifications back the way Android battery savers do). One system buzz: iOS doesn't let notifications set a vibration pattern. Through a Focus: Focus mode's setup has you allow Spotter in that Focus (no Time Sensitive entitlement, which free Apple IDs may not be able to sign). | Works (iOS limits the buzz) | Done. |
| 6 | **Rest's up, app open** | Sound + `Vibration` pattern (two buzzes). | Sound + two buzzes, 650 ms apart (`IOS_VIBRATION` in `restAlert.ts`: iOS buzzes are a fixed length and the numbers are pauses, so the Android pattern made four). | Works | Done. |
| 7 | **Focus mode** (Do Not Disturb while a session runs) | `NotificationManager.setInterruptionFilter` through the `spotter-media` native module, with Do Not Disturb access. Click on, click off. | **Apple doesn't allow** apps to switch Focus. The closest: the user adds two shortcuts once (“Spotter Focus On” / “Spotter Focus Off”, each a *Set Focus* action; Profile → Focus mode shows how and opens Shortcuts), and Spotter runs them as a session starts and ends (`focus.ios.ts`, `focusShortcuts.ts`). Shortcuts comes to the front for about a second and hands back through `spotter://focus-back`, which `src/app/+native-intent.tsx` swallows so you stay on the workout. Same rules as Android: only undoes what it did, survives the app closing. A missing shortcut says so. | Partial (Apple's limit) | Done. |
| 8 | **Music controls** (play, pause, previous, next for any player) | Sends media-button presses (`AudioManager.dispatchMediaKeyEvent`), works with Spotify, YouTube, anything. | **Apple doesn't allow** controlling other apps' music. The closest: the same strip and setting for **Apple Music** (`modules/spotter-media/ios`, `MPMusicPlayerController.systemMusicPlayer`), the one player iOS lets an app drive. The strip appears once Apple Music plays; the first press may ask for Apple Music access. The setting says Spotify and YouTube aren't included. | Partial (Apple's limit) | Done. |
| 9 | **Import from your scale** | Health Connect: weight, body fat, water, bone, BMR (`healthImport.android.ts`). | **Apple Health** (`healthImport.ios.ts`, `@kingstinct/react-native-healthkit`, read only): weight, body fat from the same day, and BMR as the day before's energy burned at rest. Apple Health has no water or bone mass, so those stay manual. iOS never says if read access was refused, so that shows as “nothing to bring in” with the Settings path. | Works (untested on iPhone) | Done. |
| 10 | **Install an update** | Profile → Download opens the new APK; Android installs over the old one. | **Apple doesn't allow** an app to install app files. The closest: an **AltStore / SideStore source** at `https://spotter-eg.vercel.app/altstore.json` (built from the GitHub releases by the site's `api/altstore.js`). Added once (links on the website's iPhone section), AltStore or SideStore offers each new version and updates Spotter in place, data kept. Profile → Updates → Get vX opens that section, with the IPA for Sideloadly users. | Works, via AltStore/SideStore | Done. |
| 11 | **Update check with the app closed** | `expo-background-task` every ~3 h, then one notification. | Same code, but iOS decides when (often rarely, or never if the app is seldom opened). | Partial | Nothing to build: iOS doesn't allow fixed schedules. The check on open still runs. |
| 12 | **Focus mode feedback** (click on, softer click off) | Android's own toggle haptics. | A rigid tap then a firmer beat for on, a soft tap for off. | Works | Done. |
| 13 | **App icon** | Adaptive icon with a monochrome layer (themed icons). | `ios.icon` in `app.json`: the usual icon, a dark one (the mark on clear, iOS adds the dark backdrop) and a tinted one (the white mark, which iOS tints), made from the Android layers so the mark is identical. | Works (untested on iPhone) | Done. |
| 14 | **Leave a workout with Back** | Hardware Back = leave, session keeps running. | No Back button; the ↓ button in the header does the same. Swipe-back is off on the workout on purpose. | Works | — |
| 15 | **Save / share a card** | No permission needed (Android 10+). | Asks once for "add to Photos". Size handled in points. | Works (untested) | — |
| 16 | **Back up / restore** | Share sheet → any app; file picker. | Share sheet → Save to Files / AirDrop; the picker accepts any file. | Works (untested) | — |
| 17 | **Rest alerts blocked → open Settings** | Opens app settings. | Opens Spotter in Settings. | Works | — |
| 18 | **Exact alarms, notification channels, blocked permissions** | Needed for on-time alerts. | Not a thing on iOS. | n/a | — |

## Things to know about sideloading

They decide what's possible for #1, #4, #7, #8, #9:

- Each extension is one more App ID. A free Apple ID gets 10 new App IDs a week and 3 sideloaded apps. Widgets and the Live Activity share **one** extension to keep this to two App IDs (app + extension).
- App Groups (widgets), HealthKit, Time Sensitive and Apple Music permission are entitlements that must survive re-signing. AltStore, SideStore and Sideloadly handle these for free accounts, but each one is confirmed on the friend's iPhone before moving on.
- Free Apple ID: the app needs refreshing every 7 days (AltStore/SideStore do it automatically).

## Build order

Smallest risk first, each one its own commit, each one checked by an IPA build:

1. Rest alerts: haptics in-app (#6), Time Sensitive (#5).
2. Widgets (#1–3), sharing one extension with step 3.
3. Live Activity (#4).
4. Apple Health import (#9).
5. Apple Music controls (#8).
6. Focus via Shortcuts (#7, #12).
7. AltStore / SideStore source for updates (#10).
8. iOS 18 icons (#13).
