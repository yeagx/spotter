Spotter is a quiet gym companion: your plan, what each exercise looks like, and how your body is changing. Like a good spotter, it stays behind you, says little, and shows up when it matters. Everything here serves that feeling: dark, calm, one red.

## Voice

- Say as little as possible. Short, lowercase-friendly phrases: "locked in.", "good session.", "new best." Never hype ("CRUSH IT!"), never shame ("you missed 3 days").
- Speak to the user as "you". Spotter never says "I".
- No emoji. Numbers do the talking.
- Units always follow the number with `space-1`: "60 kg", "12 reps".

## Color

- Every screen sits on `ground`. Group content on `surface`; put inputs and pressed states on `surface-raised`. Separate by surface, not borders; `hairline` is decorative only.
- `ink` for primary text and numbers, `ink-muted` for labels and secondary text. `ink-faint` is for disabled hints only.
- **Red is rare, so red means "this matters."** Use `spotter-red` only for: the logo dot, the active set, completed set ticks, the primary action, and PR moments. At most one red element competes for attention per view.
- Red text under 24px uses `red-text`; `spotter-red` as text only at 24px and up. Anything on a red fill uses `on-red`.
- Dark theme only in v1.

## Type

- Big numbers are the hero: weights, reps, body stats use `numeral-xl` (Workout mode) or `numeral-l` (cards) in the display family (Michroma, wide like the wordmark).
- Small caps-style labels above numbers use `label-wide`, uppercase, `ink-muted` ("WEIGHT", "REPS").
- Everything else is Manrope: `title` for the screen title, `heading` for exercise names, `body` for text, `caption` for metadata.
- Never set sentences in the display family.

## Shape and layout

- The slant: the logo's cut runs at about 1 across for every 2 down. Reuse it for progress bars, the set-tick strip and button edges. It's the one decorative move; don't add others.
- Cards use `radius-md` with `space-4` padding; set rows and inputs `radius-sm`; sheets and the demo frame `radius-lg`.
- Screen margins `space-4`; `space-6` between sections.
- Three tabs only: Today, Plan, Body.

## Buttons, scrolling and screen sizes

- Buttons never shrink: primary buttons are full width with a fixed 56px height, secondary and icon buttons 44px. Every tap target is at least 44x44px.
- Pin the primary action to the bottom of the screen, above the home indicator (respect the safe area); content scrolls above it.
- Hide all scrollbars. Signal more content with a fade instead: horizontal chip rows fade out on the right edge and bleed to the screen edge; vertical lists fade out above the pinned button.
- Build layouts from flex, never fixed widths: side margins stay `space-4`, content stretches to fill the width. On wide screens (tablets), cap content at 480px and center it.
- Scale type with the system font size setting, but keep numbers on one line.

## Motion and feel

- Slow and weighty, never bouncy. The logo's three beats (focus, support, locked in) play once when a workout starts.
- Ticking a set gives a soft haptic tap and fills the tick in `spotter-red`.

## Iconography

- Thin line icons (1.5px stroke) in `ink-muted`, `ink` when active. No filled or emoji icons. The icon set isn't chosen yet.

## Logo

- Use `spotter-mark-dark.png` on dark grounds and `spotter-mark-light.png` on light grounds. Never recolor or redraw the mark.
