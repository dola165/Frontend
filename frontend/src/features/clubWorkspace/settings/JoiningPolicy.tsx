import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { Button, Panel, Skeleton } from '../../../design/primitives';
import { updateClubSettings } from '../../clubs/api';
import type { PlayerJoinPolicy } from '../../clubs/domain';
import '../club-workspace.css';

const POLICIES: Array<{ value: PlayerJoinPolicy; labelKey: string; explainerKey: string; impact: string }> = [
    { value: 'OPEN_TRIAL', labelKey: 'settings.openTrial', explainerKey: 'settings.openTrialDescription', impact: 'Anyone can start a trial immediately. Existing applications and invitations remain unchanged.' },
    { value: 'APPLICATION_REQUIRED', labelKey: 'settings.applicationRequired', explainerKey: 'settings.applicationRequiredDescription', impact: 'New players must submit an application. Existing pending applications remain reviewable.' },
    { value: 'INVITE_ONLY', labelKey: 'settings.inviteOnly', explainerKey: 'settings.inviteOnlyDescription', impact: 'New players can only join through an invitation. Existing applications are not deleted, but no new self-service applications are accepted.' },
];

/** How new players join the club. Owners and admins only; the server rejects anyone else. A change is confirmed first. */
export function JoiningPolicy({ clubId, disabled }: { clubId: number; disabled: boolean }) {
    const { t } = useTranslation();
    const [policy, setPolicy] = useState<PlayerJoinPolicy | null>(null);
    const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
    const [pending, setPending] = useState<PlayerJoinPolicy | null>(null);
    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await apiClient.get<{ playerJoinPolicy?: string }>(`/clubs/${clubId}`);
            const value = res.data?.playerJoinPolicy;
            setPolicy(value === 'OPEN_TRIAL' || value === 'APPLICATION_REQUIRED' || value === 'INVITE_ONLY' ? value : 'APPLICATION_REQUIRED');
        } catch { setError(t('settings.loadFailed')); }
        finally { setLoading(false); }
    }, [clubId, t]);
    useEffect(() => { void load(); }, [load]);
    const save = async (next: PlayerJoinPolicy) => {
        setPolicy(next); setSaving(true); setSaved(false); setError(null);
        try { await updateClubSettings(clubId, next); setSaved(true); setPending(null); }
        catch { setError(t('settings.saveFailed')); setPolicy(null); void load(); }
        finally { setSaving(false); }
    };
    if (loading) return <Panel padded><Skeleton height={120} /></Panel>;
    if (error && policy == null) return <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => void load()}>Try again</Button></div>;
    const impact = POLICIES.find(option => option.value === pending)?.impact;
    return <Panel flush title="How players join" action={saved ? <span className="gk-muted" role="status">{t('settings.saved')}</span> : undefined}>
        {error && <div className="rec-form__group"><div className="gk-notice gk-notice--danger" role="alert">{error}</div></div>}
        <div className="cw-options" role="radiogroup" aria-label="How players join">
            {POLICIES.map(option => {
                const current = policy === option.value;
                return <button key={option.value} type="button" role="radio" aria-checked={current} className="cw-option" disabled={saving || disabled}
                    onClick={() => { if (!current) setPending(option.value); }}>
                    <span className="cw-option__mark" aria-hidden="true">{current && <Check />}</span>
                    <span className="cw-option__text"><strong>{t(option.labelKey)}</strong><span>{t(option.explainerKey)}</span></span>
                </button>;
            })}
        </div>
        {pending && impact && <div className="rec-form__group"><div className="gk-notice gk-notice--warning rec-prompt" role="status">
            <p className="rec-prompt__text"><strong>Before you change this:</strong> {impact}</p>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Keep current policy</Button>
            <Button size="sm" variant="primary" disabled={saving} onClick={() => void save(pending)}>Confirm change</Button>
        </div></div>}
    </Panel>;
}
