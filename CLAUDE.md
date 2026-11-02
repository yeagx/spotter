# Spotter

A quiet gym companion. Your plan, what each exercise looks like, and how your body is changing. Like a good spotter: stays behind you, says little, shows up when it matters.

Not a calorie tracker, not an AI coach, not a bodybuilding app. Simple, minimal, premium.

## How to work with me (Yeager)

- Explain the **why** behind every step, not just the what.
- Keep messages short. No walls of text.
- Work in small milestones. Finish one, show me, then move on.
- **Git:** never add `Co-Authored-By` or `Claude-Session` trailers to commits. Commits carry my authorship only.

## Stack

- **Expo + React Native + TypeScript**, with **expo-router** for screens. One codebase for Android now, iOS later.
- **expo-sqlite** for all data, stored on the phone. No server, no accounts in v1. Works offline in basement gyms.
- **react-native-reanimated** for motion, **expo-haptics** for the tick tap, **react-native-svg** for slanted shapes.
- Fonts: **Michroma** (numbers, labels) and **Manrope** (everything else) via expo-font.

## Distribution (v1)

- Android APK built with EAS (`preview` profile, `buildType: apk`), attached to **GitHub Releases**.
- In-app **Check for updates** (in Profile): call the GitHub API `releases/latest`, compare its tag to the app version, and if newer show the notes and a button that opens the APK download link.
- Version tags follow `vMAJOR.MINOR.PATCH` and must match `version` in app.json.
- Play Store / App Store come later. Keep the bundle id stable now (`com.yeager.spotter` unless I say otherwise) so the move is painless.

## v1 scope

1. **Onboarding (4 steps):** name + optional photo, goal (Get lean / Stay healthy), starting point (weight required; fat %, muscle %, BMR optional), targets (target kg, target fat %, daily calories: estimate or enter own).
2. **Plan:** a named split (e.g. "Full Body") with training days. Each day has a name and exercises with sets, reps (range like `8–12`), rest.
3. **Exercise library:** users **pick** exercises from the bundled library (search + muscle filter, multi-select). Custom exercises allowed but have no demo.
4. **Workout mode:** one exercise at a time, demo loop, set rows with kg × reps pre-filled from last session, tick to complete, rest timer, "locked in." when all sets are done.
5. **Body:** check-ins (weight, BMI, fat, muscle, water, bone, BMR) with normal-range bars, trend chart, daily calorie target.
6. **Monthly recap card:** sessions done vs planned, best lift, new bests, body-fat change (only if 2+ check-ins that month). Save / Share as image.
7. **Profile:** photo, goal, split, units, check for updates.

**Out of scope for v1:** food logging, social feed, AI, streaks, friends leaderboard (v2, ranked by % improvement, not raw weight).

## Exercise library and demos

- Source for launch: **free-exercise-db** (github.com/yuhonas/free-exercise-db), Unlicense / public domain. Each exercise has a JSON record with instructions, muscles, equipment and **2 photos (start and end position)**.
- Bundle only the ~55 curated exercises listed in `design/exercise-list.md`, mapped by hand to free-exercise-db ids. Copy their images into the app (don't hotlink GitHub) so it works offline.
- The demo player alternates the 2 frames (~700ms each) as a silent loop until real clips exist.
- **The player must be source-agnostic:** each exercise has `media: { type: 'frames' | 'video', ... }`. Later, filmed silent MP4 loops (expo-video, muted, looping) replace frames one exercise at a time with no UI change.
- Keep a credit line for free-exercise-db in Profile → About.

## Design

Everything lives in `design/`:
- `brand-book.md` — voice, color rules, type, layout, motion. **Read it before building any screen.**
- `tokens.json` — colors, type scale, spacing, radius. Turn this into `src/theme.ts` and never hardcode values elsewhere.
- `screens/*.dc.html` — the approved mockups. Open them in a browser to see layout and motion. They are references, not code to copy.
- `logo/` — the mark on dark, on light, and transparent.

Key rules:
- Dark only. Ground `#0B0B0B`, cards `#161616`, raised `#222222`. Text white / `#9A9A9A`.
- **Red (`#E70B16`) is rare:** active set, done ticks, primary button, PRs, the logo dot. Small red text uses `#FF4450`.
- Big numbers in Michroma are the hero of every screen.
- **The slant** (logo cut, ~26°) is the one decorative move. Draw slanted bars as SVG polygons cut inside their own box. First bar keeps a straight left edge, last bar a straight right edge, so strips sit flush. Never rotate/skew elements so they overflow their container.
- No visible scrollbars. Use fades at scroll edges. Primary button pinned at the bottom, respecting the safe area. Buttons never shrink (56px primary, 44px min tap target).
- Motion: slow ease-out (`cubic-bezier(.16,1,.3,1)`), staggered entrances, never bouncy. Respect reduce-motion.
- App launch: logo fades in from blur (~0.7s), then Today (or Onboarding on first open). The full "locked in." sequence plays only when starting a workout.

## Data model (SQLite)

- `profile` (name, photo_uri, goal, units, targets, calorie_mode, calorie_target)
- `split` (id, name) → `split_day` (id, split_id, weekday, name, order)
- `exercise` (id, name, muscle, equipment, cues_json, media_json, is_custom)
- `day_exercise` (id, split_day_id, exercise_id, sets, reps_min, reps_max, rest_sec, order)
- `session` (id, split_day_id, started_at, finished_at) → `set_log` (id, session_id, exercise_id, set_index, kg, reps, done_at)
- `checkin` (id, date, weight, bmi, fat, muscle, water, bone, bmr)

Design tables so friends/sync can be added in v2 without migrations that lose data (use stable string ids, timestamps on every row).

## Responsive on every screen (required)

Spotter must look right on every phone and tablet, not just the mockup size (390×844).
- **Never use fixed widths or heights for layout.** Use flex, `useWindowDimensions`, and percentages. Fixed sizes are only for tap targets (44/56px) and icons.
- **Target range:** small phones (360×640, e.g. iPhone SE / small Androids) up to large phones (430×932) and tablets. On widths over 600px, center content in a 480px column.
- **Safe areas:** wrap screens in `react-native-safe-area-context` so nothing hides under notches, punch-hole cameras, or gesture bars.
- **Scale big numbers down on small screens** (e.g. the 56px Workout numeral) so they never wrap or clip; keep them on one line with `adjustsFontSizeToFit` where needed.
- **Respect system font size** (accessibility). Text can grow; layouts must not break when it does.
- **Lock to portrait** in v1 (`orientation: portrait` in app.json). A gym app is used one-handed upright.
- **Content that might not fit scrolls**, with the primary button still pinned at the bottom.
- Before calling any screen done, check it at 360px wide and on a tablet-size width.

## Build order

1. Expo project, theme from tokens, fonts, tab layout (Today / Plan / Body).
2. SQLite schema + seed the exercise library.
3. Plan: edit split, edit day, library picker.
4. Today + Workout mode (logging, rest timer, demo loop).
5. Body check-ins + charts.
6. Onboarding + launch screen.
7. Recap card + share.
8. Profile + GitHub update check + first APK release.
