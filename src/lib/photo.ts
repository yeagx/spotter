import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

// Profile photo: picked from the library, cropped square, and copied into the app's own
// documents folder. The picker's file lives in a cache the system may clear, so the
// copy is what profile.photo_uri points at.
export async function pickProfilePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    shape: 'oval',
    quality: 0.8,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const ext = asset.uri.match(/\.(\w{3,4})$/)?.[1]?.toLowerCase() ?? 'jpg';
  const dest = new File(Paths.document, `profile-${Date.now()}.${ext}`);
  await new File(asset.uri).copy(dest);
  return dest.uri;
}

// Removes a photo this app copied, once it's been replaced. Never throws: a stale file
// left behind is harmless.
export function removeProfilePhoto(uri: string | null) {
  if (!uri || !uri.startsWith(Paths.document.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
