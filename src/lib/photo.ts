import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { notify } from '@/lib/confirm';

// Photos the app keeps (profile picture, progress photos) are copied into the app's own
// documents folder. The picker's file lives in a cache the system may clear, and the
// copy never shows up in the gallery, so progress photos stay private.
async function keep(asset: ImagePicker.ImagePickerAsset | undefined, prefix: string) {
  if (!asset) return null;
  const ext = asset.uri.match(/\.(\w{3,4})$/)?.[1]?.toLowerCase() ?? 'jpg';
  const dest = new File(Paths.document, `${prefix}-${Date.now()}.${ext}`);
  await new File(asset.uri).copy(dest);
  return dest.uri;
}

// Profile photo: picked from the library and cropped square.
export async function pickProfilePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    shape: 'oval',
    quality: 0.8,
  });
  return keep(result.canceled ? undefined : result.assets[0], 'profile');
}

export type PhotoSource = 'camera' | 'library';

// A progress photo, cropped 3:4 (a phone held upright) so any two line up side by side.
export async function pickProgressPhoto(source: PhotoSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.8,
  };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      notify('Camera is off', 'Allow Spotter to use the camera in your phone’s settings, or pick a photo instead.');
      return null;
    }
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return keep(result.canceled ? undefined : result.assets[0], 'progress');
}

// Removes a photo this app copied, once nothing points at it. Never throws: a stale file
// left behind is harmless.
export function removeAppPhoto(uri: string | null | undefined) {
  if (!uri || !uri.startsWith(Paths.document.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
