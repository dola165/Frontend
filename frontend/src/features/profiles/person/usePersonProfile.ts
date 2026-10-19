import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { profileRoles } from '../../roles/domain';
import { fetchPersonProfile, fetchProfessions, type PersonProfile, type Profession } from '../api';

/**
 * A person's profile, their professions and what the viewer may see and do.
 * The server already withholds private and minors' details; the page never fills them in.
 */
export function usePersonProfile(id: number) {
    const { user, sessionId } = useAuth();
    const [revision, setRevision] = useState(0);
    // Answers are kept with the person they belong to; a reload keeps the profile on screen until the new answer arrives.
    const key = `${id}:${sessionId}:${revision}`;
    const [result, setResult] = useState<{ key: string; id: number; profile: PersonProfile | null; status: 'ready' | 'missing' | 'failed' } | null>(null);
    const [professions, setProfessions] = useState<{ key: string; items: Profession[] | null; failed: boolean } | null>(null);
    const currentProfessions = professions?.key === key ? professions : null;

    useEffect(() => {
        const controller = new AbortController();
        void fetchPersonProfile(id, controller.signal)
            .then(profile => { if (!controller.signal.aborted) setResult({ key, id, profile, status: 'ready' }); })
            .catch(error => { if (!controller.signal.aborted) setResult({ key, id, profile: null, status: error?.response?.status === 404 ? 'missing' : 'failed' }); });
        return () => controller.abort();
    }, [id, key]);
    const current = result?.id === id ? result : null;
    const profile = current?.profile ?? null;
    const status = current ? current.status : 'loading';
    const setProfile = (change: (previous: PersonProfile | null) => PersonProfile | null) => setResult(previous => previous ? { ...previous, profile: change(previous.profile) } : previous);

    useEffect(() => {
        const controller = new AbortController();
        void fetchProfessions(id, controller.signal)
            .then(items => { if (!controller.signal.aborted) setProfessions({ key, items, failed: false }); })
            .catch(error => { if (!controller.signal.aborted) setProfessions({ key, items: error?.response?.status === 404 ? [] : null, failed: error?.response?.status !== 404 }); });
        return () => controller.abort();
    }, [id, key]);

    const own = Boolean(user && profile && Number(user.id) === profile.id);
    const roles = profile ? profileRoles(profile) : [];
    const hidden = Boolean(profile?.isPrivate && !own);
    // Minors' birth dates never reach other viewers. Treat a player without one as a possible minor.
    const possibleMinor = !own && roles.includes('PLAYER') && !profile?.dateOfBirth;

    const toggleFollow = async () => {
        if (!profile) return;
        const previous = profile;
        setProfile(() => ({ ...profile, isFollowedByMe: !profile.isFollowedByMe, followerCount: Math.max(0, profile.followerCount + (profile.isFollowedByMe ? -1 : 1)) }));
        try { await apiClient.post(`/users/${profile.id}/follow`); }
        catch (error) { setProfile(() => previous); throw error; }
    };
    const updateImage = async (field: 'banner' | 'avatar', url: string) => {
        if (!own) throw new Error('You can only change your own profile photos.');
        await apiClient.put('/users/me', field === 'avatar' ? { avatarUrl: url } : { bannerUrl: url });
        setProfile(current => current ? { ...current, [field === 'avatar' ? 'avatarUrl' : 'bannerUrl']: url } : current);
    };

    return {
        profile, status, own, roles, hidden, possibleMinor, setProfile,
        professions: currentProfessions?.items ?? null,
        professionsFailed: currentProfessions?.failed ?? false,
        reload: () => setRevision(value => value + 1), toggleFollow, updateImage,
    };
}

export type PersonView = ReturnType<typeof usePersonProfile>;
