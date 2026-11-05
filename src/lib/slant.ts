import { slant } from '@/theme';

// The slant, the one decorative move. Every shape is a polygon cut inside its own box,
// never a rotated or skewed element, so nothing overflows its container. Shared by the
// app's <Slant> components and the home screen widgets' SVGs so both cut the same way.

// Horizontal offset of the cut for a w × h box: the logo's ~26° angle, capped so tall
// narrow bars keep a flat top.
export const cutFor = (w: number, h: number) => Math.min(h * slant, w * 0.34);

export type Edge = 'slant' | 'straight';

export function slantPoints(x: number, y: number, w: number, h: number, left: Edge, right: Edge) {
  const c = cutFor(w, h);
  const top = y;
  const bottom = y + h;
  const tl = left === 'slant' ? x + c : x;
  const br = right === 'slant' ? x + w - c : x + w;
  return `${tl},${top} ${x + w},${top} ${br},${bottom} ${x},${bottom}`;
}

export type StripBox = { x: number; y: number; w: number; h: number; left: Edge; right: Edge };

// Boxes for a row of n bars across `width`, bottom-aligned, each `values[i]` (0..1) of the
// height. The first bar keeps a straight left edge and the last a straight right edge,
// so the strip sits flush with whatever is beside it.
export function stripBoxes(values: number[], width: number, height: number, gap: number): StripBox[] {
  const n = values.length;
  const w = n ? (width - gap * (n - 1)) / n : 0;
  if (w <= 0) return [];
  return values.map((v, i) => {
    const h = Math.max(1, height * v);
    return {
      x: i * (w + gap),
      y: height - h,
      w,
      h,
      left: i === 0 ? 'straight' : 'slant',
      right: i === n - 1 ? 'straight' : 'slant',
    };
  });
}
