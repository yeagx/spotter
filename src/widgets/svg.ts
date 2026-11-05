import { slantPoints, stripBoxes } from '@/lib/slant';

// SVG strings for the widgets' drawn parts. Widgets can't host react-native-svg, but
// they render an SVG string, so the shapes are written out with the app's own geometry.

export type Bar = { color: string; value?: number }; // value 0..1 of the height

// A row of slanted bars filling width × height, cut inside its own box: straight outer
// edges, nothing drawn outside the viewBox.
export function stripSvg(bars: Bar[], width: number, height: number, gap: number): string {
  const boxes = stripBoxes(bars.map((b) => b.value ?? 1), width, height, gap);
  const shapes = boxes
    .map(
      (b, i) =>
        `<polygon points="${slantPoints(b.x, b.y, b.w, b.h, b.left, b.right)}" fill="${bars[i].color}"/>`,
    )
    .join('');
  return svg(width, height, shapes);
}

// A progress ring: track all the way round, `progress` (0..1) of it in colour, from the
// top, clockwise. Drawn inset by half the stroke so it never spills out of its box.
export function ringSvg(
  diameter: number,
  stroke: number,
  progress: number,
  track: string,
  color: string,
): string {
  const r = (diameter - stroke) / 2;
  const c = diameter / 2;
  const length = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const base = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`;
  const arc =
    p > 0
      ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" ` +
        `stroke-dasharray="${length * p} ${length}" transform="rotate(-90 ${c} ${c})"/>`
      : '';
  return svg(diameter, diameter, base + arc);
}

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
