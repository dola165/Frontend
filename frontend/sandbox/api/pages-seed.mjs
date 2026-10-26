// Synthetic data for creating pages: pitches across Georgia (what OpenStreetMap's leisure=pitch + sport=soccer would
// return through Overpass) and a few known clubs nobody runs yet, most of them outside Tbilisi. Invented.
import * as W from './world.mjs';

/** Pitches by town. Surfaces: GRASS, ARTIFICIAL, HYBRID, INDOOR. Size is the biggest game the pitch takes. */
const raw = [
  // Tbilisi (the sandbox venues are added below)
  ['Saburtalo School No. 51 pitch', 'Tbilisi', 41.7290, 44.7621, 'Pekini Ave 14', 'ARTIFICIAL', '7v7', true],
  ['Nutsubidze Plateau turf', 'Tbilisi', 41.7335, 44.7265, 'Nutsubidze St 72', 'ARTIFICIAL', '9v9', true],
  ['Varketili sports ground', 'Tbilisi', 41.6930, 44.8890, 'Javakheti St 3', 'ARTIFICIAL', '11v11', true],
  ['Dighomi Massive pitch', 'Tbilisi', 41.7745, 44.7535, 'Dighomi Massive, block 4', 'ARTIFICIAL', '7v7', false],
  ['Avlabari court', 'Tbilisi', 41.6930, 44.8140, 'Ketevan Tsamebuli Ave 9', 'ARTIFICIAL', '5v5', true],
  ['Ortachala riverside pitch', 'Tbilisi', 41.6820, 44.8205, 'Gorgasali St 101', 'GRASS', '11v11', false],
  // Rustavi
  ['Poladi Stadium training pitch', 'Rustavi', 41.5560, 45.0150, 'Megobroba Ave 2', 'GRASS', '11v11', true],
  ['Rustavi School No. 15 pitch', 'Rustavi', 41.5430, 44.9905, 'Kostava St 40', 'ARTIFICIAL', '7v7', false],
  ['Kostava St turf', 'Rustavi', 41.5480, 45.0230, 'Kostava St 7', 'ARTIFICIAL', '9v9', true],
  ['Rustavi Lake mini-pitch', 'Rustavi', 41.5590, 44.9870, 'Lake Rd 1', 'ARTIFICIAL', '5v5', true],
  // Kutaisi
  ['Kutaisi Central Park pitch', 'Kutaisi', 42.2700, 42.7050, 'Rustaveli Ave 30', 'ARTIFICIAL', '7v7', true],
  ['Avtokarkhana ground', 'Kutaisi', 42.2480, 42.6600, 'Avtokarkhana St 5', 'GRASS', '11v11', false],
  ['Kutaisi University pitch', 'Kutaisi', 42.2735, 42.6900, 'Tamar Mepe St 59', 'ARTIFICIAL', '9v9', true],
  // Batumi
  ['Batumi Boulevard mini-pitch', 'Batumi', 41.6500, 41.6300, 'Boulevard, Seaside Park', 'ARTIFICIAL', '5v5', true],
  ['Khimshiashvili St turf', 'Batumi', 41.6280, 41.6150, 'Khimshiashvili St 12', 'ARTIFICIAL', '7v7', true],
  ['Chakvi Rd pitch', 'Batumi', 41.6610, 41.6820, 'Chakvi Rd 8', 'GRASS', '11v11', false],
  // Gori, Zugdidi, Telavi, Poti, Mtskheta
  ['Gori Central Stadium pitch', 'Gori', 41.9840, 44.1100, 'Stalin Ave 22', 'GRASS', '11v11', true],
  ['Gori School No. 5 pitch', 'Gori', 41.9780, 44.1180, 'Chavchavadze St 18', 'ARTIFICIAL', '7v7', false],
  ['Zugdidi Central pitch', 'Zugdidi', 42.5100, 41.8700, 'Rustaveli St 64', 'ARTIFICIAL', '9v9', true],
  ['Zugdidi Botanical Garden ground', 'Zugdidi', 42.5180, 41.8650, 'Dadiani St 2', 'GRASS', '11v11', false],
  ['Telavi School No. 2 pitch', 'Telavi', 41.9180, 45.4790, 'Erekle II St 9', 'ARTIFICIAL', '7v7', true],
  ['Poti Fazisi pitch', 'Poti', 42.1480, 41.6750, 'Davit Aghmashenebeli St 30', 'ARTIFICIAL', '9v9', true],
  ['Poti Port turf', 'Poti', 42.1530, 41.6600, 'Gegidze St 4', 'ARTIFICIAL', '5v5', false],
  ['Mtskheta Arsukidze St pitch', 'Mtskheta', 41.8440, 44.7100, 'Arsukidze St 11', 'ARTIFICIAL', '7v7', false],
  // Smaller towns
  ['Marneuli Central Stadium', 'Marneuli', 41.4760, 44.8080, 'Rustaveli St 50', 'GRASS', '11v11', true],
  ['Samtredia Lokomotivi ground', 'Samtredia', 42.1530, 42.3400, 'Railway St 1', 'GRASS', '11v11', false],
  ['Zestaponi Margveti pitch', 'Zestaponi', 42.1100, 43.0470, 'Aghmashenebeli St 21', 'ARTIFICIAL', '9v9', true],
  ['Senaki Eristavi St pitch', 'Senaki', 42.2700, 42.0670, 'Eristavi St 6', 'ARTIFICIAL', '7v7', false],
  ['Khashuri Central pitch', 'Khashuri', 41.9940, 43.5990, 'Rustaveli St 3', 'ARTIFICIAL', '9v9', true],
  ['Akhaltsikhe Rabati pitch', 'Akhaltsikhe', 41.6420, 42.9850, 'Kharischirashvili St 1', 'ARTIFICIAL', '7v7', false],
  ['Ozurgeti Central pitch', 'Ozurgeti', 41.9240, 42.0080, 'Gogebashvili St 12', 'GRASS', '11v11', false],
  ['Borjomi Park pitch', 'Borjomi', 41.8400, 43.3850, 'Baratashvili St 5', 'ARTIFICIAL', '7v7', false],
  ['Kobuleti Seaside pitch', 'Kobuleti', 41.8180, 41.7780, 'Aghmashenebeli Ave 140', 'ARTIFICIAL', '5v5', true],
  ['Gurjaani School pitch', 'Gurjaani', 41.7440, 45.8010, 'Nonikashvili St 3', 'ARTIFICIAL', '7v7', false],
  ['Kaspi Central pitch', 'Kaspi', 41.9260, 44.4240, 'Kostava St 1', 'GRASS', '9v9', false],
];
const surfaceOf = text => /indoor/i.test(text) ? 'INDOOR' : /hybrid/i.test(text) ? 'HYBRID' : /natural/i.test(text) ? 'GRASS' : 'ARTIFICIAL';
export const pitches = [
  ...W.venues.map(v => ({ id: `v${v.id}`, name: v.name, town: v.city, latitude: v.lat, longitude: v.lng, address: `${v.district}, ${v.city}`,
    surface: surfaceOf(v.surface), size: v.kind === 'INDOOR' || v.pitches.every(p => /5|7/.test(p)) ? '7v7' : '11v11', lights: v.kind !== 'COMMUNITY' || v.hourly != null, indoor: v.kind === 'INDOOR', venueId: v.id })),
  ...raw.map(([name, town, latitude, longitude, street, surface, size, lights], index) => ({ id: `p${index + 1}`, name, town, latitude, longitude, address: `${street}, ${town}`, surface, size, lights, indoor: surface === 'INDOOR', venueId: null })),
];
export const pitchById = id => pitches.find(p => p.id === String(id)) ?? null;

