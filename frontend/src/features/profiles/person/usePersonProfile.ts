import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { profileRoles } from '../../roles/domain';
import { fetchPersonProfile, fetchProfessions, saveMyImage, type PersonProfile, type Profession } from '../api';
import { useFootball } from '../football/useFootball';

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

    const football = useFootball(id);
    const own = Boolean(user && profile && Number(user.id) === profile.id);
    const shownLine = football.data?.publicRole?.label ?? null;
    const roles = profile ? profileRoles(profile) : [];
    const hidden = Boolean(profile?.isPrivate && !own);
    // Minors' birth dates never reach other viewers. Treat a player without one as a possible minor.
    const possibleMinor = !own && roles.includes('PLAYER') && !profile?.dateOfBirth;

    /** Follow (`FollowButton`) changed: the follower is counted at once and taken back if the server refused. */
    const followChanged = (following: boolean) => setProfile(current => current && current.isFollowedByMe !== following
        ? { ...current, isFollowedByMe: following, followerCount: Math.max(0, current.followerCount + (following ? 1 : -1)) } : current);
    const updateImage = async (field: 'banner' | 'avatar', url: string) => {
        if (!own) throw new Error('You can only change your own profile photos.');
        await saveMyImage(field, url);
        setProfile(current => current ? { ...current, [field === 'avatar' ? 'avatarUrl' : 'bannerUrl']: url } : current);
    };

    return {
        profile, status, own, roles, hidden, possibleMinor, setProfile,
        football: football.data,
        /** The line under the name, from the person's real lines. */
        line: shownLine,
        professions: currentProfessions?.items ?? null,
        professionsFailed: currentProfessions?.failed ?? false,
        reload: () => { setRevision(value => value + 1); football.reload(); }, followChanged, updateImage,
    };
}

export type PersonView = ReturnType<typeof usePersonProfile>;
