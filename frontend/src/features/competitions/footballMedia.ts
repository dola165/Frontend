import type { Discipline } from './api';

/** Locally served, licensed football settings; provenance in venue-demo/credits.json. */
export function footballStock(id: number, discipline?: Discipline) {
  if (discipline === 'FUTSAL') return '/venue-demo/pitch-indoor.jpg';
  return ['/football/ball-field.jpg','/venue-demo/pitch-aerial.jpg','/football/touchline.jpg','/venue-demo/pitch-sun.jpg'][Math.abs(id) % 4];
}
