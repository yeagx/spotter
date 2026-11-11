import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { notify } from '@/lib/confirm';

// A card (the monthly recap, a session summary) rendered to a PNG, then saved to the
// gallery or handed to the share sheet. `fileName` has no extension and is what the
// image is called in the gallery and wherever it's shared, e.g. "spotter-november-2026".

async function capture(view: RefObject<HostInstance | null>, fileName: string) {
  const tmp = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  const named = new File(Paths.cache, `${fileName}.png`);
  if (named.exists) named.delete();
  await new File(tmp).copy(named);
  return named.uri;
}

// `what` is how the card is named in the notices: "recap", "session card".
export async function saveCard(view: RefObject<HostInstance | null>, fileName: string, what: string) {
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
    await Asset.create(await capture(view, fileName));
    notify('Saved', `Your ${what} is in your photos.`);
  } catch (e) {
    if (__DEV__) console.warn('Card save failed', e);
    notify('Couldn’t save', 'Something went wrong saving the image. Try sharing it instead.');
  }
}

export async function shareCard(view: RefObject<HostInstance | null>, fileName: string, title: string) {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      notify('Can’t share here', 'Sharing isn’t available on this device.');
      return;
    }
    await Sharing.shareAsync(await capture(view, fileName), { mimeType: 'image/png', dialogTitle: title });
  } catch {
    notify('Couldn’t share', 'Something went wrong. Try again.');
  }
}
