import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { isUpdateNotice } from '@/lib/updateNotice';

// Update notices on Today, the screen the app opens on:
// - Notifications not decided yet (a new install, or nobody has started a workout):
//   ask once, so "a new version is out" can reach the phone. Asked again never.
// - Tapping "Spotter vX is out" opens Profile, where the update waits, whether the tap
//   launched the app or brought it back.
export function useUpdateNotices() {
  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((p) => (p.status === 'undetermined' ? Notifications.requestPermissionsAsync() : null))
      .catch(() => {});
  }, []);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!isUpdateNotice(response)) return;
    Notifications.clearLastNotificationResponse(); // handled; don't open it again
    router.push('/profile');
  }, [response]);
}
