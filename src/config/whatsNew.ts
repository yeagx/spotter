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
