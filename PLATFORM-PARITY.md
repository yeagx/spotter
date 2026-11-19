# Platform parity

Spotter has to do the same things on Android and iPhone. This file lists everything that behaves differently or only exists on one of them, and what's planned for iOS.

**Rule:** a new feature is built for both platforms, and this file is updated in the same commit.

How iOS is built and tested: there's no Mac and no iPhone on hand. The GitHub Action `.github/workflows/ios-ipa.yml` builds an unsigned IPA on a macOS runner, and a friend installs it with AltStore, SideStore or Sideloadly. So every iOS change has to get through `expo prebuild` (config plugins only, no hand-edited `ios/` folder) and is checked on a real iPhone only through that friend.

Status: **works** = same behaviour on both. **Partial** = there on iOS, but weaker. **Missing** = not on iOS yet. **Apple doesn't allow** = no public iOS API does it; the closest equivalent is proposed.

Last audited: v1.7.2.

## Shared (no platform code)

These are plain React Native / Expo code, so they behave the same on iOS. They've never been run on an iPhone, so they're in the friend's test list anyway.

Onboarding, plan and day editing, exercise library and picker, custom exercises (photo or clip), workout mode (demo loop, set rows, rest timer, "locked in."), leaving and resuming a session, body check-ins and charts, progress photos, monthly recap and session cards, Profile, What's new, fonts, motion, launch animation, SQLite storage.

## Differences

| # | Feature | Android | iOS today | Status | Bringing it to iOS |
|---|---|---|---|---|---|
| 1 | **Home screen widgets** (Today, Month, Best lift, Body, Start, Me, Me small) | `react-native-android-widget`: JSX drawn to a bitmap, refreshed as you train. Loaded only on Android (`index.ts`). | Nothing. | Missing | A WidgetKit extension through **`expo-widgets`** (SDK 58, widgets written in TSX, rendered as SwiftUI, added by its config plugin). The app writes a small JSON snapshot to a shared App Group and asks WidgetKit to reload. Same seven widgets, mapped to iOS sizes (small / medium; Start as a small and a lock-screen widget). |
| 2 | **Best lift: choose the lift** | Reconfigurable widget opens `BestLiftConfig`. | Nothing. | Missing | Widget configuration (an App Intent with a lift picker; iOS 17+). On 16.x it shows your best lift overall. |
| 3 | **Tap a widget, the app opens out of it** | Patched to an activity `PendingIntent` so launchers animate it. | No widgets. | Missing | iOS does this itself once widgets exist. Taps deep-link with `spotter://` (Start opens the workout). |
| 4 | **Workout on the lock screen** (next set, rest end, Log set / Skip rest buttons) | One sticky notification with action buttons, updated as you go (`liveWorkout.ts`). | The same code runs, but iOS has no sticky notifications: it can be swiped away, and the buttons hide behind a long-press. | Partial | A **Live Activity** (lock screen + Dynamic Island), also from `expo-widgets`: exercise, set, a live rest countdown, and Log set / Skip rest buttons (buttons need iOS 17; 16.x shows it without them). The notification version is switched off on iOS. |
| 5 | **Rest's up, phone locked** | Scheduled notification, alarm-clock delivery, own sound, two firm buzzes. | Scheduled notification with the same sound. iOS plays its own single vibration. | Partial | Mark it **Time Sensitive** so it shows on time and through a Focus. Vibration can't be patterned on iOS; the sound and banner carry it. |
| 6 | **Rest's up, app open** | Sound + `Vibration` pattern (two buzzes). | iOS ignores the pattern: one short buzz. | Partial | Use haptics on iOS instead: two strong notification taps, the same rhythm. |
| 7 | **Focus mode** (Do Not Disturb while a session runs) | `NotificationManager.setInterruptionFilter` through the `spotter-media` native module, with Do Not Disturb access. Click on, click off. | Hidden: no native module. | **Apple doesn't allow** | No app can switch Focus or Do Not Disturb. Closest: Spotter runs two Shortcuts the user adds once ("Spotter Focus on" / "off", each one *Set Focus*), through `shortcuts://x-callback-url`. Session start flicks to Shortcuts for about a second and back; that's the cost. Setup in Profile with a one-tap "Add the shortcuts" link. Rest alerts still get through because of #5. |
| 8 | **Music controls** (play, pause, previous, next for any player) | Sends media-button presses (`AudioManager.dispatchMediaKeyEvent`), works with Spotify, YouTube, anything. | Hidden: no native module. | **Apple doesn't allow** for other apps | iOS lets an app control **Apple Music only** (`MPMusicPlayerController.systemMusicPlayer`), which also gives the song and artist. Spotify, YouTube and others can't be controlled from another app. Plan: the strip shows and controls Apple Music; when another app is playing (`AVAudioSession.isOtherAudioPlaying`) it shows "Playing" with no buttons, or stays hidden. Needs a small native module (config-plugin local module) and the Apple Music permission. |
| 9 | **Import from your scale** | Health Connect: weight, body fat, water, bone, BMR (`healthImport.android.ts`). | Hidden (`healthImport.ts` stub). | Missing | **Apple Health** via `@kingstinct/react-native-healthkit` (has a config plugin): weight, body fat %, BMR (from basal energy). Apple Health has no water or bone mass, so those stay manual. |
| 10 | **Install an update** | Profile → Download opens the new APK; Android installs over the old one. | Opens the website's iPhone steps. | **Apple doesn't allow** installing app files | Closest: an **AltStore / SideStore source** (a JSON file on the website listing each release's IPA). Profile → Update then opens AltStore or SideStore on Spotter's page and it updates in place, data kept. Sideloadly users keep the website steps. |
| 11 | **Update check with the app closed** | `expo-background-task` every ~3 h, then one notification. | Same code, but iOS decides when (often rarely, or never if the app is seldom opened). | Partial | Nothing to build: iOS doesn't allow fixed schedules. The check on open still runs. |
| 12 | **Focus mode feedback** (click on, softer click off) | Android's own toggle haptics. | Falls back to a light tap. | Partial | Comes with #7: iOS's rigid and soft impacts for on and off. |
| 13 | **App icon** | Adaptive icon with a monochrome layer (themed icons). | One icon. No dark or tinted version for iOS 18. | Partial | Add `ios.icon` dark and tinted variants in `app.json`. |
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
