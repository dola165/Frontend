import type { ClubProfile } from './types';

// The shared Kotlin ClubProfileDto declares zero defaults for these counts.
// Its JSON encoder omits default values; the synthetic API always included them.
const count = (value: unknown): number => {
    if (value === undefined) return 0;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new Error('The club response contains an invalid count.');
    }
    return value;
};

export const readClubProfile = (value: ClubProfile): ClubProfile => ({
    ...value,
    followerCount: count(value.followerCount),
    memberCount: count(value.memberCount),
});
