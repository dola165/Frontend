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
        unavailableDescription: 'Squad invitations and family enrollment are not connected to the GrassKickZ service yet. Existing squad rosters and family information are still available.',
        fallbackPath: '/squads',
        fallbackLabel: 'Open my squads',
    },
    volunteerShifts: {
        title: 'Volunteer shifts',
        productionBacked: false,
        localDemo: true,
        unavailableDescription: 'Dated volunteer shift signup, reminders, attendance and coordination are not connected to the production service yet. Ongoing roles remain available.',
        fallbackPath: '/jobs',
        fallbackLabel: 'Browse roles',
    },
    eventVenueAttachment: {
        title: 'Event stadium reservations',
        productionBacked: false,
        localDemo: false,
        unavailableDescription: 'Linking a stadium reservation to an event is not connected yet. You can still browse stadiums and manage standalone bookings.',
        fallbackPath: '/stadiums',
        fallbackLabel: 'Browse stadiums',
    },
    tournamentSeries: {
        title: 'Tournament series',
        productionBacked: false,
        localDemo: true,
        unavailableDescription: 'Tournament editions and series are not stored by the production service yet. Individual tournaments remain available.',
        fallbackPath: '/tournaments',
        fallbackLabel: 'Browse tournaments',
    },
    tournamentRefereeManagement: {
        title: 'Tournament referee management',
        productionBacked: false,
        localDemo: true,
        unavailableDescription: 'Tournament referee invitations and reports are not connected yet. Referee profiles and Match Exchange appointments remain available.',
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
