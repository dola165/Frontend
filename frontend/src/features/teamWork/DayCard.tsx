import { createElement } from 'react';
import { CircleHelp, Pin, Plus } from 'lucide-react';
import { formatTime } from '../../utils/formatting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { isDone, type WorkNode } from './api';
import { eventIcon, eventWords, type DayCard as Card } from './agendaRows';
import { DoneTip } from './DoneTip';
import { useDoneTip } from './useDoneTip';
import type { WorkEvent } from './overviewApi';
import { progressWords, statusName } from './teamWorkWords';
import { KeyChip, SmallChip, StatusDot } from './WorkBits';

const names = (node: WorkNode | undefined) => node?.item.people.map(person => person.name).filter(Boolean).join(', ') ?? '';

/**
 * One task on one day, as a card: its short name, big and bold, with what it is for as one small grey line under it,
 * where it stands now, what happened to it that day (the newest event, with how many more), who is on it, its
 * progress and its plan. "Done means" shows on hover, focus or a long press. Pressed, it opens the task; a step's
 * event opens that step.
 */
export function TaskDayCard({ card, node, planName, pinned, fresh, onOpen }: {
    card: Card & { kind: 'task' }; node: WorkNode | undefined; planName?: string; pinned: boolean; fresh: boolean; onOpen: (taskId: number, stepId: number | null) => void;
}) {
    const copy = useJourneyCopy();
    const tip = useDoneTip();
    const latest = card.events[0];
    const item = node?.item;
    const status = item?.status ?? latest.task.status;
    const percent = item?.percent ?? null;
    const title = item?.title ?? latest.task.title;
    const key = item?.key ?? latest.task.key;
    const purpose = item?.description ?? null;
    const { what, detail } = eventWords(copy, latest);
    const step = latest.parentId != null ? latest.task : null;
    const more = card.events.length - 1;
    const who = names(node) || latest.by?.name || '';
    const label = `${key} ${title}. ${what}`;
    return <li className="tw-card" data-status={status} data-fresh={fresh || undefined} {...tip.holder}>
        <button type="button" className="tw-card__open" aria-label={label} {...tip.trigger} onClick={() => { if (!tip.swallow()) onOpen(card.taskId, step ? step.id : null); }}>
            <span className="tw-card__top">
                <StatusDot status={status} /><span className="tw-card__status">{statusName(copy, status)}</span>
                <KeyChip value={key} />
                {item?.small && <SmallChip />}
                {item != null && item.openQuestions > 0 && <span className="tw-task__ask gk-num" title={copy('Questions for Beqa', 'კითხვები ბექასთვის')}><CircleHelp aria-hidden="true" />{item.openQuestions}</span>}
                <span className="tw-card__time gk-num">{pinned && <Pin className="tw-agenda__pinned" aria-label={copy('Pinned', 'მიმაგრებულია')} />}{formatTime(latest.at)}</span>
            </span>
            <span className="tw-card__title">{title}</span>
            {purpose && <span className="tw-card__purpose" title={purpose}>{purpose}</span>}
            <span className="tw-card__event">{createElement(eventIcon(latest), { 'aria-hidden': true })}<span>{step && <span className="tw-card__step">{copy(`step ${step.key}: `, `ნაბიჯი ${step.key}: `)}</span>}{what}{detail && <span className="tw-card__detail"> — {detail}</span>}</span>
                {more > 0 && <span className="tw-card__more gk-num">{copy(`+${more} more`, `+${more}`)}</span>}</span>
            <span className="tw-card__bar"><span style={{ width: `${percent ?? (isDone(status) ? 100 : 0)}%` }} /></span>
            <span className="tw-card__foot">
                <span className="tw-card__percent gk-num">{percent != null && !isDone(status) ? progressWords(copy, percent) : isDone(status) ? copy('done', 'მზადაა') : ''}</span>
                <span className="tw-card__who">{[who, planName].filter(Boolean).join(' · ')}</span>
            </span>
        </button>
        <DoneTip id={tip.id} doneMeans={item?.doneMeans} />
    </li>;
}

/** Three or more tasks one person added to one plan at once: one quiet card, opened to the tasks. */
export function AddedCard({ events, expanded, planName, onToggle }: { events: WorkEvent[]; expanded: boolean; planName?: string; onToggle: () => void }) {
    const copy = useJourneyCopy();
    const first = events[0];
    const names = events.map(event => event.task.title);
    return <li className="tw-card tw-card--added">
        <button type="button" className="tw-card__open" aria-expanded={expanded} onClick={onToggle} aria-label={copy(`Added ${events.length} tasks. ${expanded ? 'Fold' : 'Show all'}`, `დაემატა ${events.length} საქმე. ${expanded ? 'აკეცვა' : 'ყველას ნახვა'}`)}>
            <span className="tw-card__top"><Plus className="tw-card__plus" aria-hidden="true" /><span className="tw-card__status">{copy(`Added ${events.length} tasks`, `დაემატა ${events.length} საქმე`)}</span><span className="tw-card__time gk-num">{formatTime(first.at)}</span></span>
            <span className="tw-card__name">{names.slice(0, 3).join(', ')}{names.length > 3 ? '…' : ''}</span>
            <span className="tw-card__foot"><span className="tw-card__who">{[first.by?.name, planName].filter(Boolean).join(' · ')}</span><span className="tw-agenda__fold">{expanded ? copy('Fold', 'აკეცვა') : copy('Show all', 'ყველას ნახვა')}</span></span>
        </button>
    </li>;
}
