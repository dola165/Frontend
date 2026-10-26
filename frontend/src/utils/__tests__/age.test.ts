import { describe, it, expect } from 'vitest';
import { ageFromDob, isAdult, isKnownMinor, isMinor, isUnder13, todayIso } from '../age';

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

    it('has one meaning of adult: a known birth date 18 or more years ago', () => {
        const year = new Date().getFullYear();
        expect([isAdult('1990-01-01'), isAdult(`${year - 17}-01-01`), isAdult(null), isAdult('')]).toEqual([true, false, false, false]);
        // Only a known minor has adult-only things hidden; a missing birth date is asked for instead.
        expect([isKnownMinor(`${year - 17}-01-01`), isKnownMinor(null), isKnownMinor('1990-01-01')]).toEqual([true, false, false]);
        expect(ageFromDob(null)).toBeNull();
    });

    it('returns a valid ISO date from todayIso', () => {
        expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
