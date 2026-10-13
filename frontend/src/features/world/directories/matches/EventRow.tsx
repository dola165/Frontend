import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Status } from '../../../../design/DataTable';
import { eventDestination, type EventItem } from '../../../requests/api';
import { activityColors, activityIcons, outing } from '../../../schedule/activityIcons';
import type { ScheduleEventType } from '../../../schedule/api';
import { useWorldCopy } from '../../copy';
import { DateLead, ResultRow } from '../../directory/ResultRow';
import { EVENT_BADGE } from '../../format';
import { eventWhen } from './matchPlaces';

/** An event's symbol and colour as the calendar draws them (`activityIcons`): a friendly is a handshake, a tournament a trophy. */
function symbolOf(item: EventItem): { Icon: LucideIcon; color: string } {
    if (item.activity === 'OUTING') return { Icon: outing.icon, color: outing.color };
    const type: ScheduleEventType = item.activity === 'MATCH' && /friendly/i.test(item.context) ? 'FRIENDLY'
        : item.activity === 'MATCH' || item.activity === 'TOURNAMENT' ? 'MATCH' : item.activity === 'TRAINING' ? 'TRAINING' : item.activity === 'TRYOUT' ? 'TRYOUT' : 'ACTIVITY';
    return { Icon: activityIcons[type], color: activityColors[type] };
}

/** One published event as a row: its time and day where a crest would be, its name, its symbol in a soft tint with who and where, and its kind at the end. */
export function EventRow({ item }: { item: EventItem }) {
    const t = useWorldCopy();
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    const when = eventWhen(item);
    const { Icon, color } = symbolOf(item);
    return (
        <ResultRow lead={<DateLead top={when.time} bottom={when.day} />} title={item.name} to={eventDestination(item) ?? '/world/matches?tab=events'}
            lines={[<>
                <span className="gk-result__symbol" style={{ '--symbol': color } as CSSProperties} aria-hidden="true"><Icon /></span>
                <span className="gk-result__text">{[item.context, item.location, item.recurring ? t('Every week') : null].filter(Boolean).join(' · ')}</span>
            </>]}
            aside={<Status tone={badge.tone}>{t(badge.label)}</Status>} />
    );
}
