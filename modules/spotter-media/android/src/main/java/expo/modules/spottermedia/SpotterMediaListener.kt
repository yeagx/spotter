package expo.modules.spottermedia

import android.service.notification.NotificationListenerService

// Present only so the user can grant Spotter Notification access, which is what Android
// asks for before an app may read and control other apps' media sessions. It does
// nothing with notifications themselves.
class SpotterMediaListener : NotificationListenerService()
