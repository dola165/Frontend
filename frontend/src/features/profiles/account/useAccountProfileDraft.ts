import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { isCurrentAuthSession } from '../../../utils/authStorage';

export type ProfileForm = {
    fullName: string; bio: string; avatarUrl: string; bannerUrl: string; position: string; secondaryPosition: string;
    preferredFoot: string; heightCm: string; weightKg: string; availabilityStatus: string;
};
type ProfileSource = { fullName?: string | null; bio?: string | null; avatarUrl?: string | null; bannerUrl?: string | null;
    playerProfile?: { primaryPosition?: string | null; secondaryPosition?: string | null; preferredFoot?: string | null;
        heightCm?: number | null; weightKg?: number | null; availabilityStatus?: string | null } | null };
export const buildProfileForm = (account: ProfileSource): ProfileForm => ({
    fullName: account.fullName ?? '', bio: account.bio ?? '', avatarUrl: account.avatarUrl ?? '', bannerUrl: account.bannerUrl ?? '',
    position: account.playerProfile?.primaryPosition ?? '', secondaryPosition: account.playerProfile?.secondaryPosition ?? '',
    preferredFoot: account.playerProfile?.preferredFoot ?? '', heightCm: account.playerProfile?.heightCm != null ? String(account.playerProfile.heightCm) : '',
    weightKg: account.playerProfile?.weightKg != null ? String(account.playerProfile.weightKg) : '', availabilityStatus: account.playerProfile?.availabilityStatus ?? 'AVAILABLE',
});
const optional = (value: string) => value.trim() || undefined;
const profileBody = (form: ProfileForm, player: boolean) => ({
    fullName: optional(form.fullName), bio: optional(form.bio), avatarUrl: optional(form.avatarUrl), bannerUrl: optional(form.bannerUrl),
    position: player ? optional(form.position) : undefined, secondaryPosition: player ? optional(form.secondaryPosition) : undefined,
    preferredFoot: player ? optional(form.preferredFoot) : undefined, heightCm: player && form.heightCm.trim() ? Number(form.heightCm) : undefined,
    weightKg: player && form.weightKg.trim() ? Number(form.weightKg) : undefined, availabilityStatus: player ? optional(form.availabilityStatus) : undefined,
});
type Receipt = { sent: ProfileForm; refresh: 'pending' | 'failed' | 'ready' };

/** A confirmed write and a metadata refresh are separate. Neither replaces the person's live draft. */
export function useAccountProfileDraft({ form, setForm, isPlayer, refresh }: {
    form: ProfileForm | null; setForm: Dispatch<SetStateAction<ProfileForm | null>>; isPlayer: boolean; refresh: () => Promise<boolean>;
}) {
    const { sessionId, bootstrapSession } = useAuth();
    const active = useRef(true), pending = useRef(false), uploadPending = useRef(false);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, [sessionId]);
    const current = () => active.current && isCurrentAuthSession(sessionId);
    const [saving, setSaving] = useState(false), [refreshing, setRefreshing] = useState(false);
    const [receipt, setReceipt] = useState<Receipt | null>(null), [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null), [notice, setNotice] = useState<'avatar' | 'banner' | null>(null);

    const refreshSaved = async (sent: ProfileForm) => {
        setReceipt({ sent, refresh: 'pending' });
        try {
            const loaded = await refresh();
            if (!current()) return;
            if (!loaded) { setReceipt({ sent, refresh: 'failed' }); return; }
            const refreshedUser = await bootstrapSession();
            if (current()) setReceipt({ sent, refresh: refreshedUser ? 'ready' : 'failed' });
        } catch { if (current()) setReceipt({ sent, refresh: 'failed' }); }
    };

    const saveProfile = async () => {
        if (!form || pending.current || uploadPending.current || !current()) return;
        const sent = { ...form };
        pending.current = true; setSaving(true); setReceipt(null); setError(null); setNotice(null);
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
            await apiClient.put('/users/me', profileBody(sent, isPlayer), config);
            if (current()) await refreshSaved(sent);
        } catch (reason) {
            if (current()) setError(extractApiErrorMessage(reason, 'Could not confirm your profile save. Your draft is kept.'));
        } finally { pending.current = false; if (current()) setSaving(false); }
    };

    const retryRefresh = async () => {
        if (!receipt || receipt.refresh !== 'failed' || pending.current || uploadPending.current || !current()) return;
        pending.current = true; setRefreshing(true);
        try { await refreshSaved(receipt.sent); }
        finally { pending.current = false; if (current()) setRefreshing(false); }
    };

    const uploadAsset = async (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const input = event.target, file = input.files?.[0];
        if (!file || pending.current || uploadPending.current || !current()) return;
        const body = new FormData(); body.append('file', file);
        uploadPending.current = true; setUploading(type); setNotice(null); setError(null);
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: sessionId, headers: { 'Content-Type': 'multipart/form-data' }, params: { context: type === 'avatar' ? 'profile' : 'banner' } };
            const response = await apiClient.post<{ url?: string }>('/media/upload', body, config);
            if (!current()) return;
            if (!response.data?.url) throw new Error('Upload did not return a media URL.');
            const url = response.data.url;
            setForm(draft => draft ? { ...draft, [type === 'avatar' ? 'avatarUrl' : 'bannerUrl']: url } : draft);
            setNotice(type);
        } catch (reason) { if (current()) setError(extractApiErrorMessage(reason, 'Could not upload this image. Your draft is kept.')); }
        finally { uploadPending.current = false; if (current()) setUploading(null); input.value = ''; }
    };

    const newerEdits = Boolean(receipt && form && (Object.keys(receipt.sent) as Array<keyof ProfileForm>).some(key => receipt.sent[key] !== form[key]));
    return { saving, refreshing, receipt, error, uploading, notice, newerEdits, saveProfile, retryRefresh, uploadAsset };
}
