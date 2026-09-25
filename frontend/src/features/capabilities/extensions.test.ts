import { describe, expect, it } from 'vitest';
import {
    extensionCapabilities,
    resolveExtensionCapability,
    type ExtensionCapabilityKey,
} from './extensions';

const keys = Object.keys(extensionCapabilities) as ExtensionCapabilityKey[];

describe('extension capability resolution', () => {
    it('fails closed for every extension in production', () => {
        for (const key of keys) {
            expect(resolveExtensionCapability(key, { mockMode: false })).toMatchObject({
                key,
                productionBacked: false,
                availability: 'unavailable',
                available: false,
            });
        }
    });

    it('enables only explicitly implemented local demos when mocks are on', () => {
        expect(resolveExtensionCapability('volunteerShifts', { mockMode: true }).availability).toBe('demo');
        expect(resolveExtensionCapability('tournamentSeries', { mockMode: true }).availability).toBe('demo');
        expect(resolveExtensionCapability('tournamentRefereeManagement', { mockMode: true }).availability).toBe('demo');
        expect(resolveExtensionCapability('squadEnrollment', { mockMode: true }).availability).toBe('unavailable');
        expect(resolveExtensionCapability('eventVenueAttachment', { mockMode: true }).availability).toBe('unavailable');
    });

    it('provides a truthful escape route for every unavailable extension', () => {
        for (const definition of Object.values(extensionCapabilities)) {
            expect(definition.unavailableDescription).toBeTruthy();
            expect(definition.fallbackPath).toMatch(/^\//);
            expect(definition.fallbackLabel).toBeTruthy();
        }
    });
});
