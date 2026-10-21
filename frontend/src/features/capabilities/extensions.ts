export type ExtensionCapabilityKey =
    | 'squadEnrollment'
    | 'volunteerShifts'
    | 'eventVenueAttachment'
    | 'tournamentSeries'
    | 'tournamentRefereeManagement';

export type ExtensionAvailability = 'available' | 'unavailable';

export interface ExtensionCapabilityDefinition {
    title: string;
    productionBacked: boolean;
    unavailableDescription: string;
    fallbackPath: string;
    fallbackLabel: string;
}

export const extensionCapabilities = {
    squadEnrollment: {
        title: 'Squad enrollment',
        productionBacked: false,
        unavailableDescription: 'Online squad enrollment is not available here yet. Contact the club to arrange joining; your existing family connections and team schedule are in Parent Hub.',
        fallbackPath: '/parent',
        fallbackLabel: 'Open Parent Hub',
    },
    volunteerShifts: {
        title: 'Volunteer shifts',
        productionBacked: false,
        unavailableDescription: 'You cannot sign up for individual volunteer shifts here yet. Browse ongoing roles to find another way to contribute.',
        fallbackPath: '/jobs',
        fallbackLabel: 'Browse roles',
    },
    eventVenueAttachment: {
        title: 'Event stadium reservations',
        productionBacked: false,
        unavailableDescription: 'Attaching a stadium reservation to an event is not available here yet. You can still find a venue and manage your bookings.',
        fallbackPath: '/stadiums',
        fallbackLabel: 'Browse stadiums',
    },
    tournamentSeries: {
        title: 'Tournament series',
        productionBacked: false,
        unavailableDescription: 'Managing a series of tournament editions is not available here yet. You can still browse and work with individual tournaments.',
        fallbackPath: '/tournaments',
        fallbackLabel: 'Browse tournaments',
    },
    tournamentRefereeManagement: {
        title: 'Tournament referee management',
        productionBacked: false,
        unavailableDescription: 'Tournament referee management is not available here yet. Referee profiles and Match Exchange appointments are still available.',
        fallbackPath: '/tournaments',
        fallbackLabel: 'Browse tournaments',
    },
} as const satisfies Record<ExtensionCapabilityKey, ExtensionCapabilityDefinition>;

export function resolveExtensionCapability(key: ExtensionCapabilityKey) {
    const definition = extensionCapabilities[key];
    const availability: ExtensionAvailability = definition.productionBacked ? 'available' : 'unavailable';

    return {
        key,
        ...definition,
        availability,
        available: availability === 'available',
    };
}

export function isExtensionCapabilityAvailable(key: ExtensionCapabilityKey) {
    return resolveExtensionCapability(key).available;
}
