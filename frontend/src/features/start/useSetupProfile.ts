import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import type { CareerEntry, FootballProfile, FootballRole, RoleProfile } from '../roles/domain';
import { fetchFollowedClubCount } from './startApi';

/** The parts of the person's own profile the setup shows and edits (GET and PUT /users/me). */
export interface OwnProfile { fullName: string; bio: string; avatarUrl: string }
/** A football history entry as the setup adds it: one line, published with the profile. */
export interface HistoryInput { role: string; title: string; organization: string; startsOn: string }

type Me = { fullName?: string | null; bio?: string | null; avatarUrl?: string | null };
const ownProfile = (me: Me): OwnProfile => ({ fullName: me.fullName ?? '', bio: me.bio ?? '', avatarUrl: me.avatarUrl ?? '' });

/**
 * The person's profile while they set it up: their details, football history and how many clubs they follow, loaded
 * once and kept current as each step saves. Every save goes to the profile's own APIs; nothing is kept elsewhere.
 */
export function useSetupProfile(userId: number) {
    const [profile, setProfile] = useState<OwnProfile | null>(null);
    const [history, setHistory] = useState<CareerEntry[] | null>(null);
    const [followed, setFollowed] = useState<number | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        apiClient.get<Me>('/users/me', { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setProfile(ownProfile(response.data)); })
            .catch(() => { if (!controller.signal.aborted) setFailed(true); });
        apiClient.get<FootballProfile>(`/users/${userId}/career`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setHistory(response.data.entries ?? []); })
            .catch(() => { if (!controller.signal.aborted) setHistory([]); });
        return () => controller.abort();
    }, [userId, attempt]);

    /** Saves the changed details; resolves once the server holds them (and rejects, keeping nothing, when it refuses). */
    const saveProfile = useCallback(async (changes: Partial<OwnProfile>) => {
        if (!Object.keys(changes).length) return;
        await apiClient.put('/users/me', { fullName: changes.fullName, bio: changes.bio, avatarUrl: changes.avatarUrl });
        setProfile(current => current && { ...current, ...changes });
    }, []);

    const uploadPhoto = useCallback(async (file: File) => {
        const body = new FormData();
        body.append('file', file);
        const response = await apiClient.post<{ url?: string }>('/media/upload', body, { headers: { 'Content-Type': 'multipart/form-data' }, params: { context: 'profile' } });
        if (!response.data?.url) throw new Error('Upload did not return a media URL.');
        await saveProfile({ avatarUrl: response.data.url });
    }, [saveProfile]);

    const addHistory = useCallback(async (entry: HistoryInput) => {
        const response = await apiClient.post<FootballProfile>('/users/me/career', {
            role: entry.role, kind: 'POSITION', title: entry.title.trim(), organization: entry.organization.trim() || null,
            startsOn: entry.startsOn, endsOn: null, description: null, published: true,
        });
        setHistory(response.data.entries ?? []);
    }, []);

    const countFollowed = useCallback(() => {
        void fetchFollowedClubCount().then(setFollowed).catch(() => setFollowed(null));
    }, []);

    const retry = () => { setFailed(false); setAttempt(value => value + 1); };
    return { profile, history, followed, failed, retry, saveProfile, uploadPhoto, addHistory, countFollowed };
}
export type SetupProfile = ReturnType<typeof useSetupProfile>;

/**
 * What "About you" edits: the details on the profile, the headline, and one short line per chosen role, kept on that
 * role's section of the profile (where they play, the age groups they coach, their work at a club, their level).
 */
export interface AboutDraft { fullName: string; headline: string; bio: string; playing: string; coachAges: string; staffWork: string; refereeLevel: string }

const roleOf = (roles: RoleProfile[], role: FootballRole) => roles.find(item => item.role === role);
const mainRole = (roles: RoleProfile[]) => roles.find(item => item.primary) ?? roles[0];

/** The draft as the profile stands; an empty headline starts as the suggested one ("Coach · Tbilisi"). */
export const aboutDraft = (profile: OwnProfile, roles: RoleProfile[], suggestedHeadline: string): AboutDraft => ({
    fullName: profile.fullName, bio: profile.bio,
    playing: roleOf(roles, 'PLAYER')?.specialties ?? '',
    headline: mainRole(roles)?.headline?.trim() || suggestedHeadline,
    coachAges: roleOf(roles, 'COACH')?.specialties ?? '',
    staffWork: roleOf(roles, 'CLUB_STAFF')?.specialties ?? '',
    refereeLevel: roleOf(roles, 'REFEREE')?.qualifications ?? '',
});

/** The changes a draft makes: details for PUT /users/me, and the role profiles with their new lines (or null). */
export function aboutChanges(draft: AboutDraft, profile: OwnProfile, roles: RoleProfile[]) {
    const details: Partial<OwnProfile> = {};
    // A name is never cleared here; the about text may be.
    if (draft.fullName.trim() && draft.fullName.trim() !== profile.fullName.trim()) details.fullName = draft.fullName.trim();
    if (draft.bio.trim() !== profile.bio.trim()) details.bio = draft.bio.trim();
    const main = mainRole(roles);
    const lines = (item: RoleProfile): Partial<RoleProfile> => ({
        ...(item === main ? { headline: draft.headline.trim() || null } : {}),
        ...(item.role === 'PLAYER' ? { specialties: draft.playing.trim() || null } : {}),
        ...(item.role === 'COACH' ? { specialties: draft.coachAges.trim() || null } : {}),
        ...(item.role === 'CLUB_STAFF' ? { specialties: draft.staffWork.trim() || null } : {}),
        ...(item.role === 'REFEREE' ? { qualifications: draft.refereeLevel.trim() || null } : {}),
    });
    const next = roles.map(item => ({ ...item, ...lines(item) }));
    const same = (a?: string | null, b?: string | null) => (a ?? '') === (b ?? '');
    const changed = next.some((item, index) => !same(item.headline, roles[index].headline) || !same(item.specialties, roles[index].specialties) || !same(item.qualifications, roles[index].qualifications));
    return { details, roles: changed ? next : null };
}

/**
 * The roles as the setup keeps them: shown on the profile (the person chose them for it), and the first real role
 * leading over the account's starting Fan role.
 */
export function rolesToKeep(profiles: RoleProfile[]): RoleProfile[] {
    const lead = profiles.find(profile => profile.role !== 'FAN');
    const fanLeads = profiles.some(profile => profile.primary && profile.role === 'FAN');
    return profiles.map(profile => ({ ...profile, published: true, primary: fanLeads && lead ? profile === lead : profile.primary }));
}
