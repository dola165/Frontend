import { describe, expect, it } from 'vitest';
import { parseWorkspaceTab } from '../types';

describe('workspace tab URL parsing', () => {
    it('accepts known workspace tabs', () => {
        expect(parseWorkspaceTab('players')).toBe('players');
        expect(parseWorkspaceTab('inbox')).toBe('inbox');
    });

    it('rejects unknown or missing tabs', () => {
        expect(parseWorkspaceTab('settings-and-secrets')).toBeNull();
        expect(parseWorkspaceTab('store')).toBe('store');
        expect(parseWorkspaceTab(null)).toBeNull();
    });
});
