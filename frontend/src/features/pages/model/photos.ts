/**
 * The app's own football photos, offered as covers. A new page gets one picked to suit its crest colours, so it looks
 * real before anyone configures it. No imports: the sandbox API reads this file too.
 */
export const COVER_PHOTOS = {
  'ball-field': '/football/ball-field.jpg',
  touchline: '/football/touchline.jpg',
  'pitch-aerial': '/venue-demo/pitch-aerial.jpg',
  'pitch-day': '/venue-demo/pitch-day.jpg',
  'pitch-sun': '/venue-demo/pitch-sun.jpg',
  'pitch-indoor': '/venue-demo/pitch-indoor.jpg',
} as const;
export type CoverPhoto = keyof typeof COVER_PHOTOS;
export const COVER_PHOTO_KEYS = Object.keys(COVER_PHOTOS) as CoverPhoto[];
export const isCoverPhoto = (value: unknown): value is CoverPhoto => typeof value === 'string' && value in COVER_PHOTOS;

/** Warm colours get the sunlit pitch, cool ones the aerial view, greens the ball on grass, dark ones the touchline. */
const BY_COLOUR: Record<string, CoverPhoto> = {
  red: 'pitch-sun', maroon: 'pitch-sun', orange: 'pitch-sun', gold: 'pitch-sun', yellow: 'pitch-sun',
  green: 'ball-field', forest: 'ball-field',
  sky: 'pitch-aerial', blue: 'pitch-aerial', navy: 'pitch-aerial', purple: 'pitch-day',
  black: 'touchline', white: 'pitch-day',
};
export const coverForColour = (colour: string): CoverPhoto => BY_COLOUR[colour] ?? 'ball-field';
