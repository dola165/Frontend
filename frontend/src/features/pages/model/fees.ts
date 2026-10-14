import type { FeeBand } from '../api';

/** "40–80 GEL / month", "Free training", or "from 40 GEL / month · some groups free": one line for a fee band. */
export function feeBandText(band: FeeBand | null, words: { free: string; month: string; someFree: string } = { free: 'Free training', month: 'month', someFree: 'Some groups train free' }): { range: string; note?: string } | null {
  if (!band) return null;
  if (band.free === 'ALL' || (band.min === 0 && band.max === 0)) return { range: words.free };
  const money = (value: number) => `${value.toLocaleString('en-GB')}`;
  const range = band.min === band.max ? `${money(band.max)} ${band.currency} / ${words.month}` : `${money(band.min)}–${money(band.max)} ${band.currency} / ${words.month}`;
  return { range, note: band.free === 'SOME' ? words.someFree : undefined };
}
