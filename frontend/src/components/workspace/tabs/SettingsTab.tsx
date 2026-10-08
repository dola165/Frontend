import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { updateClubSettings } from '../../../features/clubs/api';
import type { PlayerJoinPolicy } from '../../../features/clubs/domain';
import { ErrorBlock, PageSpinner, SectionHeader } from '../helpers';
import { ClubPresentationSettings } from './ClubPresentationSettings';
import { ClubOrganizationTools } from '../../../features/organizations/setup/ClubOrganizationTools';

interface SettingsTabProps {
    clubId: number;
    pendingKey: string | null;
}

const POLICIES: Array<{ value: PlayerJoinPolicy; labelKey: string; explainerKey: string }> = [
    { value: 'OPEN_TRIAL', labelKey: 'settings.openTrial', explainerKey: 'settings.openTrialDescription' },
    { value: 'APPLICATION_REQUIRED', labelKey: 'settings.applicationRequired', explainerKey: 'settings.applicationRequiredDescription' },
    { value: 'INVITE_ONLY', labelKey: 'settings.inviteOnly', explainerKey: 'settings.inviteOnlyDescription' },
];

/**
 * Workspace Settings tab (WEB_APP_MASTER_PLAN.md §4.4, Phase 2): the missing
 * join-policy selector. Visible to OWNER/CLUB_ADMIN only — the backend also
 * rejects COACH writes (ClubAccessManager.decideOwnerOrAdmin).
 */
export const SettingsTab = ({ clubId, pendingKey }: SettingsTabProps) => {
    const { t } = useTranslation();
    const [policy, setPolicy] = useState<PlayerJoinPolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [pendingPolicy, setPendingPolicy] = useState<PlayerJoinPolicy | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get<{ playerJoinPolicy?: string }>(`/clubs/${clubId}`);
            const value = res.data?.playerJoinPolicy;
            setPolicy(value === 'OPEN_TRIAL' || value === 'APPLICATION_REQUIRED' || value === 'INVITE_ONLY' ? value : 'APPLICATION_REQUIRED');
        } catch {
            setError(t('settings.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [clubId, t]);

    useEffect(() => { void load(); }, [load]);

    const save = async (next: PlayerJoinPolicy) => {
        setPolicy(next);
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            await updateClubSettings(clubId, next);
            setSaved(true);
            setPendingPolicy(null);
        } catch {
            setError(t('settings.saveFailed'));
            setPolicy(null);
            void load();
        } finally {
            setSaving(false);
        }
    };

    const impactCopy = (next: PlayerJoinPolicy) => {
        if (next === policy) return null;
        if (next === 'OPEN_TRIAL') return 'Anyone can start a trial immediately. Existing applications and invitations remain unchanged.';
        if (next === 'APPLICATION_REQUIRED') return 'New players must submit an application. Existing pending applications remain reviewable.';
        return 'New players can only join through an invitation. Existing applications are not deleted, but they will no longer accept new self-service submissions.';
    };

    if (loading) return <PageSpinner />;
    if (error && policy == null) return <ErrorBlock message={error} onRetry={() => void load()} />;

    return (
        <div className="space-y-4">
            <ClubOrganizationTools clubId={clubId} />
            <ClubPresentationSettings clubId={clubId} />
            <SectionHeader
                eyebrow={t('settings.title')}
                title={t('settings.heading')}
                description={t('settings.description')}
            />
            {error && <p className="text-xs font-semibold text-[var(--fc-state-danger)]">{error}</p>}
            {saved && <p className="text-xs font-semibold text-[var(--color-accent)]">{t('settings.saved')}</p>}
            <div className="space-y-3">
                {POLICIES.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        disabled={saving || pendingKey != null}
                        onClick={() => {
                            if (option.value !== policy) setPendingPolicy(option.value);
                        }}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                            policy === option.value
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                : 'border-[var(--fc-border)] bg-[var(--fc-card-bg)] hover:bg-[var(--fc-surface-hover)]'
                        }`}
                    >
                        <span className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[var(--fc-text-primary)]">{t(option.labelKey)}</span>
                            {saving && policy === option.value && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--fc-text-secondary)]">{t(option.explainerKey)}</span>
                    </button>
                ))}
            </div>
            {pendingPolicy && impactCopy(pendingPolicy) && (
                <div className="rounded-xl border border-[var(--fc-state-warning-soft)] bg-[var(--fc-state-warning-soft)] px-4 py-3 text-xs leading-5 text-[var(--fc-text-secondary)]" role="status">
                    <p><span className="font-semibold text-[var(--fc-text-primary)]">Before you change this:</span> {impactCopy(pendingPolicy)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setPendingPolicy(null)} className="rounded-lg border border-[var(--fc-border)] px-3 py-1.5 text-xs font-semibold text-[var(--fc-text-secondary)]">Keep current policy</button>
                        <button type="button" onClick={() => void save(pendingPolicy)} disabled={saving} className="rounded-lg bg-[var(--fc-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-on-accent)] disabled:opacity-50">Confirm change</button>
                    </div>
                </div>
            )}
        </div>
    );
};
