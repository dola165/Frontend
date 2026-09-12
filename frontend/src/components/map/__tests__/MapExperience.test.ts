import { describe, expect, it } from 'vitest';
import {
    resolveMapExperienceEntityTypes,
    resolveMapExperienceOptions
} from '../MapExperience';

describe('resolveMapExperienceOptions', () => {
    it('defaults guest maps to a light, public-only surface', () => {
        expect(resolveMapExperienceOptions({ darkMode: true, context: 'guest' })).toEqual({
            context: 'guest',
            mapDarkMode: false,
            showAdvancedFilters: false,
            showModeControl: false,
            showBackControl: false
        });
    });

    it('keeps authenticated maps in daylight while retaining account controls', () => {
        expect(resolveMapExperienceOptions({ darkMode: true })).toEqual({
            context: 'authenticated',
            mapDarkMode: false,
            showAdvancedFilters: true,
            showModeControl: true,
            showBackControl: true
        });
    });

    it('keeps legacy theme overrides in daylight while honoring control options', () => {
        expect(resolveMapExperienceOptions({
            darkMode: false,
            context: 'authenticated',
            mapTheme: 'dark',
            showAdvancedFilters: true,
            showModeControl: true,
            showBackControl: true
        })).toEqual({
            context: 'authenticated',
            mapDarkMode: false,
            showAdvancedFilters: true,
            showModeControl: true,
            showBackControl: true
        });
    });

    it('does not let a guest caller opt back into account-oriented controls', () => {
        expect(resolveMapExperienceOptions({
            darkMode: false,
            context: 'guest',
            showAdvancedFilters: true,
            showModeControl: true,
            showBackControl: true
        })).toMatchObject({
            showAdvancedFilters: false,
            showModeControl: false,
            showBackControl: false
        });
    });

    it('keeps the landing map in daylight even when the composition requests dark', () => {
        expect(resolveMapExperienceOptions({
            darkMode: false,
            context: 'guest',
            mapTheme: 'dark'
        })).toEqual({
            context: 'guest',
            mapDarkMode: false,
            showAdvancedFilters: false,
            showModeControl: false,
            showBackControl: false
        });
    });
});

describe('resolveMapExperienceEntityTypes', () => {
    it('offers the same public types without needing an account role or membership', () => {
        expect(resolveMapExperienceEntityTypes({})).toEqual(['CLUB', 'MATCH', 'TOURNAMENT']);
    });
    it('supports a narrower club-only landing composition', () => {
        expect(resolveMapExperienceEntityTypes({ allowedEntityTypes: ['CLUB'] })).toEqual(['CLUB']);
    });
    it('honors an empty allowlist instead of silently returning clubs', () => {
        expect(resolveMapExperienceEntityTypes({ allowedEntityTypes: [] })).toEqual([]);
    });
});
