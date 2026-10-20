import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { FootballRole, RoleProfile } from '../../roles/domain';

const explicitFlags = (profiles: RoleProfile[]) => profiles.map(profile => ({ ...profile, primary: profile.primary === true, published: profile.published === true }));

/**
 * The person's football roles (GET/PUT /users/me/roles), as the roles editor and the welcome edit them: several at
 * once, one main role, new ones hidden from the public profile. A role adds profile sections; it never grants access.
 * Mount it with the account and session in the key, so another sign-in never sees these choices.
 */
export function useRoleProfiles() {
    const { refreshNavigationCapabilities } = useAuth();
    const [profiles, setProfiles] = useState<RoleProfile[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const active = useRef(true), submitting = useRef(false);
    useEffect(() => {
        let current = true;
        active.current = true;
        setState('loading'); setError('');
        void apiClient.get<RoleProfile[]>('/users/me/roles')
            .then(response => { if (current) { setProfiles(explicitFlags(response.data)); setDirty(false); setState('ready'); } })
            .catch(reason => { if (current) { setError(extractApiErrorMessage(reason, 'Your football roles couldn’t load.')); setState('failed'); } });
        return () => { current = false; active.current = false; };
    }, [attempt]);

    const change = (next: (current: RoleProfile[]) => RoleProfile[]) => { setSaved(false); setDirty(true); setProfiles(next); };
    const update = (role: FootballRole, values: Partial<RoleProfile>) => change(current => current.map(item => item.role === role ? { ...item, ...values } : item));
    const toggle = (role: FootballRole) => change(current => {
        const remaining = current.filter(item => item.role !== role);
        if (remaining.length === current.length) return [...current, { role, primary: current.length === 0, published: false }];
        if (remaining.length && !remaining.some(item => item.primary)) remaining[0] = { ...remaining[0], primary: true };
        return remaining;
    });
    /** Saves the roles as they are now; resolves to what the server holds, or null when it failed (the choices stay). */
    const save = async (list: RoleProfile[] = profiles): Promise<RoleProfile[] | null> => {
        if (submitting.current) return null;
        submitting.current = true; setSaving(true); setError(''); setSaved(false);
        try {
            const response = await apiClient.put<RoleProfile[]>('/users/me/roles', { profiles: explicitFlags(list) });
            void refreshNavigationCapabilities().catch(() => undefined);
            const stored = explicitFlags(response.data);
            if (active.current) { setProfiles(stored); setSaved(true); setDirty(false); }
            return stored;
        } catch (reason) {
            if (active.current) setError(extractApiErrorMessage(reason, 'Your football roles couldn’t be saved. Your changes are still here.'));
            return null;
        } finally { submitting.current = false; if (active.current) setSaving(false); }
    };
    return { profiles, state, saving, error, saved, dirty, retry: () => setAttempt(value => value + 1), change, update, toggle, save };
}
