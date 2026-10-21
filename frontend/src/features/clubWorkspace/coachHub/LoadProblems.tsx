import { Button, PageFrame } from '../../../design/primitives';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { capitalized, type CoachPart } from './useCoachData';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

const partKeys = { overview: 'partOverview', sessions: 'partSessions', updates: 'partUpdates' } as const;

/**
 * What could not be read for the squads shown, above every My squads page, each with its own retry. Everything that
 * did load stays usable below. One outage across every squad is one line, not one per squad.
 */
export function LoadProblems({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
    const words = (parts: CoachPart[]) => parts.map(part => copy(partKeys[part])).join(copy('partsJoin'));
    const failed = (data.squads ?? []).filter(squad => data.shown.includes(squad.id) && squad.failed.length);
    const same = failed.length > 1 && failed.length === data.shown.length && failed.every(squad => squad.failed.join() === failed[0].failed.join());
    const lines = same
        ? [{ key: 'all', text: capitalized(copy('couldNotLoad', { what: words(failed[0].failed) })), busy: failed.some(squad => data.retrying.includes(squad.id)), retry: () => failed.forEach(squad => data.retrySquad(squad.id)) }]
        : failed.map(squad => ({ key: `squad-${squad.id}`, text: copy('squadCouldNotLoad', { squad: data.names.get(squad.id) ?? '', what: words(squad.failed) }), busy: data.retrying.includes(squad.id), retry: () => data.retrySquad(squad.id) }));
    if (data.records.error || data.records.retrying) lines.push({ key: 'records', text: copy('recordsFailed'), busy: data.records.retrying, retry: data.records.retry });
    if (!lines.length) return null;
    return <PageFrame className="ch-load-problems">
        {lines.map(line => <div key={line.key} className="gk-notice gk-notice--warning" role="status">
            <span className="cw-notices__text">{line.text}</span>
            <Button size="sm" disabled={line.busy} onClick={line.retry}>{line.busy ? copy('retrying') : copy('retry')}</Button>
        </div>)}
    </PageFrame>;
}
