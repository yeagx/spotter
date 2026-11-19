import ExpoModulesCore
import MediaPlayer

// Music controls on iPhone. Android sends media-button presses that any player answers;
// iOS gives other apps no such thing. The one player an app may control is the system
// music player (Apple Music and the Music app), so that's what this drives. Spotify,
// YouTube and the rest can't be controlled from another app on iPhone.
//
// Do Not Disturb isn't here: no iPhone app can switch Focus. Spotter's Focus mode on
// iPhone runs the user's own Shortcuts instead (src/lib/focus.ios.ts).
public class SpotterMediaModule: Module {
  private var player: MPMusicPlayerController { MPMusicPlayerController.systemMusicPlayer }

  public func definition() -> ModuleDefinition {
    Name("SpotterMedia")

    // Whether Apple Music is playing right now. The player lives on the main thread.
    Function("isMusicActive") { () -> Bool in
      self.onMain { self.player.playbackState == .playing }
    }

    // play / pause / toggle / next / previous. The first press may ask for access to
    // Apple Music (once); the press goes through as soon as it's allowed.
    Function("sendMediaKey") { (action: String) -> Bool in
      guard ["play", "pause", "toggle", "next", "previous"].contains(action) else { return false }
      switch MPMediaLibrary.authorizationStatus() {
      case .notDetermined:
        MPMediaLibrary.requestAuthorization { status in
          guard status == .authorized else { return }
          DispatchQueue.main.async { self.press(action) }
        }
      default:
        DispatchQueue.main.async { self.press(action) }
      }
      return true
    }
  }

  private func onMain<T>(_ work: () -> T) -> T {
    Thread.isMainThread ? work() : DispatchQueue.main.sync(execute: work)
  }

  private func press(_ action: String) {
    let p = player
    switch action {
    case "play": p.play()
    case "pause": p.pause()
    case "toggle": p.playbackState == .playing ? p.pause() : p.play()
    case "next": p.skipToNextItem()
    case "previous":
      // Like a headset: back to the start of the song, or the one before if it just began.
      if p.currentPlaybackTime > 3 { p.skipToBeginning() } else { p.skipToPreviousItem() }
    default: break
    }
  }
}
