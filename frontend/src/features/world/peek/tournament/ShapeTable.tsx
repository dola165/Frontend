import { Star } from 'lucide-react';
import { fetchGroupStandings } from '../../../tournaments/api';
import type { TournamentDetail } from '../../../tournaments/domain';
import type { ShapeTable } from '../../../tournaments/shape/shapeOf';
import { shared } from '../../cache';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { useWorldData } from '../../useWorldData';
import { entryById, sideName } from './tournamentPane';
import '../../scoreboard/form-table.css';

interface Row { entryId: number; rank: number; played: number; won: number; drawn: number; lost: number; gd: number; points: number; label: string }

/** A stage's rows: the draw state's ranking when it carries one (its tie-breaks applied), else the stage's standings. */
function useRows(detail: TournamentDetail, table: ShapeTable) {
    const fetched = useWorldData(table.standings ? null : `standings:${detail.id}:${table.stageId}`,
        () => shared(`standings:${detail.id}:${table.stageId}`, () => fetchGroupStandings(detail.id, table.stageId)));
    const rows: Row[] | null = table.standings
        ? table.standings.map((row, index) => ({ entryId: row.entryId, rank: row.rank || index + 1, played: row.played, won: row.wins, drawn: row.draws, lost: row.losses, gd: row.goalsFor - row.goalsAgainst, points: row.points, label: row.label }))
        : fetched.data?.map((row, index) => ({ entryId: row.entryId, rank: index + 1, played: row.played, won: row.won, drawn: row.drawn, lost: row.lost, gd: row.goalDifference, points: row.points, label: row.entryName })) ?? null;
    return { rows, loading: fetched.loading, error: fetched.error };
}

/**
 * A full table (position, team, played, won, drawn, lost, goal difference, points) as a real table: my rows starred and
 * lit, the places that go through marked and said.
 */
export function TableView({ table, detail, mine, title }: { table: ShapeTable; detail: TournamentDetail; mine: Set<number>; title?: string }) {
    const t = useWorldCopy();
    const { rows, loading, error } = useRows(detail, table);
    const through = table.through ?? 0;
    return (
        <section className="gk-tpane-table">
            {title && <h4>{title}</h4>}
            {rows?.length ? <>
                <table className="gk-ftable" aria-label={t('{name} table', { name: table.name })}>
                    <thead><tr>{[['#', 'Position'], ['Team', 'Team'], ['P', 'Played'], ['W', 'Won'], ['D', 'Drawn'], ['L', 'Lost'], ['GD', 'Goal difference'], ['Pts', 'Points']].map(([short, full]) =>
                        <th key={full} scope="col" title={t(full)}><span aria-hidden="true">{t(short)}</span><span className="gk-visually-hidden">{t(full)}</span></th>)}</tr></thead>
                    <tbody>{rows.map(row => {
                        const entry = entryById(detail, row.entryId), name = sideName(entry, row.label) ?? row.label, own = mine.has(row.entryId);
                        return (
                            <tr key={row.entryId} data-mine={own || undefined}>
                                <td><span className="gk-mtable__rank" data-through={through && row.rank <= through ? true : undefined}>{row.rank}</span>{through > 0 && row.rank <= through && <span className="gk-visually-hidden">{t('goes through')}</span>}</td>
                                <th scope="row"><span className="gk-ftable__team"><Crest name={name} size={16} round />{own && <Star aria-label={t('Your team')} />}<span>{name}{entry?.squadName && <small>{entry.squadName}</small>}</span></span></th>
                                <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td><td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td><td><b>{row.points}</b></td>
                            </tr>
                        );
                    })}</tbody>
                </table>
                {through > 0 && rows.length > through && <p className="gk-mtable__key"><span className="gk-mtable__rank" data-through aria-hidden="true" />{t('Top {count} go through', { count: through })}</p>}
            </> : <p className="gk-faint">{loading ? t('Loading…') : error ? t('This table could not load.') : t('No table yet')}</p>}
        </section>
    );
}
