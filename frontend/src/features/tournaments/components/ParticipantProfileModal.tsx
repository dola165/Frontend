import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { updateEntrySquad } from '../api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { TournamentEntryDto } from '../domain';
import { entryStatusTone } from '../domain';
import { tournamentEntryStatusText } from '../../../components/tournaments/tournamentFormatters';

interface Props {
    entry: TournamentEntryDto;
    tournamentId: number;
    canManage: boolean;
    onRefresh: () => void;
    onClose: () => void;
}

interface SquadOption {
    id: number;
    name: string;
}

const statusToneBorder: Record<string, string> = {
    info: 'bg-[color:var(--color-info)]/10 text-[color:var(--color-info)] border-[color:var(--color-info)]/30',
    success: 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/30',
    warning: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30',
    danger: 'bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30',
    neutral: 'bg-[var(--color-surface)] text-[var(--color-secondary)] border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]',
};

const entryPrimary = (entry: TournamentEntryDto): string =>
    entry.clubName ?? entry.displayName ?? entry.squadName ?? `Entry #${entry.id}`;

const selectClass = 'min-w-0 flex-1 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]';

export const ParticipantProfileModal = ({ entry, tournamentId, canManage, onRefresh, onClose }: Props) => {
    const { t } = useTranslation();
    const [squads, setSquads] = useState<SquadOption[]>([]);
    const [squadId, setSquadId] = useState<string>(entry.squadId != null ? String(entry.squadId) : '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (entry.clubId == null) return;
        let cancelled = false;
        apiClient
            .get<Array<{ id?: number; name?: string }>>(`/clubs/${entry.clubId}/squads`)
            .then((res) => {
                if (cancelled) return;
                setSquads(
                    (res.data ?? [])
                        .map((s) => ({ id: s.id ?? 0, name: s.name ?? '—' }))
                        .filter((s) => s.id > 0),
                );
            })
            .catch(() => {
                if (!cancelled) setSquads([]);
            });
        return () => {
            cancelled = true;
        };
    }, [entry.clubId]);

    const typeLabel = (): string => {
        if (entry.draftTeamId != null) return t('tournaments.diagram.draftTeam');
        if (entry.squadId != null) return t('tournaments.diagram.squad');
        if (entry.clubId != null) return t('tournaments.diagram.club');
        if (entry.userId != null) return t('tournaments.diagram.player');
        return t('tournaments.diagram.draftTeam');
    };

    const profileLink = (): { to: string; label: string } | null => {
        if (entry.clubId != null && entry.squadId != null) {
            return { to: `/clubs/${entry.clubId}/squads`, label: t('tournaments.diagram.squads') };
        }
        if (entry.clubId != null) {
            return { to: `/clubs/${entry.clubId}`, label: t('tournaments.diagram.clubProfile') };
        }
        if (entry.userId != null) {
            return { to: `/profile/${entry.userId}`, label: t('tournaments.diagram.playerProfile') };
        }
        return null;
    };

    const handleSaveSquad = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await updateEntrySquad(tournamentId, entry.id, {
                squadId: squadId ? Number(squadId) : null,
            });
            onRefresh();
            onClose();
        } catch (err) {
            setMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed')));
        } finally {
            setSaving(false);
        }
    };

    const tone = entryStatusTone(entry.status);
    const link = profileLink();
    const squadChanged = squadId !== (entry.squadId != null ? String(entry.squadId) : '');
    const avatarLabel = entryPrimary(entry).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-overlay)]/75 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[color:var(--color-border)]/10 bg-[var(--color-surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)]/[0.08] px-6 py-4">
                    <p className="text-base font-bold text-[color:var(--color-text)]">{t('tournaments.diagram.profileTitle')}</p>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-ink)]/[0.05] hover:text-[color:var(--color-text)]" title={t('tournaments.workspace.close')}>
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 p-6">
                    {message && (
                        <p className="rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-danger)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-danger)]">{message}</p>
                    )}
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.04] text-sm font-black text-[color:var(--color-accent)]">{avatarLabel}</span>
                        <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-[color:var(--color-text)]">{entryPrimary(entry)}</p>
                        {entry.squadName && entry.clubId != null && entry.squadName !== entry.clubName && (
                            <p className="mt-0.5 truncate text-sm text-[color:var(--color-muted)]">{entry.squadName}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                            <span className="rounded-full bg-[var(--fc-surface-hover)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text)]">
                                {typeLabel()}
                            </span>
                            <span className={`inline-block rounded-xl border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                {tournamentEntryStatusText(entry.status, t)}
                            </span>
                        </div>
                        </div>
                    </div>

                    {entry.clubId != null && (
                        <div className="space-y-2">
                            <div className="flex justify-between gap-3 text-sm">
                                <span className="text-[var(--color-secondary)]">{t('tournaments.diagram.playingSquad')}</span>
                                <span className="font-semibold text-[var(--color-text)]">
                                    {entry.squadName ?? t('tournaments.diagram.playAsClub')}
                                </span>
                            </div>
                            {canManage && squads.length > 0 ? (
                                <div className="flex items-center gap-2">
                                    <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={selectClass}>
                                        <option value="">{t('tournaments.diagram.playAsClub')}</option>
                                        {squads.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSaveSquad}
                                        disabled={saving || !squadChanged}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 py-2.5 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-40"
                                    >
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('tournaments.diagram.change')}
                                    </button>
                                </div>
                            ) : canManage ? (
                                <p className="text-xs text-[var(--color-secondary)]">{t('tournaments.diagram.noSquadsAvailable')}</p>
                            ) : null}
                        </div>
                    )}

                    {entry.seed != null && (
                        <div className="flex justify-between gap-3 text-sm">
                            <span className="text-[var(--color-secondary)]">{t('tournaments.diagram.seed')}</span>
                            <span className="font-semibold text-[var(--color-text)]">#{entry.seed}</span>
                        </div>
                    )}
                    {link && (
                        <Link
                            to={link.to}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)]"
                        >
                            {link.label}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};
