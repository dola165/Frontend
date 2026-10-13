/**
 * The towns a new person can start from, with the centre Home measures distance from. Georgia is the launch
 * market; the list is short on purpose and the device's location picks the nearest one when allowed.
 * (Backend needed: a towns lookup, so this list is not shipped with the app.)
 */
export interface Town { name: string; latitude: number; longitude: number }

export const TOWNS: Town[] = [
    { name: 'Tbilisi', latitude: 41.7151, longitude: 44.8271 }, { name: 'Batumi', latitude: 41.6168, longitude: 41.6367 },
    { name: 'Kutaisi', latitude: 42.2679, longitude: 42.6946 }, { name: 'Rustavi', latitude: 41.5495, longitude: 45.0012 },
    { name: 'Gori', latitude: 41.9847, longitude: 44.1086 }, { name: 'Zugdidi', latitude: 42.5088, longitude: 41.8709 },
    { name: 'Poti', latitude: 42.1462, longitude: 41.6719 }, { name: 'Kobuleti', latitude: 41.8167, longitude: 41.7833 },
    { name: 'Telavi', latitude: 41.9198, longitude: 45.4732 }, { name: 'Mtskheta', latitude: 41.8411, longitude: 44.7067 },
    { name: 'Marneuli', latitude: 41.4767, longitude: 44.8092 }, { name: 'Samtredia', latitude: 42.1537, longitude: 42.3366 },
    { name: 'Zestaponi', latitude: 42.1097, longitude: 43.0444 }, { name: 'Senaki', latitude: 42.2697, longitude: 42.0671 },
    { name: 'Khashuri', latitude: 41.9931, longitude: 43.5986 }, { name: 'Akhaltsikhe', latitude: 41.6392, longitude: 42.9826 },
    { name: 'Ozurgeti', latitude: 41.9245, longitude: 42.0057 }, { name: 'Borjomi', latitude: 41.8396, longitude: 43.3892 },
    { name: 'Gurjaani', latitude: 41.7436, longitude: 45.8003 }, { name: 'Kaspi', latitude: 41.9256, longitude: 44.4236 },
];

export const DEFAULT_TOWN = TOWNS[0];
export const townByName = (name?: string | null) => TOWNS.find(town => town.name.toLowerCase() === String(name ?? '').trim().toLowerCase()) ?? null;

const toRad = (value: number) => (value * Math.PI) / 180;
export function kmBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const dLat = toRad(b.latitude - a.latitude), dLng = toRad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const nearestTown = (latitude: number, longitude: number) =>
    TOWNS.reduce((best, town) => (kmBetween({ latitude, longitude }, town) < kmBetween({ latitude, longitude }, best) ? town : best), TOWNS[0]);

/** Asks the device once; resolves to the nearest town, or null when the person declines or it fails. */
export const locateTown = () => new Promise<Town | null>(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
        position => resolve(nearestTown(position.coords.latitude, position.coords.longitude)),
        () => resolve(null),
        { timeout: 10_000, maximumAge: 300_000 },
    );
});
