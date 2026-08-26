import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ClubPlayerAffiliation } from '../../../features/clubs/domain';

interface SquadOption {
    id: number;
    name: string;
    category?: string | null;
    gender?: string | null;
}

interface PromotePlayerModalProps {
    clubId: number;
    player: ClubPlayerAffiliation | null;
    saving: boolean;
    onClose: () => void;
    onConfirm: (squadId: number, trialEndsOn: string | null) => void;
}

/**
 * Phase A1 — promote a trialist into a squad (single action: ACTIVE + squad).
 * Mounted fresh per open (conditional render in ClubWorkspacePage) so the
 * selection state resets naturally. The mutation runs in the parent so the
 * error banner / success message stay consistent.
 */
export const PromotePlayerModal = ({
    clubId, player, saving, onClose, onConfirm,
}: PromotePlayerModalProps) => {
    const { t } = useTranslation();
    const [squads, setSquads] = useState<SquadOption[]>([]);
    const [squadsLoading, setSquadsLoading] = useState(true);
    const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
    const [trialEndsOn, setTrialEndsOn] = useState<string>(player?.trialEndsOn ?? '');

    useEffect(() => {
        let cancelled = false;
        apiClient
            .get<SquadOption[]>(`/clubs/${clubId}/squads`)
            .then((response) => {
                if (cancelled) return;
                setSquads(response.data ?? []);
                if ((response.data ?? []).length === 1) {
                    setSelectedSquadId(response.data[0].id);
                }
                setSquadsLoading(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setSquads([]);
                    setSquadsLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [clubId]);

    if (!player) return null;

    const playerName = player.fullName || player.username || 'this player';

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center">
            <div className="theme-overlay absolute inset-0" onClick={onClose} />
            <div className="relative z-10 mx-4 w-full max-w-md border border-[#ffffff0d] bg-[#0f1117] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#ffffff0d] px-5 py-4">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-[#16a34a]" />
                        <div>
                            <h2 className="text-sm font-semibold text-[#f4f4f5]">{t('trialists.promoteTitle')}</h2>
                            <p className="mt-0.5 text-[11px] font-medium text-[#a1a1aa]">
                                {playerName} · {t('trialists.promoteDescription')}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-[#a1a1aa] hover:text-[#f4f4f5]">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Squad picker */}
                <div className="border-b border-[#ffffff0d] px-5 py-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                        {t('trialists.chooseSquad')}
                    </p>
                    {squadsLoading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-[#16a34a]" />
                        </div>
                    ) : squads.length === 0 ? (
                        <p className="py-3 text-xs font-medium text-[#a1a1aa]">{t('trialists.noSquads')}</p>
                    ) : (
                        <div className="space-y-1.5">
                            {squads.map((squad) => {
                                const isSelected = selectedSquadId === squad.id;
                                return (
                                    <button
                                        key={squad.id}
                                        type="button"
                                        onClick={() => setSelectedSquadId(squad.id)}
                                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                            isSelected
                                                ? 'border-[#16a34a] bg-[#16a34a]/10'
                                                : 'border-[#ffffff0d] hover:bg-elevated'
                                        }`}
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-[#f4f4f5]">{squad.name}</span>
                                            <span className="mt-0.5 block text-[11px] font-medium text-[#a1a1aa]">
                                                {[squad.category, squad.gender].filter(Boolean).join(' · ') || '—'}
                                            </span>
                                        </span>
                                        {isSelected && <Check className="h-4 w-4 text-[#16a34a]" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Optional trial deadline */}
                <div className="px-5 py-4">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                        {t('trialists.trialEnds')} ({t('trialists.optional')})
                    </label>
                    <input
                        type="date"
                        value={trialEndsOn}
                        onChange={(e) => setTrialEndsOn(e.target.value)}
                        aria-label={t('trialists.trialEnds')}
                        className="w-full rounded-lg border border-[#ffffff0d] bg-elevated px-3 py-2 text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a]"
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-[#ffffff0d] px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="border border-[#ffffff0d] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5]"
                    >
                        {t('trialists.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={() => selectedSquadId !== null && onConfirm(selectedSquadId, trialEndsOn || null)}
                        disabled={selectedSquadId === null || saving}
                        className="border border-[#16a34a] bg-[#16a34a] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-on-primary)] hover:bg-[#16a34a]-hover disabled:opacity-50"
                    >
                        {saving ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> {t('trialists.promoting')}
                            </span>
                        ) : (
                            t('trialists.promoteConfirm')
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
