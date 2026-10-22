import type { CSSProperties } from 'react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WorkItem } from './api';
import { day, endWords, expectedEnd, shortDate, type Span } from './teamWorkWords';

const DAY = 24 * 3600 * 1000;

const share = (span: Span, at: Date) => Math.min(1, Math.max(0, (at.getTime() - span.from.getTime()) / (span.to.getTime() - span.from.getTime())));

/** Labels at the start, middle and end of the span, and today's line. */
export function TimeAxis({ span }: { span: Span }) {
    const copy = useJourneyCopy();
    const middle = new Date((span.from.getTime() + span.to.getTime()) / 2);
    return <span className="tw-axis" aria-hidden="true">
        <span>{shortDate(copy, span.from)}</span><span>{shortDate(copy, middle)}</span><span>{shortDate(copy, span.to)}</span>
        <i className="tw-axis__today" style={{ left: `${share(span, new Date()) * 100}%` }} />
    </span>;
}

/**
 * A piece on the strip: a light bar from its start to its expected end, the strong part the share done.
 * A vague end fades out; when nobody knows the end, only the start shows.
 */
export function TimeBar({ item, span }: { item: WorkItem; span: Span }) {
    const copy = useJourneyCopy();
    if (!item.startedOn) return <span className="tw-bar tw-bar--none">{item.status === 'PLANNED' ? copy('not started', 'არ დაწყებულა') : ''}</span>;
    const start = day(item.startedOn);
    const end = expectedEnd(item.startedOn, item.end);
    const left = share(span, start);
    const right = end ? Math.max(left + 0.01, share(span, end.at)) : Math.min(1, left + 4 * DAY / (span.to.getTime() - span.from.getTime()));
    const label = `${copy('Started', 'დაიწყო')} ${shortDate(copy, start)} · ${copy('ends', 'დასრულება')}: ${endWords(copy, item.end)} · ${item.percent}%`;
    return <span className="tw-bar" role="img" aria-label={label} title={label}>
        <span className="tw-bar__track" data-end={!end ? 'unknown' : end.vague ? 'vague' : 'firm'}
            style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%`, '--tw-done': `${item.percent}%` } as CSSProperties} />
        <i className="tw-axis__today" style={{ left: `${share(span, new Date()) * 100}%` }} />
    </span>;
}

/** On a phone the strip becomes words: "started 20 Oct · ends about 1 week". */
export function TimeWords({ item }: { item: WorkItem }) {
    const copy = useJourneyCopy();
    return <span className="tw-time-words">
        {item.startedOn ? `${copy('started', 'დაიწყო')} ${shortDate(copy, day(item.startedOn))}` : copy('not started', 'არ დაწყებულა')} · {copy('ends', 'დასრულება')}: {endWords(copy, item.end)}
    </span>;
}
