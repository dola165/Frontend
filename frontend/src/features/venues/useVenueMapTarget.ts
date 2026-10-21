import { useEffect, useState } from 'react';
import type { MapMarkerDto } from '../../api/map';
import { fetchVenue, type Venue } from './api';
import { canBookVenue, fromPrice, money } from './utils';

export function venueMapMarker(venue: Venue): MapMarkerDto {
    const { latitude, longitude } = venue;
    if (!venue.published || venue.promotionBlocked) throw new Error('This venue is unavailable on the public map.');
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('This venue has no saved map location yet.');
    const price = canBookVenue(venue) ? fromPrice(venue) : null;
    return { entityId: venue.id, entityType: 'STADIUM', title: venue.displayName, subtitle: 'Football venue',
        clubName: '', latitude, longitude, distanceKm: 0, members: 0, followers: 0,
        verified: venue.verificationStatus === 'VERIFIED', date: '', fee: price == null ? '' : `${money(price, venue.currency)} / hour`,
        addressText: venue.addressText, ageGroup: '', status: '', cityName: venue.city, countryName: '', logoUrl: venue.logoUrl };
}

/** Resolve an ID against the same privacy-checked resource used by its profile. */
export function useVenueMapTarget(id: number | null, onReady: (marker: MapMarkerDto) => void) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ id: number; attempt: number; marker: MapMarkerDto | null; error: string } | null>(null);
    useEffect(() => {
        if (id == null) return;
        const controller = new AbortController();
        void fetchVenue(id, controller.signal).then(venue => {
            if (controller.signal.aborted) return;
            const marker = venueMapMarker(venue);
            setResult({ id, attempt, marker, error: '' });
            onReady(marker);
        }).catch(error => {
            if (!controller.signal.aborted) setResult({ id, attempt, marker: null,
                error: error instanceof Error && error.message.startsWith('This venue') ? error.message : 'This venue could not be opened on the map. Try again or return to its profile.' });
        });
        return () => controller.abort();
    }, [id, attempt, onReady]);
    const current = result?.id === id && result.attempt === attempt ? result : null;
    return { marker: id == null ? null : current?.marker ?? null, loading: id != null && !current,
        error: id == null ? '' : current?.error ?? '', retry: () => setAttempt(value => value + 1) };
}
