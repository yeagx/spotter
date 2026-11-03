import { showDialog } from '@/components/DialogHost';

type Options = { title: string; message: string; confirmLabel: string; cancelLabel?: string };

// Asks before a destructive step, in Spotter's own dialog. Resolves true only if the
// user confirms; tapping outside or pressing back counts as "no".
export async function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep',
}: Options): Promise<boolean> {
  const index = await showDialog({
    title,
    message,
    actions: [
      { label: cancelLabel, kind: 'neutral' },
      { label: confirmLabel, kind: 'primary' },
    ],
  });
  return index === 1;
}

// A plain notice with one button, e.g. a save that failed.
export async function notify(title: string, message: string): Promise<void> {
  await showDialog({ title, message, actions: [{ label: 'OK', kind: 'neutral' }] });
}
