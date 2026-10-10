import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { profileRoles } from '../../roles/domain';
import { fetchProfessions, type PersonProfile, type Profession } from '../api';

/**
 * A person's profile, their professions and what the viewer may see and do.
 * The server already withholds private and minors' details; the page never fills them in.
 */
export function usePersonProfile(id: number) {
    const { user, sessionId } = useAuth();
    const [profile, setProfile] = useState<PersonProfile | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
    const [revision, setRevision] = useState(0);
    const [professions, setProfessions] = useState<{ id: number; items: Profession[] | null; failed: boolean }>({ id, items: null, failed: false });

    useEffect(() => {
        const controller = new AbortController();
        setStatus(current => current === 'ready' ? current : 'loading');
        void apiClient.get<PersonProfile>(`/users/${id}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) { setProfile(response.data); setStatus('ready'); } })
            .catch(error => { if (!controller.signal.aborted) { setProfile(null); setStatus(error?.response?.status === 404 ? 'missing' : 'failed'); } });
        return () => controller.abort();
    }, [id, sessionId, revision]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchProfessions(id, controller.signal)
            .then(items => { if (!controller.signal.aborted) setProfessions({ id, items, failed: false }); })
            .catch(error => { if (!controller.signal.aborted) setProfessions({ id, items: error?.response?.status === 404 ? [] : null, failed: error?.response?.status !== 404 }); });
        return () => controller.abort();
    }, [id, sessionId, revision]);

    const own = Boolean(user && profile && Number(user.id) === profile.id);
    const roles = profile ? profileRoles(profile) : [];
    const hidden = Boolean(profile?.isPrivate && !own);
    // Minors' birth dates never reach other viewers. Treat a player without one as a possible minor.
    const possibleMinor = !own && roles.includes('PLAYER') && !profile?.dateOfBirth;

    const toggleFollow = async () => {
        if (!profile) return;
        const previous = profile;
        setProfile({ ...profile, isFollowedByMe: !profile.isFollowedByMe, followerCount: Math.max(0, profile.followerCount + (profile.isFollowedByMe ? -1 : 1)) });
        try { await apiClient.post(`/users/${profile.id}/follow`); }
        catch (error) { setProfile(previous); throw error; }
    };
    const updateImage = async (field: 'banner' | 'avatar', url: string) => {
        if (!own) throw new Error('You can only change your own profile photos.');
        await apiClient.put('/users/me', field === 'avatar' ? { avatarUrl: url } : { bannerUrl: url });
        setProfile(current => current ? { ...current, [field === 'avatar' ? 'avatarUrl' : 'bannerUrl']: url } : current);
    };

    return {
        profile, status, own, roles, hidden, possibleMinor, setProfile,
        professions: professions.id === id ? professions.items : null,
        professionsFailed: professions.id === id && professions.failed,
        reload: () => setRevision(value => value + 1), toggleFollow, updateImage,
    };
}

export type PersonView = ReturnType<typeof usePersonProfile>;
