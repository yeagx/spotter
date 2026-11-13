// What's new, shown once on the first open after an update. Newest first.
//
// Add an entry only when a release brings something people would want to know about;
// a fixes-only release gets no entry and the app says nothing. Keep each item to a
// title and one plain line, in Spotter's voice: short, no hype, no emoji.
// An entry for a version above app.json's is never shown, so notes can be written ahead.

export type WhatsNewItem = { title: string; line: string };
export type WhatsNewEntry = { version: string; items: WhatsNewItem[] };

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    version: '1.5.0',
    items: [
      {
        title: 'Not everything is kg × reps',
        line: 'Treadmill and bike log minutes and distance, a plank logs seconds, crunches just reps. Bests and history follow.',
      },
      {
        title: 'Do another one first',
        line: 'Swap in a workout now lists the rest of today’s session too. Pick one and it moves up; this one comes right after.',
      },
      {
        title: 'Your order',
        line: 'Edit day has Reorder. Move the cardio to the start and every workout follows it.',
      },
    ],
  },
  {
    version: '1.4.0',
    items: [
      {
        title: 'A bigger library',
        line: '79 more exercises, each with a demo: overhead cable extension, deadlift, pec deck, shrugs, chin-up and the rest of the basics.',
      },
      {
        title: 'Your own demos',
        line: 'A custom exercise takes a photo, GIF or short clip from your gallery. It plays silent, on a loop, like the rest.',
      },
      {
        title: 'Swap for today',
        line: 'Machine taken? Tap the arrows beside an exercise in a workout and pick another. Your plan stays as it is.',
      },
      {
        title: 'A note that stays',
        line: 'Seat 4, narrow grip. Write it once on any exercise and it’s there every time you train it.',
      },
      {
        title: 'Plates, worked out',
        line: 'On barbell lifts the workout shows what goes on each side. Tap it to change the bar.',
      },
      {
        title: 'How a lift is going',
        line: 'Each exercise page has its trend and your last sessions, set by set.',
      },
      {
        title: 'A card for today',
        line: 'Finish a session and share it as a card: what you moved, each top set, new bests in red.',
      },
      {
        title: 'From your scale',
        line: 'On Check in, Fill from Health Connect brings in your latest weigh-in. Android only.',
      },
      {
        title: 'A little more feel',
        line: 'Ticks draw themselves, numbers run up, charts draw in, and the app taps back when you press.',
      },
    ],
  },
  {
    version: '1.3.0',
    items: [
      {
        title: 'Rest that finds you',
        line: 'When a rest ends with your phone locked or in a pocket, a short sound and a buzz tell you. Choose sound, vibrate or off in Profile.',
      },
      {
        title: 'Your rest, your call',
        line: 'Set the rest between sets and between exercises in Profile → Rest timer.',
      },
      {
        title: 'A day that slipped by',
        line: 'Didn’t make it in? That day stays open until the week ends. On a rest day it becomes your session; on a training day it waits under today’s.',
      },
      {
        title: 'What it works',
        line: 'Every exercise shows exactly what it targets, when you pick it and while you train. Search finds muscles too: try "quads".',
      },
      {
        title: 'Fewer sets is fine',
        line: 'Tap a set number in a workout to remove that set, ticked or not. Your plan stays as it is.',
      },
    ],
  },
  {
    version: '1.2.0',
    items: [
      {
        title: 'Updates find you',
        line: 'Spotter checks for a new version once a day. When there is one, a small dot shows on your picture; the update waits in Profile.',
      },
    ],
  },
  {
    version: '1.1.0',
    items: [
      {
        title: 'Home screen widgets',
        line: 'Today, your month, a best lift, body and a one-tap Start. Hold your home screen and add them from Widgets.',
      },
    ],
  },
];
