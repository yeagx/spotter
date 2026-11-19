package expo.modules.spottermedia

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.audiofx.Visualizer
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
//
// Live waves: the playing sound's loudness in three bands (bass, mids, treble), about 20
// times a second, for the music strip's bars. Android's Visualizer on the output mix
// gives that only to an app with the Record audio permission, which the user opts into.
// Only the levels leave here; no sound is recorded or kept.
class SpotterMediaModule : Module() {
  private var visualizer: Visualizer? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is gone" }

  private val audio: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private val notifications: NotificationManager
    get() = context.getSystemService(NotificationManager::class.java)

  override fun definition() = ModuleDefinition {
    Name("SpotterMedia")

    Events("onLevels")

    Function("canHearLevels") {
      context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    Function("startLevels") { startLevels() }

    Function("stopLevels") { stopLevels() }

    OnDestroy { stopLevels() }

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

  private fun startLevels(): Boolean {
    if (visualizer != null) return true
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return false
    var v: Visualizer? = null
    return try {
      v = Visualizer(0) // 0: the mix of everything playing
      v.enabled = false
      val range = Visualizer.getCaptureSizeRange()
      v.captureSize = CAPTURE_SIZE.coerceIn(range[0], range[1])
      v.scalingMode = Visualizer.SCALING_MODE_NORMALIZED // the same at any volume
      v.setDataCaptureListener(
        object : Visualizer.OnDataCaptureListener {
          override fun onWaveFormDataCapture(vis: Visualizer?, waveform: ByteArray?, samplingRate: Int) {}

          override fun onFftDataCapture(vis: Visualizer?, fft: ByteArray?, samplingRate: Int) {
            if (fft == null || fft.size < 8) return
            sendEvent("onLevels", mapOf("levels" to bands(fft, samplingRate)))
          }
        },
        minOf(Visualizer.getMaxCaptureRate(), MAX_RATE_MHZ),
        false,
        true,
      )
      v.enabled = true
      visualizer = v
      true
    } catch (e: Exception) {
      v?.release()
      false
    }
  }

  private fun stopLevels(): Boolean {
    visualizer?.let {
      try {
        it.enabled = false
      } catch (_: Exception) {
      }
      it.release()
    }
    visualizer = null
    return true
  }

  // FFT bytes: [0] and [1] are the DC and Nyquist terms, then (real, imaginary) pairs for
  // bins 1 until n/2. Bin k sits at k * sampleRate / n Hz. Each band reports its average
  // and peak blended, on a log scale, as 0..1.
  private fun bands(fft: ByteArray, samplingRateMilliHz: Int): List<Double> {
    val n = fft.size
    val hz = samplingRateMilliHz / 1000.0 / n
    fun level(fromHz: Double, toHz: Double): Double {
      val from = maxOf(1, (fromHz / hz).toInt())
      val to = minOf(n / 2 - 1, maxOf(from, (toHz / hz).toInt()))
      var sum = 0.0
      var peak = 0.0
      for (k in from..to) {
        val re = fft[2 * k].toDouble()
        val im = fft[2 * k + 1].toDouble()
        val m = Math.hypot(re, im)
        sum += m
        if (m > peak) peak = m
      }
      val m = (sum / (to - from + 1) + peak) / 2
      return (Math.log1p(m) / Math.log1p(FULL)).coerceIn(0.0, 1.0)
    }
    return listOf(level(30.0, 250.0), level(250.0, 2000.0), level(2000.0, 8000.0))
  }

  private companion object {
    const val CAPTURE_SIZE = 512
    const val MAX_RATE_MHZ = 20000 // 20 a second
    const val FULL = 48.0 // a loud band, as the normalized FFT reports it
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
