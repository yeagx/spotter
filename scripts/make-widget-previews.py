"""Renders the Android widget picker's preview images from scripts/widget-previews.html.

Run from the project root:  python scripts/make-widget-previews.py

Needs Google Chrome or Edge (or set CHROME to its path). Writes assets/widgets/<name>.png,
which app.json's widget "previewImage" entries point at. Without a preview, Android's
widget picker shows a blank card with the app icon, so you can't see what you're adding.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "widgets"
PAGE = (ROOT / "scripts" / "widget-previews.html").as_uri()

# Size in dp, matching each widget's cells in app.json (4x2, 2x2, 1x1).
WIDGETS = {
    "Today": (320, 160),
    "Month": (320, 160),
    "Me": (320, 160),
    "BestLift": (160, 160),
    "Body": (160, 160),
    "MeSmall": (160, 160),
    "Start": (80, 80),
}
# Drawn at 2x: sharp in the picker, small enough that launchers decode it cheaply.
SCALE = 2
# Headless Chrome won't make a window narrower than about 500px, so the card is drawn
# at its own size in a larger window and cropped out.
WINDOW = (800, 400)

CANDIDATES = [
    os.environ.get("CHROME"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    shutil.which("google-chrome"),
    shutil.which("chromium"),
]


def main() -> None:
    chrome = next((c for c in CANDIDATES if c and Path(c).exists()), None)
    if not chrome:
        raise SystemExit("Chrome not found. Set CHROME to its path.")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, (w, h) in WIDGETS.items():
            shot = Path(tmp) / f"{name}.png"
            subprocess.run(
                [
                    chrome,
                    "--headless=new",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    "--allow-file-access-from-files",
                    "--default-background-color=00000000",
                    f"--force-device-scale-factor={SCALE}",
                    f"--window-size={WINDOW[0]},{WINDOW[1]}",
                    "--virtual-time-budget=2000",  # lets the web fonts load first
                    f"--screenshot={shot}",
                    f"{PAGE}#{name}:{w}:{h}",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            out = OUT / f"{name.lower()}.png"
            Image.open(shot).crop((0, 0, w * SCALE, h * SCALE)).save(out, optimize=True)
            print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
