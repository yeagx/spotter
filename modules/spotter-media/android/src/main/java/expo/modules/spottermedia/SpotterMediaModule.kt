package expo.modules.spottermedia

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.SystemClock
import android.provider.Settings
import android.view.KeyEvent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Music controls and Focus mode, with no special access.
//
// Music: play/pause, next and previous go out as media-button presses, the same thing a
// headset's buttons send, so whichever app is playing (Spotify, YouTube, any player)
// takes them. Android doesn't tell an app what another app is playing without
// Notification access, which makes Play Protect block sideloaded installs, so Spotter
// only asks whether music is playing at all.
//
// Focus mode: Do Not Disturb on and off, once the user allows it.
class SpotterMediaModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is gone" }

  private val audio: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private val notifications: NotificationManager
    get() = context.getSystemService(NotificationManager::class.java)

  override fun definition() = ModuleDefinition {
    Name("SpotterMedia")

    Function("isMusicActive") { audio.isMusicActive }

    Function("sendMediaKey") { action: String ->
      val code = when (action) {
        "play" -> KeyEvent.KEYCODE_MEDIA_PLAY
        "pause" -> KeyEvent.KEYCODE_MEDIA_PAUSE
        "toggle" -> if (audio.isMusicActive) KeyEvent.KEYCODE_MEDIA_PAUSE else KeyEvent.KEYCODE_MEDIA_PLAY
        "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
        "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
        else -> return@Function false
      }
      val now = SystemClock.uptimeMillis()
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0))
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0))
      true
    }

    Function("hasDndAccess") { notifications.isNotificationPolicyAccessGranted }

    Function("openDndSettings") { open(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)) }

    Function("getInterruptionFilter") { notifications.currentInterruptionFilter }

    Function("setInterruptionFilter") { filter: Int ->
      if (!notifications.isNotificationPolicyAccessGranted) return@Function false
      try {
        notifications.setInterruptionFilter(filter)
        true
      } catch (e: SecurityException) {
        false
      }
    }
  }

  private fun open(intent: Intent): Boolean {
    val activity = appContext.currentActivity
    return try {
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      true
    } catch (e: Exception) {
      false
    }
  }
}
