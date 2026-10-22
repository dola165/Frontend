import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WorkItem, WorkStatus } from './api';
import { statusName } from './teamWorkWords';

/** A status as its dot and word; the colour repeats what the word says. */
export function WorkStatusLabel({ status }: { status: WorkStatus }) {
    const copy = useJourneyCopy();
    return <span className="gk-status tw-status" data-status={status}><span className="gk-status__dot" aria-hidden="true" />{statusName(copy, status)}</span>;
}

/** The current step on one line, the percent and a thin bar. */
export function WorkProgress({ item }: { item: Pick<WorkItem, 'percent' | 'step' | 'status'> }) {
    const copy = useJourneyCopy();
    return <span className="tw-progress" data-status={item.status}>
        <span className="tw-progress__line"><span className="tw-progress__step">{item.step ?? <span className="gk-faint">—</span>}</span><span className="tw-progress__percent gk-num">{item.percent}%</span></span>
        <span className="tw-progress__bar" role="progressbar" aria-label={copy('Progress', 'პროგრესი')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percent}><span style={{ width: `${item.percent}%` }} /></span>
    </span>;
}
