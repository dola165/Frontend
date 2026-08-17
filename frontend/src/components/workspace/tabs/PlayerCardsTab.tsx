import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { fetchPlayerCards, deletePlayerCard, type PlayerCard } from '../../../features/clubs/api';
import { PlayerCardModal } from '../../squads/PlayerCardModal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SectionHeader, EmptyState } from '../helpers';

interface SquadDto {
    id: number;
    name: string;
}

interface PlayerCardsTabProps {
    clubId: number;
    setParentError: (msg: string | null) => void;
    setParentSuccess: (msg: string | null) => void;
}

/**
 * Workspace "Player Cards" tab (Aug 17, SESSION_AUGUST_17_CHANGELOG.md) —
 * the club-level management surface for unregistered-player cards
 * (WEB_APP_MASTER_PLAN.md §2.2): list, create, edit, delete. Cards are created
 * inside squads via "Add Players" as well; this tab is where they live on
 * their own, editable and deletable.
 */
export const PlayerCardsTab = ({ clubId, setParentError, setParentSuccess }: PlayerCardsTabProps) => {
    const { t } = useTranslation();
    const [cards, setCards] = useState<PlayerCard[]>([]);
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [createSquadId, setCreateSquadId] = useState<number | null>(null);
    const [editingCard, setEditingCard] = useState<PlayerCard | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PlayerCard | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setCards(await fetchPlayerCards(clubId));
        } catch {
            setCards([]);
        }
        try {
            const response = await apiClient.get<SquadDto[]>(`/clubs/${clubId}/squads`);
            setSquads(response.data || []);
        } catch {
            // squad names are display-only
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => { void load(); }, [load]);

    const squadName = (squadId?: number | null) =>
        squads.find((s) => s.id === squadId)?.name ?? t('minors.playerCard.noSquad');

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.id);
        try {
            await deletePlayerCard(clubId, deleteTarget.id);
            setParentSuccess(t('minors.playerCard.deleted', { name: deleteTarget.fullName ?? '' }));
            setDeleteTarget(null);
            await load();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t('minors.playerCard.deleteFailed');
            setParentError(msg);
        } finally {
            setDeletingId(null);
        }
    };

    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow="Player Cards"
                title="Player Cards"
                description="Roster entries for players without a GrassKickZ account. Fix typos, correct birth years, or remove a card entirely — the roster updates everywhere."
            />

            {/* Toolbar: create + squad picker */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4">
                <div className="flex items-center gap-2">
                    <select
                        value={createSquadId ?? ''}
                        onChange={(e) => setCreateSquadId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-sm font-medium text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)]"
                    >
                        <option value="">{t('minors.playerCard.noSquad')}</option>
                        {squads.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-[var(--fc-text-muted)]">{t('minors.playerCard.squadHint')}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                    <Plus className="h-4 w-4" />
                    {t('minors.playerCard.create')}
                </button>
            </div>

            {/* Card list */}
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--fc-text-muted)]" />
                </div>
            ) : cards.length === 0 ? (
                <EmptyState message={t('minors.playerCard.noCards')} />
            ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)]">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-[var(--fc-border)] text-left">
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.fullName')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.birthYear')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.position')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">No.</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.parentEmail')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.squad')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.status')}</th>
                                <th className="w-24 px-4 py-3 text-right text-xs font-semibold text-[var(--fc-text-muted)]">{t('minors.playerCard.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cards.map((card) => (
                                <tr key={card.id} className="border-b border-[var(--fc-border)] last:border-b-0">
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-2">
                                            {card.photoUrl && (
                                                <img src={card.photoUrl} alt={card.fullName ?? ''} className="h-7 w-7 rounded-full object-cover" />
                                            )}
                                            <span className="text-sm font-semibold text-[var(--fc-text-primary)]">{card.fullName}</span>
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--fc-text-secondary)]">
                                        {card.birthYear}
                                        {card.birthYear != null && currentYear - card.birthYear < 13 && (
                                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-muted)]">U13</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--fc-text-secondary)]">{card.position ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--fc-text-secondary)]">{card.jerseyNumber ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--fc-text-secondary)]">{card.parentEmail ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--fc-text-secondary)]">{squadName(card.squadId)}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5">
                                            {card.registered ? (
                                                <span className="rounded-full border border-[var(--fc-accent-border)] bg-[var(--fc-accent-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-accent)]">
                                                    {t('minors.playerCard.registered')}
                                                </span>
                                            ) : (
                                                <span className="rounded-full border border-[#a1a1aa]/30 bg-[#a1a1aa]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a1a1aa]">
                                                    {t('minors.playerCard.notRegistered')}
                                                </span>
                                            )}
                                            {card.claimed && (
                                                <span className="rounded-full border border-[var(--fc-accent-border)] bg-[var(--fc-accent-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-accent)]">
                                                    {t('minors.playerCard.claimed')}
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditingCard(card)}
                                                className="rounded-xl p-1.5 text-[var(--fc-text-muted)] hover:text-[var(--fc-accent)] transition-colors"
                                                title={t('minors.playerCard.edit')}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteTarget(card)}
                                                disabled={deletingId === card.id}
                                                className="rounded-xl p-1.5 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)] disabled:opacity-50 transition-colors"
                                                title={t('minors.playerCard.delete')}
                                            >
                                                {deletingId === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create modal */}
            <PlayerCardModal
                clubId={clubId}
                squadId={createSquadId}
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onCardCreated={async () => {
                    await load();
                    setParentSuccess(t('minors.playerCard.created'));
                }}
            />

            {/* Edit modal */}
            <PlayerCardModal
                clubId={clubId}
                isOpen={editingCard != null}
                onClose={() => setEditingCard(null)}
                card={editingCard}
                onCardUpdated={async () => {
                    await load();
                    setParentSuccess(t('minors.playerCard.updated'));
                }}
            />

            {/* Delete confirm */}
            <ConfirmDialog
                open={deleteTarget != null}
                title={t('minors.playerCard.delete')}
                message={deleteTarget ? t('minors.playerCard.deleteConfirm', { name: deleteTarget.fullName ?? '' }) : ''}
                confirmLabel={t('minors.playerCard.delete')}
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};
