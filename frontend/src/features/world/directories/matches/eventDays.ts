import type { EventItem } from '../../../requests/api';
import { appLocale } from '../../../../utils/formatting';
import type { ResultGroup } from '../../directory/groups';
import { isoDay, isoDayOf } from '../../format';
import { zoned } from '../../scoreboard/standings';
import { longDay } from './matchday';

/**
 * Which day card an event sits in: a tournament or event already under way (started before today, not yet over) in
 * "Under way" first, then each day, soonest first; events without a date last. Times without an offset are the ground's clock.
 */
export function eventDayGroup(item: EventItem): ResultGroup {
    const start = zoned(item.startsAt), end = zoned(item.endsAt);
    if (!start) return { key: 'undated', label: 'Date to confirm', rank: 9 };
    const today = isoDay(0), day = isoDayOf(start);
    if (day < today && end && isoDayOf(end) >= today) return { key: 'under-way', label: 'Under way', rank: 0 };
    return { key: day, label: longDay(day, appLocale()), rank: 1 + Date.parse(`${day}T12:00:00Z`) / 1e13 };
}
