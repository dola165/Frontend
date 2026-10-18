import {competitionInstant, competitionTimestamp} from './competitionTime';
it('uses the published zone independently of the device zone',()=>{expect(competitionInstant('2026-10-12T12:00','Asia/Tbilisi').toISOString()).toBe('2026-10-12T08:00:00.000Z');expect(competitionInstant('2026-10-12T12:00','America/New_York').toISOString()).toBe('2026-10-12T16:00:00.000Z');});
it('rejects nonexistent and repeated daylight-saving times',()=>{expect(()=>competitionInstant('2026-03-29T01:30','Europe/London')).toThrow('unambiguous');expect(()=>competitionInstant('2026-10-25T01:30','Europe/London')).toThrow('unambiguous');});
it('rejects an invalid calendar date and invalid zone',()=>{expect(()=>competitionInstant('2026-02-30T12:00','Asia/Tbilisi')).toThrow();expect(()=>competitionInstant('2026-10-12T12:00','Invalid/Zone')).toThrow();});
it('keeps authoritative API offsets and resolves older reads in their published zone', () => {
 expect(competitionTimestamp('2027-01-10T00:30-05:00', 'Asia/Tbilisi')).toBe('2027-01-10T00:30-05:00');
 expect(competitionTimestamp('2027-01-10T00:30', 'America/New_York')).toBe('2027-01-10T05:30:00.000Z');
 expect(competitionTimestamp('2027-07-10T00:30', 'America/New_York')).toBe('2027-07-10T04:30:00.000Z');
 expect(competitionTimestamp('2027-01-10T00:30', 'Pacific/Auckland')).toBe('2027-01-09T11:30:00.000Z');
 expect(competitionTimestamp('2027-03-14T02:30', 'America/New_York')).toBeNull();
});
