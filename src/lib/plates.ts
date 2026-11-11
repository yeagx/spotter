import type { Units } from '@/db/profile';

// Which plates go on each side of the bar for a given total. Everything here is in the
// user's own units (kg or lb): a gym has one kind of plate, so nothing is converted.

// Bars to cycle through, most common first: Olympic, women's/short, EZ or technique bar.
export const BARS: Record<Units, number[]> = { kg: [20, 15, 10], lb: [45, 35, 25] };

const PLATES: Record<Units, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export type Loading =
  | { kind: 'under' } // lighter than the bar itself
  | { kind: 'empty' } // just the bar
  | { kind: 'plates'; perSide: number[]; makes: number | null }; // makes: the nearest loadable total, when the exact one can't be built

// Largest plates first. Works in hundredths so 1.25 kg plates add up exactly.
export function loadBar(total: number, bar: number, units: Units): Loading {
  const cents = (n: number) => Math.round(n * 100);
  let side = (cents(total) - cents(bar)) / 2;
  if (side < 0) return { kind: 'under' };

  const perSide: number[] = [];
  for (const plate of PLATES[units]) {
    while (side >= cents(plate)) {
      perSide.push(plate);
      side -= cents(plate);
    }
  }
  if (perSide.length === 0) return { kind: 'empty' };
  const makes = side > 0 ? (cents(total) - side * 2) / 100 : null;
  return { kind: 'plates', perSide, makes };
}
