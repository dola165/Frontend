import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { usePreferences } from '../preferences/preferencesStore';
import { fetchOwnProfessions, fetchPersonProfile, saveProfessions, type PersonProfile, type Profession } from '../profiles/api';
import type { CareerEntry, FootballProfile, FootballRole, RoleProfile } from '../roles/domain';
import { hasSkills, SKILLS, type ChipOwner } from './setupWords';
import { saveStart } from './startApi';

/** The parts of the person's own profile the setup shows and edits (GET and PUT /users/me). */
export interface OwnProfile { fullName: string; bio: string; avatarUrl: string }
/** A football history line added in the setup, saved with the profile. */
export interface HistoryInput { role: string; title: string; organization: string; startsOn: string }
/** One answer to "What do you do?", kept on the section of the choice it belongs to. */
export interface Chip { text: string; owner: ChipOwner }
/**
 * What the setup edits across its steps, until a step saves it: the choices of step 1, the details of "About you" (a
 * null headline is the suggested one), the chips, and history lines added on the finished profile.
 */
export interface SetupDraft { fullName: string; headline: string | null; bio: string; roles: FootballRole[]; business: boolean; chips: Chip[]; history: HistoryInput[] }

type Me = { fullName?: string | null; bio?: string | null; avatarUrl?: string | null };
const explicit = (profiles: RoleProfile[]) => profiles.map(profile => ({ ...profile, primary: profile.primary === true, published: profile.published === true }));
const split = (text?: string | null) => (text ?? '').split(',').map(part => part.trim()).filter(Boolean);
const same = (a?: string | null, b?: string | null) => (a ?? '') === (b ?? '');

/** A new account has no roles saved: the server then names its account type (Fan), unpublished, in their place. */
export const nothingSaved = (roles: RoleProfile[]) => roles.length === 1 && roles[0].role === 'FAN' && !roles[0].published
    && !roles[0].headline && !roles[0].specialties && !roles[0].qualifications && !roles[0].serviceArea;
const savedOnly = (roles: RoleProfile[]) => (nothingSaved(roles) ? [] : explicit(roles));

/** The main role: the one saved as main while still chosen, else the first real role over Fan, else the first. */
export const mainRoleOf = (roles: FootballRole[], saved: RoleProfile[]) =>
    roles.find(role => saved.some(item => item.role === role && item.primary)) ?? roles.find(role => role !== 'FAN') ?? roles[0] ?? null;

/** Where a chip goes: the choice it was suggested for, else the main role's section, else the business answer. */
export function ownerOf(text: string, roles: FootballRole[], business: boolean, main: FootballRole | null): ChipOwner | null {
    const lower = text.toLowerCase();
    const owners: ChipOwner[] = [...roles, ...(business ? ['BUSINESS' as const] : [])];
    const suggested = owners.find(owner => SKILLS[owner]?.some(words => words.some(word => word.toLowerCase() === lower)));
    if (suggested) return suggested;
    if (main && hasSkills(main)) return main;
    return roles.find(hasSkills) ?? (business ? 'BUSINESS' : null);
}
/** The chips that count with these choices: a chip of a choice no longer made is left out. */
export const activeChips = (draft: SetupDraft) => draft.chips.filter(chip => chip.owner === 'BUSINESS' ? draft.business : draft.roles.includes(chip.owner));

/** The role sections a draft saves: shown on the profile, the main one with the headline, each with its chips. */
export function rolesFor(draft: SetupDraft, saved: RoleProfile[], suggestedHeadline: string): RoleProfile[] {
    const main = mainRoleOf(draft.roles, saved);
    return draft.roles.map(role => {
        const before = saved.find(item => item.role === role);
        const chips = activeChips(draft).filter(chip => chip.owner === role).map(chip => chip.text);
        return {
            role, primary: role === main, published: true,
            headline: role === main ? (draft.headline ?? suggestedHeadline).trim() || null : before?.headline ?? null,
            specialties: hasSkills(role) ? chips.join(', ') || null : before?.specialties ?? null,
            qualifications: before?.qualifications ?? null, serviceArea: before?.serviceArea ?? null,
        };
    });
}
const rolesChanged = (next: RoleProfile[], saved: RoleProfile[]) => next.length !== saved.length || next.some(item => {
    const before = saved.find(other => other.role === item.role);
    return !before || before.primary !== item.primary || before.published !== item.published || !same(before.headline, item.headline) || !same(before.specialties, item.specialties);
});

/** The draft as the profile stands. */
export function draftOf(profile: OwnProfile, saved: RoleProfile[], business: boolean, professions: Profession[]): SetupDraft {
    const main = saved.find(item => item.primary) ?? saved[0];
    const chips: Chip[] = [
        ...saved.filter(item => hasSkills(item.role)).flatMap(item => split(item.specialties).map(text => ({ text, owner: item.role }))),
        ...(business ? professions.map(item => ({ text: item.title, owner: 'BUSINESS' as const })) : []),
    ];
    return { fullName: profile.fullName, headline: main?.headline ?? null, bio: profile.bio, roles: saved.map(item => item.role), business, chips, history: [] };
}

type Loaded = { profile: OwnProfile; roles: RoleProfile[]; history: CareerEntry[]; professions: { items: Profession[]; version: number } | null; page: PersonProfile | null };

/**
 * The person's profile while they set it up: their details, saved role sections, football history, what they do as a
 * business (their professions), and the profile page as others load it (for the preview).
 * Every save goes to the profile's own APIs; nothing is kept elsewhere.
 */
