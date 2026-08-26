import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGroupStandings } from '../api';
import type { GroupStandingsRow } from '../domain';

interface Props {
    tournamentId: number;
    stageId: number;
    refreshKey: number;
    entryStatuses: Map<number, string>;
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

export const StandingsTable = ({ tournamentId, stageId, refreshKey, entryStatuses }: Props) => {
    const { t } = useTranslation();
    const [rows, setRows] = useState<GroupStandingsRow[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        setRows(null);
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
        <div className="border-t border-[#ffffff0d] bg-[#101318]">
            <div className="px-5 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a1a1aa]">
                    {t('tournaments.standings.title')}
                </p>
            </div>
            {rows.length === 0 ? (
                <p className="px-5 pb-4 text-xs text-[#71717a]">{t('tournaments.standings.empty')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
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
                            {sortRows(rows).map((row, index) => (
                                <tr
                                    key={row.entryId}
                                    className={`border-b border-[#ffffff0d] transition-colors hover:bg-[#1a1c22] ${
                                        index === 0 ? 'bg-[#16a34a]/5' : ''
                                    }`}
                                >
                                    <td className="px-3 py-2 text-center text-xs font-bold text-[#a1a1aa]">{index + 1}</td>
                                    <td className="px-2 py-2">
                                        <span className="text-sm font-semibold text-[#f4f4f5]">{row.entryName}</span>
                                        {(() => {
                                            const status = entryStatuses.get(row.entryId);
                                            if (!status || !badgeStatuses.has(status)) return null;
                                            return (
                                                <span className={`ml-2 inline-block rounded-xl border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeTones[status]}`}>
                                                    {status}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">{row.played}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">{row.won}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">{row.drawn}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">{row.lost}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">{row.goalsFor}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">{row.goalsAgainst}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[#a1a1aa]">
                                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                    </td>
                                    <td className="px-3 py-2 text-center text-sm font-bold tabular-nums text-[#16a34a]">{row.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
