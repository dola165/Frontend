/**
 * A clean crest drawn from the club's initials and two colours, so a page looks real from its first second
 * (convention over configuration). The lettering is always the more readable of ink or paper on the main colour,
 * which guarantees at least 4.5:1 contrast whatever two colours are chosen.
 *
 * Imports only the palette (itself import-free), so the sandbox API draws crests with this same file.
 */
import { crestPalette } from '../../../styles/visualColors.ts';

export const CREST_SHAPES = ['shield', 'round', 'square', 'hexagon'] as const;
export type CrestShape = typeof CREST_SHAPES[number];
export const CREST_COLOURS = ['red', 'maroon', 'orange', 'gold', 'yellow', 'green', 'forest', 'sky', 'blue', 'navy', 'purple', 'black', 'white'] as const;
export type CrestColour = typeof CREST_COLOURS[number];

export interface CrestDesign { shape: CrestShape; primary: CrestColour; secondary: CrestColour; initials: string }

export const isCrestColour = (value: unknown): value is CrestColour => typeof value === 'string' && (CREST_COLOURS as readonly string[]).includes(value);
export const isCrestShape = (value: unknown): value is CrestShape => typeof value === 'string' && (CREST_SHAPES as readonly string[]).includes(value);
export const paint = (colour: CrestColour) => crestPalette[colour];

// ---------------------------------------------------------------- contrast (WCAG 2.2)

const channel = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map(part => part + part).join('') : value;
  const [r, g, b] = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
/** The lettering colour for a fill: ink or paper, whichever reads better. */
export function letteringOn(colour: CrestColour): string {
  const fill = paint(colour);
  return contrast(fill, crestPalette.paper) >= contrast(fill, crestPalette.ink) ? crestPalette.paper : crestPalette.ink;
}

// ---------------------------------------------------------------- defaults

const FILLER = new Set(['fc', 'fk', 'sk', 'club', 'football', 'academy', 'the', 'of', 'and', 'კლუბი', 'საფეხბურთო', 'აკადემია']);
/** "Rustavi Lions" → "RL", "FC Dinamo Tbilisi" → "DT", "Saburtalo" → "S". At most three letters, in the name's own script. */
export function initialsFor(name: string): string {
  const words = name.split(/[\s.,'’"()/-]+/).filter(Boolean);
  const kept = words.filter(word => !FILLER.has(word.toLowerCase()));
  const letters = (kept.length ? kept : words).slice(0, 3).map(word => [...word][0] ?? '').join('');
  return cleanInitials(letters) || '?';
}
/**
 * Letters and digits only, at most three, upper case for Latin and Cyrillic. Georgian stays in its everyday letters:
 * its capitals (Mtavruli) are missing from most fonts a crest image can use.
 */
export const cleanInitials = (value: string) => [...value.normalize('NFC')].filter(letter => /[\p{L}\p{N}]/u.test(letter)).slice(0, 3)
  .map(letter => (/[Ⴀ-ჿᲐ-Ჿ]/.test(letter) ? letter.toLowerCase() : letter.toUpperCase())).join('');

/** Colour pairs clubs actually wear; a name always gets the same one, so the default never jumps between visits. */
export const CREST_PAIRS: readonly [CrestColour, CrestColour][] = [
  ['green', 'white'], ['blue', 'white'], ['red', 'white'], ['navy', 'gold'], ['black', 'gold'], ['maroon', 'sky'],
  ['purple', 'white'], ['orange', 'black'], ['sky', 'navy'], ['forest', 'yellow'], ['red', 'black'], ['yellow', 'black'],
];
const hash = (text: string) => [...text].reduce((value, letter) => (value * 31 + (letter.codePointAt(0) ?? 0)) >>> 0, 7);

export function defaultCrest(name: string): CrestDesign {
  const [primary, secondary] = CREST_PAIRS[hash(name.trim().toLowerCase()) % CREST_PAIRS.length];
  return { shape: 'shield', primary, secondary, initials: initialsFor(name) };
}

/** A design read from storage or the network, repaired so it always draws. */
export function normalizeCrest(value: unknown, name: string): CrestDesign {
  const fallback = defaultCrest(name);
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Partial<Record<keyof CrestDesign, unknown>>;
  return {
    shape: isCrestShape(raw.shape) ? raw.shape : fallback.shape,
    primary: isCrestColour(raw.primary) ? raw.primary : fallback.primary,
    secondary: isCrestColour(raw.secondary) ? raw.secondary : fallback.secondary,
    initials: typeof raw.initials === 'string' && cleanInitials(raw.initials) ? cleanInitials(raw.initials) : fallback.initials,
  };
}

// ---------------------------------------------------------------- drawing

/** Outline of each shape on a 96 × 96 board, and the same shape inset for the main colour. */
const OUTLINE: Record<CrestShape, (inset: number) => string> = {
  shield: i => `<path d="M48 ${4 + i}L${88 - i} ${16 + i}V46C${88 - i} ${70 - i * 0.5} ${70 - i * 0.4} ${86 - i} 48 ${92 - i * 1.2}C${26 + i * 0.4} ${86 - i} ${8 + i} ${70 - i * 0.5} ${8 + i} 46V${16 + i}Z"`,
  round: i => `<circle cx="48" cy="48" r="${44 - i}"`,
  square: i => `<rect x="${5 + i}" y="${5 + i}" width="${86 - i * 2}" height="${86 - i * 2}" rx="${20 - i}"`,
  hexagon: i => `<path d="M48 ${3 + i}L${88 - i} ${25 + i * 0.6}V${71 - i * 0.6}L48 ${93 - i}L${8 + i} ${71 - i * 0.6}V${25 + i * 0.6}Z"`,
};
const escape = (text: string) => text.replace(/[&<>"']/g, letter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[letter] ?? letter));

/** The crest as an SVG document: the second colour as the rim and a band low down, the initials on the main colour. */
export function crestSvg(design: CrestDesign): string {
  const primary = paint(design.primary), secondary = paint(design.secondary), ink = letteringOn(design.primary);
  const initials = escape(cleanInitials(design.initials) || '?');
  const size = [...initials].length >= 3 ? 25 : [...initials].length === 2 ? 31 : 40;
  const inner = OUTLINE[design.shape](6);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">`
    + `<defs><clipPath id="inner">${inner}/></clipPath></defs>`
    + `${OUTLINE[design.shape](0)} fill="${secondary}"/>`
    + `${inner} fill="${primary}"/>`
    + `<rect x="0" y="70" width="96" height="7" fill="${secondary}" clip-path="url(#inner)"/>`
    + `<text x="48" y="${50 + size * 0.36}" text-anchor="middle" font-family="Arial, 'Segoe UI', Sylfaen, sans-serif" font-weight="800" font-size="${size}" letter-spacing="0.5" fill="${ink}">${initials}</text>`
    + `</svg>`;
}

/** The crest as an image address, for `<img>` and anywhere a logo URL goes. */
export const crestDataUrl = (design: CrestDesign) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(crestSvg(design))}`;
