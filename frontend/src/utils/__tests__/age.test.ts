import { describe, it, expect } from 'vitest';
import { ageFromDob, isMinor, isUnder13, todayIso } from '../age';

describe('age helpers — Aug 17 DOB fail-safe', () => {
    it('treats a missing DOB as a minor (fail-safe, mirrors backend MinorPolicy)', () => {
        expect(isMinor(null)).toBe(true);
        expect(isMinor(undefined)).toBe(true);
        expect(isMinor('')).toBe(true);
    });

    it('treats an adult DOB as an adult', () => {
        expect(isMinor('1990-01-01')).toBe(false);
        expect(isUnder13('1990-01-01')).toBe(false);
    });

    it('treats an under-13 DOB as under 13', () => {
        const kidYear = new Date().getFullYear() - 12;
        expect(isMinor(`${kidYear}-06-15`)).toBe(true);
        expect(isUnder13(`${kidYear}-06-15`)).toBe(true);
    });

    it('computes exact age from a DOB', () => {
        const fourteenYearsAgo = new Date();
        fourteenYearsAgo.setFullYear(fourteenYearsAgo.getFullYear() - 14);
        const dob = fourteenYearsAgo.toISOString().slice(0, 10);
        expect(ageFromDob(dob)).toBeGreaterThanOrEqual(14);
        expect(isMinor(dob)).toBe(true);
    });

    it('returns a valid ISO date from todayIso', () => {
        expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
