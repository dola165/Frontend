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
}

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
export const saveProfessions = async (professions: ProfessionInput[]) =>
    (await apiClient.put<Profession[]>('/users/me/professions', { professions })).data;
export const saveAbout = async (bio: string) => apiClient.put('/users/me', { bio });

/** Free-text suggestions; people can type anything else. */
export const professionSuggestions = [
    'Sports psychologist', 'Physiotherapist', 'Sports doctor', 'Nutritionist', 'Strength and conditioning coach', 'Video analyst',
    'Photographer', 'Videographer', 'Physical education teacher', 'Sports lawyer', 'Accountant', 'Marketing and social media',
    'Event organizer', 'Groundskeeper', 'Kit manager', 'Driver', 'Translator', 'First aider',
];
