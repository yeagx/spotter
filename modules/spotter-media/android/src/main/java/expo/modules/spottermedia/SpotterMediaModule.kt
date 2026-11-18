package expo.modules.spottermedia

import android.app.ActivityOptions
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

// What's playing in other apps (Spotify, YouTube Music, YouTube, anything with a media
// session) and its controls, so a session can stay inside Spotter. Needs Notification
// access for SpotterMediaListener; without it everything here reports "nothing".
// Also Focus mode's Do Not Disturb switch.
class SpotterMediaModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is gone" }

  private val main = Handler(Looper.getMainLooper())
  private val watched = mutableListOf<MediaController>()
  private var observing = false
  private var artKey: String? = null
  private var artUri: String? = null

  private val sessions: MediaSessionManager
    get() = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager

  private val notifications: NotificationManager
    get() = context.getSystemService(NotificationManager::class.java)

  private val listener: ComponentName
    get() = ComponentName(context, SpotterMediaListener::class.java)

  private val sessionsChanged = MediaSessionManager.OnActiveSessionsChangedListener { list ->
    watch(list ?: emptyList())
    emit()
  }

  private val controllerCallback = object : MediaController.Callback() {
    override fun onMetadataChanged(metadata: MediaMetadata?) {
      emit()
    }

    override fun onPlaybackStateChanged(state: PlaybackState?) {
      emit()
    }

    override fun onSessionDestroyed() {
      main.post { refresh() }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SpotterMedia")

    Events("onChange")

    OnStartObserving {
      main.post {
        observing = true
        refresh()
      }
    }

    OnStopObserving {
      main.post { stop() }
    }

    OnDestroy {
      main.post { stop() }
    }

    // Back from Settings with access just turned on: start listening.
    OnActivityEntersForeground {
      main.post { if (observing) refresh() }
    }

    Function("hasMediaAccess") { hasMediaAccess() }

    Function("openMediaAccessSettings") {
      val detail =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
            .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener.flattenToString())
        } else {
          null
        }
      if (detail != null && open(detail)) true else open(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    Function("getNowPlaying") { snapshot(current()) }

    Function("control") { action: String, value: Double? -> control(action, value) }

    Function("openPlayer") { openPlayer() }

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

  // ---------- Sessions ----------

  private fun hasMediaAccess(): Boolean {
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
    return flat.split(":").any { ComponentName.unflattenFromString(it)?.packageName == context.packageName }
  }

  private fun refresh() {
    if (!hasMediaAccess()) {
      unwatchAll()
      emit()
      return
    }
    try {
      sessions.removeOnActiveSessionsChangedListener(sessionsChanged)
      sessions.addOnActiveSessionsChangedListener(sessionsChanged, listener, main)
      watch(sessions.getActiveSessions(listener))
    } catch (e: SecurityException) {
      unwatchAll()
    }
    emit()
  }

  private fun stop() {
    observing = false
    try {
      sessions.removeOnActiveSessionsChangedListener(sessionsChanged)
    } catch (e: Exception) {
      // not registered
    }
    unwatchAll()
  }

  private fun watch(list: List<MediaController>) {
    unwatchAll()
    for (c in list) {
      c.registerCallback(controllerCallback, main)
      watched.add(c)
    }
  }

  private fun unwatchAll() {
    for (c in watched) {
      try {
        c.unregisterCallback(controllerCallback)
      } catch (e: Exception) {
        // already gone
      }
    }
    watched.clear()
  }

  private fun controllers(): List<MediaController> {
    if (watched.isNotEmpty()) return watched.toList()
    if (!hasMediaAccess()) return emptyList()
    return try {
      sessions.getActiveSessions(listener)
    } catch (e: SecurityException) {
      emptyList()
    }
  }

  // The one that's playing, else the most recent. Spotter's own (the rest sound) never counts.
  private fun current(): MediaController? {
    val list = controllers().filter { it.packageName != context.packageName }
    return list.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: list.firstOrNull()
  }

  private fun emit() {
    if (!observing) return
    sendEvent("onChange", mapOf("nowPlaying" to snapshot(current()), "access" to hasMediaAccess()))
  }

  private fun snapshot(c: MediaController?): Map<String, Any?>? {
    if (c == null) return null
    val md = c.metadata ?: return null
    val st = c.playbackState
    val title = md.getString(MediaMetadata.METADATA_KEY_TITLE)
      ?: md.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
    if (title.isNullOrBlank()) return null
    val artist = md.getString(MediaMetadata.METADATA_KEY_ARTIST)
      ?: md.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
      ?: md.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
      ?: ""
    val state = st?.state ?: PlaybackState.STATE_NONE
    val playing = state == PlaybackState.STATE_PLAYING || state == PlaybackState.STATE_BUFFERING
    // Position as of a wall-clock moment, so JS can run the bar on without asking again.
    val positionAt =
      if (st != null && st.lastPositionUpdateTime > 0) {
        System.currentTimeMillis() - (SystemClock.elapsedRealtime() - st.lastPositionUpdateTime)
      } else {
        System.currentTimeMillis()
      }
    val actions = st?.actions ?: 0L
    // Some players don't declare their actions at all; assume the usual ones then.
    fun can(action: Long) = actions == 0L || (actions and action) != 0L
    return mapOf(
      "packageName" to c.packageName,
      "appName" to appLabel(c.packageName),
      "title" to title,
      "artist" to artist,
      "artwork" to artwork(md, c.packageName, title),
      "durationMs" to md.getLong(MediaMetadata.METADATA_KEY_DURATION).toDouble(),
      "positionMs" to (st?.position ?: 0L).toDouble(),
      "positionAt" to positionAt.toDouble(),
      "speed" to (st?.playbackSpeed ?: 1f).toDouble(),
      "playing" to playing,
      "canSeek" to ((actions and PlaybackState.ACTION_SEEK_TO) != 0L),
      "canNext" to can(PlaybackState.ACTION_SKIP_TO_NEXT),
      "canPrevious" to can(PlaybackState.ACTION_SKIP_TO_PREVIOUS),
    )
  }

  private fun appLabel(pkg: String): String =
    try {
      val pm = context.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) {
      ""
    }

  // The cover as a small JPEG data URI, made once per track (players often send the
  // metadata first and the picture a moment later, hence the size in the key).
  private fun artwork(md: MediaMetadata, pkg: String, title: String): String? {
    val bmp = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
      ?: md.getBitmap(MediaMetadata.METADATA_KEY_ART)
      ?: md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
    val key = "$pkg|$title|${md.getString(MediaMetadata.METADATA_KEY_ALBUM)}|${bmp?.width}x${bmp?.height}"
    if (key == artKey) return artUri
    artKey = key
    artUri = bmp?.let { toDataUri(it) }
    return artUri
  }

  private fun toDataUri(source: Bitmap): String? =
    try {
      val soft =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && source.config == Bitmap.Config.HARDWARE) {
          source.copy(Bitmap.Config.ARGB_8888, false)
        } else {
          source
        }
      val side = 256
      val scale = side.toFloat() / maxOf(soft.width, soft.height)
      val small =
        if (scale < 1f) {
          Bitmap.createScaledBitmap(soft, (soft.width * scale).toInt().coerceAtLeast(1), (soft.height * scale).toInt().coerceAtLeast(1), true)
        } else {
          soft
        }
      val out = ByteArrayOutputStream()
      small.compress(Bitmap.CompressFormat.JPEG, 85, out)
      "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
      null
    }

  private fun control(action: String, value: Double?): Boolean {
    val c = current() ?: return false
    val t = c.transportControls
    when (action) {
      "play" -> t.play()
      "pause" -> t.pause()
      "toggle" -> if (c.playbackState?.state == PlaybackState.STATE_PLAYING) t.pause() else t.play()
      "next" -> t.skipToNext()
      "previous" -> t.skipToPrevious()
      "seek" -> t.seekTo((value ?: return false).toLong())
      else -> return false
    }
    return true
  }

  // Opens the player itself: its own now-playing screen if it offers one, else the app.
  private fun openPlayer(): Boolean {
    val c = current() ?: return false
    val pi = c.sessionActivity
    if (pi != null) {
      try {
        val options =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            @Suppress("DEPRECATION")
            ActivityOptions.makeBasic()
              .setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
              .toBundle()
          } else {
            null
          }
        pi.send(context, 0, null, null, null, null, options)
        return true
      } catch (e: Exception) {
        // fall through to the launcher intent
      }
    }
    val launch = context.packageManager.getLaunchIntentForPackage(c.packageName) ?: return false
    return open(launch)
  }

  // ---------- Helpers ----------

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
