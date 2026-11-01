export function directionsUrl(place?: string | null, lat?: number | null, lng?: number | null) {
    const coordinates = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const destination = coordinates ? `${lat},${lng}` : place?.trim();
    return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
}

