import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { fetchGroupStandings } from '../api';
import type { GroupStandingsRow, TournamentEntryStatus } from '../domain';
import { tournamentEntryStatusText } from '../../../components/tournaments/tournamentFormatters';

interface Props {
    tournamentId: number;
    stageId: number;
    refreshKey: number | string;
    entryStatuses: Map<number, TournamentEntryStatus>;
    advanceCount?: number | null;
}

const badgeStatuses = new Set(['ELIMINATED', 'WAITLISTED', 'COMPLETED']);

const badgeTones: Record<string, string> = {
    ELIMINATED: 'border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]',
    WAITLISTED: 'border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]',
    COMPLETED: 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] text-[var(--color-secondary)]',
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
    const [attempt, setAttempt] = useState(0);
    const requestKey = `${tournamentId}:${stageId}:${refreshKey}:${attempt}`;
    const [result, setResult] = useState<{ key: string; rows: GroupStandingsRow[] | null; failed: boolean }>({ key: '', rows: null, failed: false });
    const rows = result.key === requestKey ? result.rows : null;
    const failed = result.key === requestKey && result.failed;

    useEffect(() => {
        let cancelled = false;
        fetchGroupStandings(tournamentId, stageId)
            .then((data) => {
                if (!cancelled) setResult({ key: requestKey, rows: data ?? [], failed: false });
            })
            .catch(() => {
                if (!cancelled) setResult({ key: requestKey, rows: null, failed: true });
            });
        return () => {
            cancelled = true;
        };
    }, [tournamentId, stageId, requestKey]);

    if (failed) return <div className="tw-empty" role="alert"><p>{t('tournaments.public.detailLoadFailed')}</p><button className="tw-button" onClick={() => setAttempt(value => value + 1)}>{t('tournaments.public.tryAgain')}</button></div>;
    if (rows === null) return <div className="tw-empty" role="status"><p>{t('tournaments.workspace.loading')}</p></div>;

    return (
        <div className="border-t border-[color:var(--color-border)]/[0.08] bg-[var(--color-page)]">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.03] text-[color:var(--color-muted)]"><BarChart3 className="h-4 w-4" /></span>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-secondary)]">{t('tournaments.standings.title')}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--color-muted)]">{t('tournaments.standings.rankingHint')}</p>
                    </div>
                </div>
                {advanceCount != null && advanceCount > 0 && (
                    <span className="rounded-full border border-[color:var(--color-accent)]/15 bg-[color:var(--color-accent)]/[0.06] px-2.5 py-1 text-[10px] font-bold text-[color:var(--color-accent)]">
                        {t('tournaments.standings.advanceCount', { count: advanceCount })}
                    </span>
                )}
            </div>
            {rows.length === 0 ? (
                <div className="border-t border-[color:var(--color-border)]/[0.06] px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-[color:var(--color-muted)]">{t('tournaments.standings.empty')}</p>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">{t('tournaments.standings.emptyHint')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto border-t border-[color:var(--color-border)]/[0.06]">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
                                <th className="w-8 px-3 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]">#</th>
                                <th className="px-2 py-2 text-left text-[11px] font-semibold text-[var(--color-secondary)]" />
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Played">
                                    {t('tournaments.standings.p')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Won">
                                    {t('tournaments.standings.w')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Drawn">
                                    {t('tournaments.standings.d')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Lost">
                                    {t('tournaments.standings.l')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Goals for">
                                    {t('tournaments.standings.gf')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Goals against">
                                    {t('tournaments.standings.ga')}
                                </th>
                                <th className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Goal difference">
                                    {t('tournaments.standings.gd')}
                                </th>
                                <th className="px-3 py-2 text-center text-[11px] font-semibold text-[var(--color-secondary)]" title="Points">
                                    {t('tournaments.standings.pts')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortRows(rows).map((row, index) => {
                                const qualifies = advanceCount != null && advanceCount > 0 && index < advanceCount;
                                return <tr
                                    key={row.entryId}
                                    className={`border-b border-[color:var(--color-border)]/[0.06] transition-colors hover:bg-[color:var(--color-ink)]/[0.03] ${qualifies ? 'bg-[color:var(--color-accent)]/[0.035]' : ''}`}
                                >
                                    <td className={`border-l-2 px-3 py-3 text-center text-xs font-black ${qualifies ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : 'border-transparent text-[color:var(--color-muted)]'}`}>{index + 1}</td>
                                    <td className="px-2 py-2">
                                        <span className="text-sm font-bold text-[color:var(--color-text)]">{row.entryName}</span>
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
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[color:var(--color-muted)]">{row.played}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[color:var(--color-muted)]">{row.won}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[color:var(--color-muted)]">{row.drawn}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[color:var(--color-muted)]">{row.lost}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[color:var(--color-muted)]">{row.goalsFor}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[color:var(--color-muted)]">{row.goalsAgainst}</td>
                                    <td className="px-2 py-2 text-center text-xs tabular-nums text-[var(--color-secondary)]">
                                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                    </td>
                                    <td className="px-3 py-2 text-center text-base font-black tabular-nums text-[color:var(--color-accent)]">{row.points}</td>
                                </tr>
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
