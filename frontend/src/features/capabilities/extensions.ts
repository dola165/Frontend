export type ExtensionCapabilityKey =
    | 'squadEnrollment'
    | 'volunteerShifts'
    | 'eventVenueAttachment'
    | 'tournamentSeries'
    | 'tournamentRefereeManagement';

export type ExtensionAvailability = 'available' | 'demo' | 'unavailable';

export interface ExtensionCapabilityDefinition {
    title: string;
    productionBacked: boolean;
    localDemo: boolean;
    unavailableDescription: string;
    fallbackPath: string;
    fallbackLabel: string;
}

export interface ExtensionCapabilityRuntime {
    mockMode: boolean;
}

export const extensionCapabilities = {
    squadEnrollment: {
        title: 'Squad enrollment',
        productionBacked: false,
        localDemo: false,
        unavailableDescription: 'Online squad enrollment is not available here yet. Contact the club to arrange joining; your existing family connections and team schedule are in Parent Hub.',
        fallbackPath: '/parent',
        fallbackLabel: 'Open Parent Hub',
    },
    volunteerShifts: {
        title: 'Volunteer shifts',
        productionBacked: false,
        localDemo: true,
        unavailableDescription: 'You cannot sign up for individual volunteer shifts here yet. Browse ongoing roles to find another way to contribute.',
        fallbackPath: '/jobs',
        fallbackLabel: 'Browse roles',
    },
    eventVenueAttachment: {
        title: 'Event stadium reservations',
        productionBacked: false,
        localDemo: false,
        unavailableDescription: 'Attaching a stadium reservation to an event is not available here yet. You can still find a venue and manage your bookings.',
        fallbackPath: '/stadiums',
        fallbackLabel: 'Browse stadiums',
    },
    tournamentSeries: {
        title: 'Tournament series',
        productionBacked: false,
        localDemo: true,
        unavailableDescription: 'Managing a series of tournament editions is not available here yet. You can still browse and work with individual tournaments.',
        fallbackPath: '/tournaments',
        fallbackLabel: 'Browse tournaments',
    },
    tournamentRefereeManagement: {
        title: 'Tournament referee management',
        productionBacked: false,
        localDemo: true,
        unavailableDescription: 'Tournament referee management is not available here yet. Referee profiles and Match Exchange appointments are still available.',
        fallbackPath: '/tournaments',
        fallbackLabel: 'Browse tournaments',
    },
} as const satisfies Record<ExtensionCapabilityKey, ExtensionCapabilityDefinition>;

export const extensionCapabilityRuntime: ExtensionCapabilityRuntime = Object.freeze({
    mockMode: import.meta.env.VITE_ENABLE_MOCKS === 'true',
});

export function resolveExtensionCapability(
    key: ExtensionCapabilityKey,
    runtime: ExtensionCapabilityRuntime = extensionCapabilityRuntime,
) {
    const definition = extensionCapabilities[key];
    const availability: ExtensionAvailability = definition.productionBacked
        ? 'available'
        : runtime.mockMode && definition.localDemo
            ? 'demo'
            : 'unavailable';

    return {
        key,
        ...definition,
        availability,
        available: availability !== 'unavailable',
    };
}

export function isExtensionCapabilityAvailable(key: ExtensionCapabilityKey) {
    return resolveExtensionCapability(key).available;
}

export function isExtensionCapabilityDemo(key: ExtensionCapabilityKey) {
    return resolveExtensionCapability(key).availability === 'demo';
}
