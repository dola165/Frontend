import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { fetchGroupStandings } from '../api';
import type { GroupStandingsRow, TournamentEntryStatus } from '../domain';
import { tournamentEntryStatusText } from '../../../components/tournaments/tournamentFormatters';

interface Props {
    tournamentId: number;
    stageId: number;
    refreshKey: number;
    entryStatuses: Map<number, TournamentEntryStatus>;
    advanceCount?: number | null;
}

const badgeStatuses = new Set(['ELIMINATED', 'WAITLISTED', 'COMPLETED']);

const badgeTones: Record<string, string> = {
    ELIMINATED: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    WAITLISTED: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    COMPLETED: 'border-[#ffffff0d] bg-[#16181d] text-[#a1a1aa]',
};

const sortRows = (rows: GroupStandingsRow[]): GroupStandingsRow[] =>
    [...rows].sort(
        (a, b) =>
            b.points - a.points ||
            b.goalDifference - a.goalDifference ||
            b.goalsFor - a.goalsFor ||
            a.entryName.localeCompare(b.entryName),
    );

export const StandingsTable = ({ tournamentId, stageId, refreshKey, entryStatuses, advanceCount }: Props) => {
    const { t } = useTranslation();
    const [rows, setRows] = useState<GroupStandingsRow[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchGroupStandings(tournamentId, stageId)
            .then((data) => {
                if (!cancelled) setRows(data ?? []);
            })
            .catch(() => {
                if (!cancelled) setRows([]);
            });
        return () => {
            cancelled = true;
        };
    }, [tournamentId, stageId, refreshKey]);

    if (rows === null) return null;

    return (
        <div className="border-t border-white/[0.08] bg-[#0a0e0b]">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-500"><BarChart3 className="h-4 w-4" /></span>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">{t('tournaments.standings.title')}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-600">{t('tournaments.standings.rankingHint')}</p>
                    </div>
                </div>
                {advanceCount != null && advanceCount > 0 && (
                    <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                        {t('tournaments.standings.advanceCount', { count: advanceCount })}
                    </span>
                )}
            </div>
            {rows.length === 0 ? (
                <div className="border-t border-white/[0.06] px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-zinc-400">{t('tournaments.standings.empty')}</p>
                    <p className="mt-1 text-xs text-zinc-600">{t('tournaments.standings.emptyHint')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto border-t border-white/[0.06]">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-[#ffffff0d]">
                                <th className="w-8 px-3 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]">#</th>
                                <th className="px-2 py-2 text-left text-[11px] font-semibold text-[#a1a1aa]" />
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Played">
                                    {t('tournaments.standings.p')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Won">
                                    {t('tournaments.standings.w')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Drawn">
                                    {t('tournaments.standings.d')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Lost">
                                    {t('tournaments.standings.l')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Goals for">
                                    {t('tournaments.standings.gf')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Goals against">
                                    {t('tournaments.standings.ga')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Goal difference">
                                    {t('tournaments.standings.gd')}
                                </th>
                                <th className="px-3 py-2 text-center text-[11px] font-semibold text-[#a1a1aa]" title="Points">
                                    {t('tournaments.standings.pts')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortRows(rows).map((row, index) => {
                                const qualifies = advanceCount != null && advanceCount > 0 && index < advanceCount;
                                return <tr
                                    key={row.entryId}
                                    className={`border-b border-white/[0.06] transition-colors hover:bg-white/[0.03] ${qualifies ? 'bg-emerald-300/[0.035]' : ''}`}
                                >
                                    <td className={`border-l-2 px-3 py-3 text-center text-xs font-black ${qualifies ? 'border-emerald-300 text-emerald-300' : 'border-transparent text-zinc-500'}`}>{index + 1}</td>
                                    <td className="px-2 py-2">
                                        <span className="text-sm font-bold text-zinc-100">{row.entryName}</span>
                                        {(() => {
                                            const status = entryStatuses.get(row.entryId);
                                            if (!status || !badgeStatuses.has(status)) return null;
                                            return (
                                                <span className={`ml-2 inline-block rounded-xl border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeTones[status]}`}>
                                                    {tournamentEntryStatusText(status, t)}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-zinc-400">{row.played}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-zinc-400">{row.won}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-zinc-400">{row.drawn}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-zinc-400">{row.lost}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-zinc-400">{row.goalsFor}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-zinc-400">{row.goalsAgainst}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">
                                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                    </td>
                                    <td className="px-3 py-2 text-center text-base font-black tabular-nums text-emerald-300">{row.points}</td>
                                </tr>
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
