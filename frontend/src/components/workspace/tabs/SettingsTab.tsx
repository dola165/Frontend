import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { updateClubSettings } from '../../../features/clubs/api';
import type { PlayerJoinPolicy } from '../../../features/clubs/domain';
import { ErrorBlock, PageSpinner, SectionHeader } from '../helpers';

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
        } catch {
            setError(t('settings.saveFailed'));
            setPolicy(null);
            void load();
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PageSpinner />;
    if (error && policy == null) return <ErrorBlock message={error} onRetry={() => void load()} />;

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow={t('settings.title')}
                title={t('settings.heading')}
                description={t('settings.description')}
            />
            {error && <p className="text-xs font-semibold text-[var(--fc-state-danger)]">{error}</p>}
            {saved && <p className="text-xs font-semibold text-[#16a34a]">{t('settings.saved')}</p>}
            <div className="space-y-3">
                {POLICIES.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        disabled={saving || pendingKey != null}
                        onClick={() => void save(option.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                            policy === option.value
                                ? 'border-[#16a34a] bg-[#16a34a]/10'
                                : 'border-[var(--fc-border)] bg-[var(--fc-card-bg)] hover:bg-[var(--fc-surface-hover)]'
                        }`}
                    >
                        <span className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[var(--fc-text-primary)]">{t(option.labelKey)}</span>
                            {saving && policy === option.value && <Loader2 className="h-4 w-4 animate-spin text-[#16a34a]" />}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--fc-text-secondary)]">{t(option.explainerKey)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
