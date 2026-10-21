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
            expect(resolveExtensionCapability(key)).toMatchObject({
                key,
                productionBacked: false,
                availability: 'unavailable',
                available: false,
            });
        }
    });

    it('provides a truthful escape route for every unavailable extension', () => {
        for (const definition of Object.values(extensionCapabilities)) {
            expect(definition.unavailableDescription).toBeTruthy();
            expect(definition.fallbackPath).toMatch(/^\//);
            expect(definition.fallbackLabel).toBeTruthy();
        }
    });
});
