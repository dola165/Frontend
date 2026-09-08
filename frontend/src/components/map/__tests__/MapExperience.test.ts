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

    it('keeps authenticated defaults compatible with the existing route', () => {
        expect(resolveMapExperienceOptions({ darkMode: true })).toEqual({
            context: 'authenticated',
            mapDarkMode: true,
            showAdvancedFilters: true,
            showModeControl: true,
            showBackControl: true
        });
    });

    it('allows an explicit theme/control override for an authenticated composed surface', () => {
        expect(resolveMapExperienceOptions({
            darkMode: false,
            context: 'authenticated',
            mapTheme: 'dark',
            showAdvancedFilters: true,
            showModeControl: true,
            showBackControl: true
        })).toEqual({
            context: 'authenticated',
            mapDarkMode: true,
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

    it('allows the landing composition to force a dark map without changing guest controls', () => {
        expect(resolveMapExperienceOptions({
            darkMode: false,
            context: 'guest',
            mapTheme: 'dark'
        })).toEqual({
            context: 'guest',
            mapDarkMode: true,
            showAdvancedFilters: false,
            showModeControl: false,
            showBackControl: false
        });
    });
});

describe('resolveMapExperienceEntityTypes', () => {
    it('never widens a guest surface even when a caller passes staff types', () => {
        expect(resolveMapExperienceEntityTypes({
            context: 'guest',
            hasStaffAccess: true,
            allowedEntityTypes: ['MATCH', 'TOURNAMENT']
        })).toEqual(['CLUB']);
    });

    it('keeps restricted authenticated viewers on clubs', () => {
        expect(resolveMapExperienceEntityTypes({
            context: 'authenticated',
            hasStaffAccess: false
        })).toEqual(['CLUB']);
    });

    it('supports a narrower allowlist for staff surfaces', () => {
        expect(resolveMapExperienceEntityTypes({
            context: 'authenticated',
            hasStaffAccess: true,
            allowedEntityTypes: ['MATCH']
        })).toEqual(['MATCH']);
    });

    it('fails closed to clubs when an explicit allowlist has no safe overlap', () => {
        expect(resolveMapExperienceEntityTypes({
            context: 'authenticated',
            hasStaffAccess: true,
            allowedEntityTypes: []
        })).toEqual(['CLUB']);
    });
});
