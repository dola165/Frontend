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
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    neutral: 'bg-[#16181d] text-[#a1a1aa] border-[#ffffff0d]',
};

const entryPrimary = (entry: TournamentEntryDto): string =>
    entry.clubName ?? entry.displayName ?? entry.squadName ?? `Entry #${entry.id}`;

const selectClass = 'min-w-0 flex-1 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-2.5 text-sm font-semibold text-[#f4f4f5] outline-none focus:border-[#16a34a]';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#111612] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
                    <p className="text-base font-bold text-zinc-100">{t('tournaments.diagram.profileTitle')}</p>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-100" title={t('tournaments.workspace.close')}>
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 p-6">
                    {message && (
                        <p className="rounded-xl border border-[#ffffff0d] bg-[#ef4444]/10 px-3 py-2 text-sm font-semibold text-[#ef4444]">{message}</p>
                    )}
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-black text-emerald-300">{avatarLabel}</span>
                        <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-zinc-100">{entryPrimary(entry)}</p>
                        {entry.squadName && entry.clubId != null && entry.squadName !== entry.clubName && (
                            <p className="mt-0.5 truncate text-sm text-zinc-500">{entry.squadName}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                            <span className="rounded-full bg-[var(--fc-surface-hover)] px-2.5 py-0.5 text-xs font-semibold text-[#f4f4f5]">
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
                                <span className="text-[#a1a1aa]">{t('tournaments.diagram.playingSquad')}</span>
                                <span className="font-semibold text-[#f4f4f5]">
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
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-2.5 text-xs font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22] disabled:opacity-40"
                                    >
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('tournaments.diagram.change')}
                                    </button>
                                </div>
                            ) : canManage ? (
                                <p className="text-xs text-[#71717a]">{t('tournaments.diagram.noSquadsAvailable')}</p>
                            ) : null}
                        </div>
                    )}

                    {entry.seed != null && (
                        <div className="flex justify-between gap-3 text-sm">
                            <span className="text-[#a1a1aa]">{t('tournaments.diagram.seed')}</span>
                            <span className="font-semibold text-[#f4f4f5]">#{entry.seed}</span>
                        </div>
                    )}
                    {link && (
                        <Link
                            to={link.to}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e]"
                        >
                            {link.label}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};