export function useSetupProfile(userId: number) {
    const { refreshNavigationCapabilities } = useAuth();
    const business = usePreferences(userId).start?.business === true;
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        const signal = controller.signal;
        Promise.all([
            apiClient.get<Me>('/users/me', { signal }).then(response => response.data),
            apiClient.get<RoleProfile[]>('/users/me/roles', { signal }).then(response => savedOnly(response.data)),
            apiClient.get<FootballProfile>(`/users/${userId}/career`, { signal }).then(response => response.data.entries ?? []).catch((): CareerEntry[] => []),
            fetchOwnProfessions(signal).catch(() => null),
            fetchPersonProfile(userId, signal).catch(() => null),
        ]).then(([me, roles, history, professions, page]) => {
            if (!signal.aborted) setLoaded({ profile: { fullName: me.fullName ?? '', bio: me.bio ?? '', avatarUrl: me.avatarUrl ?? '' }, roles, history, professions, page });
        }).catch(() => { if (!signal.aborted) setFailed(true); });
        return () => controller.abort();
    }, [userId, attempt]);

    const uploadPhoto = useCallback(async (file: File) => {
        const body = new FormData();
        body.append('file', file);
        const response = await apiClient.post<{ url?: string }>('/media/upload', body, { headers: { 'Content-Type': 'multipart/form-data' }, params: { context: 'profile' } });
        if (!response.data?.url) throw new Error('Upload did not return a media URL.');
        const url = response.data.url;
        await apiClient.put('/users/me', { avatarUrl: url });
        setLoaded(current => current && { ...current, profile: { ...current.profile, avatarUrl: url } });
    }, []);

    /**
     * Saves what the draft changed, part by part: details, role sections, the business answer, what they do as a
     * business, new history lines. Resolves to an error message, or '' when everything is kept.
     */
    const save = async (draft: SetupDraft, suggestedHeadline: string, failure: string) => {
        if (!loaded) return '';
        try {
            const details: Partial<OwnProfile> = {};
            if (draft.fullName.trim() && draft.fullName.trim() !== loaded.profile.fullName.trim()) details.fullName = draft.fullName.trim();
            if (draft.bio.trim() !== loaded.profile.bio.trim()) details.bio = draft.bio.trim();
            if (Object.keys(details).length) await apiClient.put('/users/me', details);
            const next = rolesFor(draft, loaded.roles, suggestedHeadline);
            let roles = loaded.roles;
            if (rolesChanged(next, loaded.roles)) {
                roles = savedOnly((await apiClient.put<RoleProfile[]>('/users/me/roles', { profiles: next })).data);
                void refreshNavigationCapabilities().catch(() => undefined);
            }
            if (draft.business !== business) await saveStart(userId, { business: draft.business });
            let professions = loaded.professions;
            const titles = activeChips(draft).filter(chip => chip.owner === 'BUSINESS').map(chip => chip.text);
            if (draft.business && professions && titles.join('\n') !== professions.items.map(item => item.title).join('\n')) {
                const items = professions.items;
                professions = await saveProfessions(titles.map(title => items.find(item => item.title === title) ?? { title, detail: null, since: null, published: true }), professions.version, crypto.randomUUID());
            }
            let history = loaded.history;
            for (const entry of draft.history) {
                const response = await apiClient.post<FootballProfile>('/users/me/career', {
                    role: entry.role, kind: 'POSITION', title: entry.title.trim(), organization: entry.organization.trim() || null,
                    startsOn: entry.startsOn, endsOn: null, description: null, published: true,
                });
                history = response.data.entries ?? history;
            }
            setLoaded(current => current && { ...current, profile: { ...current.profile, ...details }, roles, professions, history });
            return '';
        } catch (reason) { return extractApiErrorMessage(reason, failure); }
    };

    const retry = () => { setFailed(false); setAttempt(value => value + 1); };

    return { loaded, failed, business, retry, uploadPhoto, save };
}
export type SetupProfile = ReturnType<typeof useSetupProfile>;

/** The profile page as others would load it, made from the draft: what the preview beside the editor draws. */
export function previewOf(setup: Loaded, draft: SetupDraft, suggestedHeadline: string, userId: number): { person: PersonProfile; professions: Profession[] } {
    const base: PersonProfile = setup.page ?? { id: userId, username: '', role: 'FAN', followerCount: 0, followingCount: 0, isFollowedByMe: false };
    const entries: CareerEntry[] = [...setup.history, ...draft.history.map((entry, index) => ({
        id: -1 - index, role: entry.role, kind: 'POSITION' as const, title: entry.title, organization: entry.organization || null,
        startsOn: entry.startsOn, endsOn: null, description: null, published: true,
    }))];
    const professions: Profession[] = draft.business
        ? activeChips(draft).filter(chip => chip.owner === 'BUSINESS').map((chip, index) => ({ id: -1 - index, title: chip.text, label: null, detail: null, since: null, published: true, verification: 'SELF_REPORTED' as const, verifiedBy: null }))
        : (setup.professions?.items ?? []).filter(item => item.published);
    return {
        professions,
        person: {
            ...base, fullName: draft.fullName.trim() || base.fullName, bio: draft.bio.trim() || null, avatarUrl: setup.profile.avatarUrl || null,
            roleProfiles: rolesFor(draft, setup.roles, suggestedHeadline),
            footballProfile: { roles: draft.roles, appointments: base.footballProfile?.appointments ?? [], entries },
        },
    };
}
