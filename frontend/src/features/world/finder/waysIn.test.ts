import { describe, expect, it } from 'vitest';
import { bornOfCode, programmeBorn } from '../cards/programmes';
import type { TrainingProgramme } from '../../clubs/presentation';
import { bornLabel, firstLine, groupShareUrl, parentGroupLabel, parentName, programmeBornYears, telLink, tryoutFits, tryoutIcs, visitChanges, whatsAppLink } from './waysIn';

const en = (text: string) => text;
const programme = (ageMin: number | null, ageMax: number | null) => ({ ageMin, ageMax }) as TrainingProgramme;

describe('fix round 1 (Codex’s review)', () => {
    it('S14: names a programme or group as a parent reads it, birth years beside it, never a U-code', () => {
        expect(parentName('Foundation (U8–U10)')).toBe('Foundation');
        expect(parentName('U12 Boys')).toBe('Boys');
        expect(parentName('Girls U-14')).toBe('Girls');
        expect(parentName('Under 12s Saturday')).toBe('Saturday');
        expect(parentName('U8-10 · Beginners')).toBe('Beginners');
        expect(parentName('U12')).toBeNull();
        expect(parentName('Ultras Academy')).toBe('Ultras Academy');
        expect(parentGroupLabel(en, 'Foundation (U8–U10)', 2017, 2020)).toBe('Foundation · born 2017–2020');
        expect(parentGroupLabel(en, 'U12', 2014, 2014)).toBe('Born 2014');
        expect(parentGroupLabel(en, 'U12', null, null)).toBe('U12');
    });

    it('S2: says what changed since the family looked, one line each, and nothing when nothing they saw changed', () => {
        const when = (iso: string) => iso.slice(11, 16);
        const session = { reference: 'session:12', startsAt: '2026-11-01T07:00:00Z', endsAt: '2026-11-01T08:30:00Z', place: 'Rustavi ground' };
        const seen = { fee: null, currency: null, places: 3, session };
        expect(visitChanges(en, seen, { fee: null, currency: null, places: 3, sessions: [session] }, when)).toEqual([]);
        expect(visitChanges(en, seen, { fee: 20, currency: 'GEL', places: 2, sessions: [{ ...session, startsAt: '2026-11-01T08:00:00Z', place: 'Vake' }] }, when))
            .toEqual(['Price: 20 GEL, was Free', 'At most 2 a session, was 3', 'Training: 08:00–08:30 · Vake, was 07:00–08:30 · Rustavi ground']);
        expect(visitChanges(en, seen, { fee: null, currency: null, places: 3, sessions: [] }, when)).toEqual(['The training on 07:00 is no longer offered']);
    });
});

describe('the ways in to a club (step 5)', () => {
    it('calls and messages only a number the club filled in', () => {
        expect(telLink('+995 32 224 11 25')).toBe('tel:+995322241125');
        expect(telLink('')).toBeNull();
        expect(telLink('12')).toBeNull();
        expect(whatsAppLink('+995 599 41 22 18')).toBe('https://wa.me/995599412218');
        // A Georgian mobile written without the country code gets +995.
        expect(whatsAppLink('599 41 22 18')).toBe('https://wa.me/995599412218');
        expect(whatsAppLink(null)).toBeNull();
    });

    it('writes the first line from what the family knows, and nothing more', () => {
        expect(firstLine(en, { name: 'Nino Beridze', gender: 'FEMALE', birthYear: 2017 }, 'Beginners')).toBe('Hello, my daughter Nino was born in 2017. Is there a place in Beginners?');
        expect(firstLine(en, { name: 'Saba', gender: null, birthYear: null })).toBe('Hello, my child Saba. Is there a place for them at your club?');
        expect(firstLine(en, null, 'Beginners')).toBe('Hello, I would like to ask about Beginners.');
        const link = whatsAppLink('+995 599 41 22 18', firstLine(en, { name: 'Nino', gender: 'FEMALE', birthYear: 2017 }))!;
        expect(decodeURIComponent(link.split('?text=')[1])).toContain('my daughter Nino was born in 2017');
    });

    it('reads ages as birth years, never U-codes', () => {
        expect(bornLabel(en, 2017, 2019)).toBe('born 2017–2019');
        expect(bornLabel(en, 2019, 2017)).toBe('born 2017–2019');
        expect(bornLabel(en, 2018, 2018)).toBe('born 2018');
        expect(bornLabel(en, null, null)).toBeNull();
        expect(programmeBornYears(8, 10, 2026)).toEqual({ from: 2016, to: 2018 });
        expect(programmeBornYears(null, null, 2026)).toBeNull();
        expect(programmeBorn(programme(6, 8), 2026)).toBe('Born 2018–2020');
        expect(programmeBorn(programme(6, null), 2026)).toBe('Born 2020 or earlier');
        expect(programmeBorn(programme(null, 12), 2026)).toBe('Born 2014 or later');
        expect(programmeBorn(programme(9, 9), 2026)).toBe('Born 2017');
        // A U-code stands for one birth year, as joining groups count it.
        expect(bornOfCode('U9', 2026)).toBe('Born 2018');
        expect(bornOfCode('SENIOR', 2026)).toBeNull();
    });

    it('shows a tryout only to a child of its age group', () => {
        expect(tryoutFits('U16', 2019, 2026)).toBe(false);
        expect(tryoutFits('U14', 2014, 2026)).toBe(true);
        expect(tryoutFits('U14', 2012, 2026)).toBe(false);
        expect(tryoutFits(null, 2019, 2026)).toBe(true);
        expect(tryoutFits('U16', undefined, 2026)).toBe(true);
    });

    it('puts a tryout in the family’s own calendar', () => {
        const ics = tryoutIcs({ id: 7, title: 'Open trial; U12', clubName: 'Dinamo', tryoutDate: '2026-11-04T13:00:00Z', location: 'Pitch 3, Digomi' }, new Date('2026-10-29T10:00:00Z'));
        expect(ics).toContain('DTSTART:20261104T130000Z');
        expect(ics).toContain('DTEND:20261104T150000Z');
        expect(ics).toContain('SUMMARY:Open trial\\; U12 · Dinamo');
        expect(ics).toContain('LOCATION:Pitch 3\\, Digomi');
        expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    });

    it('shares the group’s own address, which old links keep', () => {
        expect(groupShareUrl(1301, 'https://grasskickz.ge')).toBe('https://grasskickz.ge/admissions/opportunities/1301');
    });
});
