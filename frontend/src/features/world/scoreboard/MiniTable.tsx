import { Star } from 'lucide-react';
import { useWorldCopy } from '../copy';
import { fixtureDay } from '../format';
import { windowAround, zoned, type CupStep, type TableRow } from './standings';
import './form-table.css';

/** A league table kept short, as score sites show it beside a fixture: my row highlighted, places that go through marked. */
export function MiniTable({ rows, through, label }: { rows: TableRow[]; /** How many places go through to the next stage. */ through?: number | null; label: string }) {
    const t = useWorldCopy();
    return (
        <>
        <table className="gk-mtable" aria-label={label}>
            <thead><tr>{[['#', 'Position'], ['Team', 'Team'], ['P', 'Played'], ['GD', 'Goal difference'], ['Pts', 'Points']].map(([short, full]) =>
                <th key={full} scope="col" title={t(full)}><span aria-hidden="true">{t(short)}</span><span className="gk-visually-hidden">{t(full)}</span></th>)}</tr></thead>
            <tbody>
                {windowAround(rows).map((row, index) => row === 'gap'
                    ? <tr key={`gap-${index}`} data-gap aria-hidden="true"><td colSpan={5}>···</td></tr>
                    : <tr key={row.entryId} data-mine={row.mine || row.marked || undefined}>
                        <td><span className="gk-mtable__rank" data-through={through && row.rank <= through ? true : undefined}>{row.rank}</span>{through != null && row.rank <= through && <span className="gk-visually-hidden">{t('goes through')}</span>}</td>
                        <td><span className="gk-mtable__team">{row.mine && <Star aria-label={t('Your team')} />}<span>{row.label}</span></span></td>
                        <td>{row.played}</td><td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td><td>{row.points}</td>
                    </tr>)}
            </tbody>
        </table>
        {through != null && through > 0 && rows.length > through && <p className="gk-mtable__key"><span className="gk-mtable__rank" data-through aria-hidden="true" />{t('Top {count} go through', { count: through })}</p>}
        </>
    );
}

/** A knockout run, one step per round: won, lost, or the next match and its date. */
export function CupPath({ steps, label }: { steps: CupStep[]; label: string }) {
    const t = useWorldCopy();
    return (
        <ol className="gk-cup" aria-label={label}>
            {steps.map(step => <li key={step.fixtureId} data-state={step.state}>
                {t(step.round)}
                {step.state === 'next' ? <b>{step.date ? fixtureDay(zoned(step.date)) : t('Date to confirm')}</b>
                    : step.state === 'level' ? <b>{step.score} · {t('winner to confirm')}</b> : <b>{t(step.state)} {step.score}</b>}
            </li>)}
        </ol>
    );
}
