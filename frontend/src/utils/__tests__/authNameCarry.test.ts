import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPendingName, getPendingName, clearPendingName } from '../authNameCarry';

describe('authNameCarry', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('stores and retrieves the trimmed pending name', () => {
        setPendingName('  Khvicha Kvaratskhelia  ');
        expect(getPendingName()).toBe('Khvicha Kvaratskhelia');
    });

    it('clears the pending name', () => {
        setPendingName('Khvicha');
        clearPendingName();
        expect(getPendingName()).toBeNull();
    });

    it('overwrites a stale pending name', () => {
        setPendingName('Stale Name');
        setPendingName('Fresh Name');
        expect(getPendingName()).toBe('Fresh Name');
    });

    it('returns null when nothing was stored', () => {
        expect(getPendingName()).toBeNull();
    });

    it('no-ops when sessionStorage is unavailable', () => {
        const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage disabled');
        });
        const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage disabled');
        });
        try {
            setPendingName('Khvicha');
            expect(getPendingName()).toBeNull();
            clearPendingName(); // must not throw
        } finally {
            setSpy.mockRestore();
            getSpy.mockRestore();
        }
    });
});
