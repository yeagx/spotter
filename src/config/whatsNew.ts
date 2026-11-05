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
    version: '1.1.0',
    items: [
      {
        title: 'Home screen widgets',
        line: 'Today, your month, a best lift, body and a one-tap Start. Hold your home screen and add them from Widgets.',
      },
    ],
  },
];
