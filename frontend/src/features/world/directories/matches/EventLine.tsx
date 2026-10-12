import type { LucideIcon } from 'lucide-react';
import { eventDestination, type EventItem } from '../../../requests/api';
import { activityColors, activityIcons, outing } from '../../../schedule/activityIcons';
import type { ScheduleEventType } from '../../../schedule/api';
import { useWorldCopy } from '../../copy';
import { useMapCounterpart } from '../../directory/selection';
import { EVENT_BADGE } from '../../format';
import { Line } from '../../scoreboard/Scoreboard';
import { eventWhen } from './matchPlaces';

/** An event's symbol and colour as the calendar draws them (`activityIcons`): a friendly is a handshake, a tournament a trophy. */
function symbolOf(item: EventItem): { Icon: LucideIcon; color: string } {
    if (item.activity === 'OUTING') return { Icon: outing.icon, color: outing.color };
    const type: ScheduleEventType = item.activity === 'MATCH' && /friendly/i.test(item.context) ? 'FRIENDLY'
        : item.activity === 'MATCH' || item.activity === 'TOURNAMENT' ? 'MATCH' : item.activity === 'TRAINING' ? 'TRAINING' : item.activity === 'TRYOUT' ? 'TRYOUT' : 'ACTIVITY';
    return { Icon: activityIcons[type], color: activityColors[type] };
}

/** One published event on the score line: its time (all day for a tournament), its symbol in a soft tint, its name, who and where, and its kind. */
export function EventLine({ item }: { item: EventItem }) {
    const t = useWorldCopy();
    const linked = useMapCounterpart();
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    return (
        <Line to={eventDestination(item) ?? '/world/matches?tab=events'} icon={symbolOf(item)} name={item.name} linked={linked}
            detail={[item.context, item.location, item.recurring ? t('Every week') : null].filter(Boolean).join(' · ')}
            when={{ time: eventWhen(item).time }} fact={t(badge.label)} />
    );
}
