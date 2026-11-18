import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, Platform, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { notify } from '@/lib/confirm';

// A card (the monthly recap, a session summary) rendered to a PNG, then saved to the
// gallery or handed to the share sheet. `fileName` has no extension and is what the
// image is called in the gallery and wherever it's shared, e.g. "spotter-november-2026".
// `out` fixes the image's pixel size (a card laid out on a fixed canvas); without it the
// image is the view's own size on this screen.

type Out = { width: number; height: number };
type View = RefObject<HostInstance | null>;

async function capture(view: View, fileName: string, out?: Out) {
  // view-shot takes pixels on Android and points on iOS (where it multiplies by the density).
  const k = Platform.OS === 'android' ? 1 : PixelRatio.get();
  const px = out && { width: Math.round(out.width / k), height: Math.round(out.height / k) };
  const tmp = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile', ...px });
  const named = new File(Paths.cache, `${fileName}.png`);
  if (named.exists) named.delete();
  await new File(tmp).copy(named);
  return named.uri;
}

// `what` is how the card is named in the notices: "recap", "session card".
export async function saveCard(view: View, fileName: string, what: string, out?: Out) {
  try {
    // Android 10+ lets an app add its own image to the gallery with no permission at
    // all, so only older Android and iOS (add-only) are asked.
    const needsPermission = Platform.OS !== 'android' || Number(Platform.Version) < 29;
    if (needsPermission) {
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        notify('Can’t save yet', 'Allow Spotter to add photos in your phone’s settings, then try again.');
        return;
      }
    }
    await Asset.create(await capture(view, fileName, out));
    notify('Saved', `Your ${what} is in your photos.`);
  } catch (e) {
    if (__DEV__) console.warn('Card save failed', e);
    notify('Couldn’t save', 'Something went wrong saving the image. Try sharing it instead.');
  }
}

export async function shareCard(view: View, fileName: string, title: string, out?: Out) {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      notify('Can’t share here', 'Sharing isn’t available on this device.');
      return;
    }
    await Sharing.shareAsync(await capture(view, fileName, out), { mimeType: 'image/png', dialogTitle: title });
  } catch {
    notify('Couldn’t share', 'Something went wrong. Try again.');
  }
}
