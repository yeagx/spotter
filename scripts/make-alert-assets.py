"""Builds the rest-timer alert assets.

Run from the project root:  python scripts/make-alert-assets.py

- assets/sounds/rest_done.wav: two short soft tones, rising. Quiet and brief, like the
  app: a tap on the shoulder, not an alarm. 16-bit PCM WAV, which both Android
  notification channels and iOS notification sounds accept.
- assets/notification-icon.png: the mark as a white silhouette on transparent, 96x96.
  Android tints the status-bar icon itself and ignores colour, so only alpha matters.
"""

import math
import struct
import wave
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

RATE = 44100
PEAK = 0.6  # about -4.4 dBFS: clear over gym noise, never harsh

# (start s, frequency Hz, length s). C6 then G6, a fifth up: "done", not "alarm".
TONES = [(0.0, 1046.5, 0.16), (0.15, 1568.0, 0.26)]
LENGTH = 0.48


def tone_sample(t: float, freq: float, length: float) -> float:
    if t < 0 or t > length:
        return 0.0
    attack = min(1.0, t / 0.006)  # 6 ms, so it starts without a click
    decay = math.exp(-t * 14)  # soft bell-like fade
    release = min(1.0, (length - t) / 0.02)  # 20 ms tail, so it ends without a click
    body = math.sin(2 * math.pi * freq * t) + 0.18 * math.sin(2 * math.pi * freq * 2 * t)
    return body * attack * decay * release


def make_sound() -> None:
    out = ASSETS / "sounds" / "rest_done.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    n = int(RATE * LENGTH)
    raw = [sum(tone_sample(i / RATE - s, f, l) for s, f, l in TONES) for i in range(n)]
    top = max(abs(x) for x in raw)
    frames = b"".join(struct.pack("<h", int(x / top * PEAK * 32767)) for x in raw)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(frames)
    print("wrote", out.relative_to(ROOT))


def make_icon() -> None:
    src = Image.open(ASSETS / "android-icon-monochrome.png").convert("RGBA")
    alpha = src.split()[-1]
    mark = alpha.crop(alpha.getbbox())
    size, pad = 96, 8  # Android's status-bar icon: 24dp, drawn at 4x, with a little air
    box = size - pad * 2
    scale = box / max(mark.size)
    mark = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS)
    icon = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    white = Image.new("RGBA", mark.size, (255, 255, 255, 255))
    icon.paste(white, ((size - mark.width) // 2, (size - mark.height) // 2), mark)
    out = ASSETS / "notification-icon.png"
    icon.save(out)
    print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    make_sound()
    make_icon()
