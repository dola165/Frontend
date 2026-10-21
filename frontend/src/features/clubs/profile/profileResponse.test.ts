import { expect, it } from 'vitest';
import { readClubProfile } from './profileResponse';

it('accepts the real API shape when the shared DTO omits its default follower count', () => {
    const profile = readClubProfile(JSON.parse('{"id":1,"name":"Dinamo","memberCount":90}'));
    expect(profile.followerCount.toLocaleString()).toBe('0');
    expect(profile.memberCount).toBe(90);
    expect(profile.name).toBe('Dinamo');
});
it('accepts a new club with both contract-defined zero counts omitted', () => {
    expect(readClubProfile(JSON.parse('{"id":400,"name":"New academy"}'))).toMatchObject({ followerCount: 0, memberCount: 0 });
});
it('preserves recorded nonzero counts', () => {
    expect(readClubProfile(JSON.parse('{"followerCount":14,"memberCount":25}'))).toMatchObject({ followerCount: 14, memberCount: 25 });
});
it.each([null, -1, '4'])('refuses an invalid explicit count instead of presenting it as zero (%s)', value => {
    expect(() => readClubProfile(JSON.parse(JSON.stringify({ followerCount: value, memberCount: 2 })))).toThrow('invalid count');
});
