import { apiClient } from '../../api/axiosConfig';
import type { FootballProfile, RoleProfile } from '../roles/domain';

export interface CareerHistoryDto {
    id: number; clubName: string; season: string; category: string;
    appearances: number; goals: number; assists: number; cleanSheets: number;
}

/** A person's public profile as `GET /users/:id` returns it. */
export interface PersonProfile {
    footballProfile?: FootballProfile | null;
    roleProfiles?: RoleProfile[];
    id: number;
    username: string;
    fullName?: string | null;
    role: string;
    position?: string | null;
    secondaryPosition?: string | null;
    preferredFoot?: string | null;
    bio?: string | null;
    availabilityStatus?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    followerCount: number;
    followingCount: number;
    isFollowedByMe: boolean;
    careerHistory?: CareerHistoryDto[];
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    /** Withheld by the server for minors and for anyone who keeps it private. */
    dateOfBirth?: string | null;
    isPrivate?: boolean;
    /** Only on your own profile: the phone you added for colleagues (they see it in Club office › Staff). */
    phone?: string | null;
}

// Counts, flags and lists can be missing from older API answers; a gap must not take the page down.
const count = (value: unknown): number => {
    if (value === undefined || value === null) return 0;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('The profile response contains an invalid count.');
    return value;
};
const list = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

export const readPersonProfile = (value: PersonProfile): PersonProfile => ({
    ...value,
    followerCount: count(value.followerCount),
    followingCount: count(value.followingCount),
    isFollowedByMe: value.isFollowedByMe === true,
    isPrivate: value.isPrivate === true,
    roleProfiles: list(value.roleProfiles),
    careerHistory: list(value.careerHistory),
    footballProfile: value.footballProfile && { ...value.footballProfile, appointments: list(value.footballProfile.appointments), entries: list(value.footballProfile.entries) },
});
export const fetchPersonProfile = async (id: number, signal?: AbortSignal) =>
    readPersonProfile((await apiClient.get<PersonProfile>(`/users/${id}`, { signal })).data);

export type Verification = 'SELF_REPORTED' | 'CLUB_CONFIRMED' | 'DOCUMENT_CHECKED';

/**
 * What a person does professionally, in their own words ("Sports psychologist").
 * `label` is the searchable label admins or Dola map it to; verification is set by the server, never by the person.
 */
export interface Profession {
    id: number;
    title: string;
    label: string | null;
    detail: string | null;
    since: string | null;
    published: boolean;
    verification: Verification;
    verifiedBy: string | null;
}
export type ProfessionInput = Pick<Profession, 'title' | 'detail' | 'since' | 'published'> & { id?: number };

export const fetchProfessions = async (userId: number, signal?: AbortSignal) =>
    (await apiClient.get<Profession[]>(`/users/${userId}/professions`, { signal })).data;
export interface ProfessionSet { items: Profession[]; version: number }
export const fetchOwnProfessions = async (signal?: AbortSignal) =>
    (await apiClient.get<ProfessionSet>('/users/me/professions', { signal })).data;
export const saveProfessions = async (professions: ProfessionInput[], expectedVersion: number, requestId: string) =>
    (await apiClient.put<ProfessionSet>('/users/me/professions', { professions, expectedVersion, requestId })).data;
export interface DiscoveryPreferences { openTo: ('WORK' | 'SERVICES' | 'VOLUNTEER' | 'CLUB' | 'COACHING')[]; licence: 'PRO' | 'A' | 'B' | 'C' | 'GK' | null; rate: { amount: number; currency: string; per: 'SESSION' } | null; version: number }
export const fetchDiscoveryPreferences = async (signal?: AbortSignal) =>
    (await apiClient.get<DiscoveryPreferences>('/users/me/discovery', { signal })).data;
export const saveDiscoveryPreferences = async (value: Omit<DiscoveryPreferences, 'version'>, expectedVersion: number, requestId: string) =>
    (await apiClient.put<DiscoveryPreferences>('/users/me/discovery', { ...value, expectedVersion, requestId })).data;
export const saveAbout = async (bio: string) => apiClient.put('/users/me', { bio });
/** The phone colleagues may call, on your own profile; an empty one removes it. Adults only. */
export const saveMyPhone = async (phone: string) => (await apiClient.put<PersonProfile>('/users/me', { phone })).data;
/** The person's own profile photo or cover. */
export const saveMyImage = async (field: 'banner' | 'avatar', url: string) => apiClient.put('/users/me', field === 'avatar' ? { avatarUrl: url } : { bannerUrl: url });
/** Gives an account its birth date, once (the server refuses to change it later). */
export const saveBirthDate = async (dateOfBirth: string) => apiClient.put('/users/me', { dateOfBirth });

/** Free-text suggestions; people can type anything else. */
export const professionSuggestions = [
    'Sports psychologist', 'Physiotherapist', 'Sports doctor', 'Nutritionist', 'Strength and conditioning coach', 'Video analyst',
    'Photographer', 'Videographer', 'Physical education teacher', 'Sports lawyer', 'Accountant', 'Marketing and social media',
    'Event organizer', 'Groundskeeper', 'Kit manager', 'Driver', 'Translator', 'First aider',
];