/**
 * Known clubs, pre-created as listings from public sources: live and findable; anyone can still start their own page.
 * What is known is filled in, so the listing says more than a name.
 */
export const listedSeeds = [
  { id: 301, name: 'Torpedo Kutaisi Juniors', short: 'TK', town: 'Kutaisi', category: 'COMMUNITY_CLUB', crest: { shape: 'shield', primary: 'black', secondary: 'white', initials: 'TK' }, ground: 'p12', squads: [['U10', 'MALE'], ['U12', 'MALE']], founded: 2009 },
  { id: 302, name: 'Dila Gori Youth', short: 'DG', town: 'Gori', category: 'PRIVATE_ACADEMY', crest: { shape: 'round', primary: 'blue', secondary: 'white', initials: 'DG' }, ground: 'p17', squads: [['U12', 'MALE'], ['U14', 'MALE']], founded: 2004 },
  { id: 303, name: 'Margveti Zestaponi Kids', short: 'MZ', town: 'Zestaponi', category: 'COMMUNITY_CLUB', crest: { shape: 'shield', primary: 'yellow', secondary: 'black', initials: 'MZ' }, ground: 'p27', squads: [['U8', 'MIXED']], founded: 2015 },
  { id: 304, name: 'Kolkheti Poti Youth', short: 'KP', town: 'Poti', category: 'COMMUNITY_CLUB', crest: { shape: 'hexagon', primary: 'sky', secondary: 'navy', initials: 'KP' }, ground: 'p22', squads: [], founded: 2012 },
  { id: 305, name: 'Alazani Telavi FC', short: 'AT', town: 'Telavi', category: 'AMATEUR_CLUB', crest: { shape: 'shield', primary: 'green', secondary: 'white', initials: 'AT' }, ground: 'p21', squads: [['SENIOR', 'MALE']], founded: 2001 },
  { id: 306, name: 'Varketili Stars', short: 'VS', town: 'Tbilisi', category: 'COMMUNITY_CLUB', crest: { shape: 'round', primary: 'orange', secondary: 'navy', initials: 'VS' }, ground: 'p3', squads: [['U8', 'MIXED'], ['U10', 'MIXED'], ['U12', 'MALE']], founded: 2018 },
  { id: 307, name: 'Rustavi Metallurgi Kids', short: 'RM', town: 'Rustavi', category: 'COMMUNITY_CLUB', crest: { shape: 'shield', primary: 'red', secondary: 'black', initials: 'RM' }, ground: 'p7', squads: [['U9', 'MIXED'], ['U11', 'MALE']], founded: 2016 },
];

/** A dropped pin's address, as reverse geocoding would give it: the nearest known street in the nearest town. */
export function reverseGeocode(latitude, longitude) {
  const distance = p => (p.latitude - latitude) ** 2 + ((p.longitude - longitude) * Math.cos(latitude * Math.PI / 180)) ** 2;
  const nearest = [...pitches].sort((a, b) => distance(a) - distance(b))[0];
  const km = nearest ? Math.sqrt(distance(nearest)) * 111 : Infinity;
  if (!nearest || km > 15) return { address: null, town: null, latitude, longitude };
  const street = nearest.address.split(',')[0].replace(/\s+\d+[a-z]?$/i, '');
  return { address: km < 0.6 ? `${street}, ${nearest.town}` : `Near ${street}, ${nearest.town}`, town: nearest.town, latitude, longitude };
}
