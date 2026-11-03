"""Builds the app's logo, splash and icon PNGs from design/logo/spotter-mark-dark.png.

Run from the project root:  python scripts/make-brand-assets.py

The dark logo is the mark (white top, red bottom, red dot) on black. Every pixel is
either one of those two colours blended with black, so the mark can be lifted off the
background exactly: the colour stays the brand colour, only the alpha is recovered.
Nothing is recoloured or redrawn.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "logo" / "spotter-mark-dark.png"
ASSETS = ROOT / "assets"

WHITE = np.array([255, 255, 255], dtype=np.float64)
GROUND = (0x0B, 0x0B, 0x0B)


def lift_mark(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert("RGB"), dtype=np.float64)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # Red pixels: red channel well above the others. Everything else is white or black.
    is_red = r > 2 * np.maximum(g, b) + 5
    # The brand red as it appears at full strength in the source.
    solid_red = rgb[is_red & (r > 200)].mean(axis=0)
    alpha = np.where(is_red, r / solid_red[0], np.max(rgb, axis=-1) / 255.0)
    alpha = np.clip(alpha, 0.0, 1.0)
    alpha[alpha < 0.02] = 0.0  # near-black noise in the background
    color = np.where(is_red[..., None], solid_red, WHITE)
    out = np.dstack([color, alpha * 255.0]).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def crop_to_mark(mark: Image.Image, pad_ratio: float = 0.02) -> Image.Image:
    left, top, right, bottom = mark.getchannel("A").getbbox()
    pad = round((bottom - top) * pad_ratio)
    return mark.crop((left - pad, top - pad, right + pad, bottom + pad))


def main() -> None:
    dark = Image.open(SRC)
    mark = lift_mark(dark)

    # In-app logo: tight crop, tall enough for the 120dp Start screen at 4x density.
    logo = crop_to_mark(mark)
    height = 480
    width = round(logo.width * height / logo.height)
    logo.resize((width, height), Image.LANCZOS).save(ASSETS / "logo.png")
    print(f"logo.png {width}x{height} (aspect {logo.width / logo.height:.4f})")

    # Splash: empty on purpose. The native splash is plain ground, and the in-app launch
    # animation brings the logo in from blur (src/components/Launch.tsx), as specified.
    Image.new("RGBA", (288, 288), (0, 0, 0, 0)).save(ASSETS / "splash-icon.png")

    # Store / iOS icon: the dark logo as designed.
    dark.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(ASSETS / "icon.png")

    # Android adaptive icon. The mark already sits inside the 66% safe zone of the
    # source square, so it keeps its placement on a transparent 1024 canvas.
    fg = mark.resize((1024, 1024), Image.LANCZOS)
    fg.save(ASSETS / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), GROUND).save(ASSETS / "android-icon-background.png")
    mono = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
    mono.putalpha(fg.getchannel("A"))
    mono.save(ASSETS / "android-icon-monochrome.png")

    dark.convert("RGB").resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")
    print("icons written")


if __name__ == "__main__":
    main()
