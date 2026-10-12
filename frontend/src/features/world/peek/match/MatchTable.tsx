import { fetchGroupStandings } from '../../../tournaments/api';
import type { TournamentDetail } from '../../../tournaments/domain';
import { shared } from '../../cache';
import { useWorldCopy } from '../../copy';
import { MiniTable } from '../../scoreboard/MiniTable';
import { tableRows } from '../../scoreboard/standings';
import { useWorldData } from '../../useWorldData';

/** Stages that have a table (the backend answers standings only for these). */
const TABLE_STAGES = ['LEAGUE', 'GROUP', 'ROUND_ROBIN'];

/**
 * A tournament stage's table, in the order the backend ranks it (its tie-breaks included): the viewer's entries starred,
 * and other entries lit (both sides of the match being looked at). Nothing for stages without a table.
 */
export function StageTable({ tournament, stageId, mine, marked, label, level = 4 }: { tournament: TournamentDetail; stageId: number | null; /** The viewer's entries: starred. */ mine: Set<number>; /** Entries lit too (both sides of a match). */ marked?: Set<number>; label?: string; /** The heading's level: 3 directly under a drawer's title, 4 under a tournament's name. */ level?: 3 | 4 }) {
    const t = useWorldCopy();
    const stage = tournament.stages.find(item => item.id === stageId);
    const table = stage && TABLE_STAGES.includes(stage.stageType);
    const standings = useWorldData(table ? `standings:${tournament.id}:${stage!.id}` : null,
        () => shared(`standings:${tournament.id}:${stage!.id}`, () => fetchGroupStandings(tournament.id, stage!.id)));
    if (!table || !standings.data?.length) return null;
    return (
        <section className="gk-peek-section">
            {level === 3 ? <h3 className="gk-peek-section__title">{label ?? stage!.name}</h3> : <h4>{label ?? stage!.name}</h4>}
            <MiniTable rows={tableRows(standings.data, mine, { keepOrder: true, marked })} through={stage!.advanceCount} label={t('{name} table', { name: stage!.name })} />
        </section>
    );
}
