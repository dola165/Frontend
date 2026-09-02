import { describe, expect, it } from 'vitest';
import en from '../en';
import ka from '../ka';

const leafPaths = (value: unknown, prefix = ''): string[] => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value as Record<string, unknown>)
            .flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
    }
    return [prefix];
};

describe('locale catalog parity', () => {
    it('keeps Georgian and English translation keys in sync', () => {
        expect(leafPaths(ka).sort()).toEqual(leafPaths(en).sort());
    });
});
