import { Trophy } from 'lucide-react';
import { GkRoot } from '../../design/primitives';
import { relativeTime } from '../../utils/relativeTime';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ActionButton } from './ActionButton';
import { useResultsWaiting } from './useResultsWaiting';
import './actions.css';

/** Home's card for a finished match with no score yet: the newest one, how long it has waited, and Add the score. */
export function NeedsResultCard() {
    const copy = useJourneyCopy();
    const waiting = useResultsWaiting();
    const newest = waiting?.[0];
    if (!newest) return null;
    const teams = newest.squadName && newest.opponentName ? `${newest.squadName} v ${newest.opponentName}` : newest.title;
    const more = waiting.length - 1;
    return <GkRoot><section className="gk-panel gk-needs-result" aria-label={copy('Needs a result', 'შედეგი აკლია')}>
        <span className="gk-needs-result__icon" aria-hidden="true"><Trophy /></span>
        <span className="gk-needs-result__text">
            <strong>{teams}</strong>
            <small><span className="gk-action-dot" aria-hidden="true" /><b>{copy('Needs a result', 'შედეგი აკლია')}</b><span>{relativeTime(newest.startsAt)}</span>{more > 0 && <span>· {copy(`${more} more`, `კიდევ ${more}`)}</span>}</small>
        </span>
        <ActionButton action="report_score" subject={{ kind: 'match', source: newest.kind, id: newest.id, squadId: newest.squadId }} variant="primary" size="sm" label={copy('Add the score', 'ანგარიშის დამატება')} />
    </section></GkRoot>;
}
