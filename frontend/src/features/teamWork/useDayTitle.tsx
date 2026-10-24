import { useScheduleDates } from '../schedule/board/useScheduleDates';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

const DAY = 24 * 3600 * 1000;

/**
 * A day's heading as every Team work list shows it: "Today" or "Yesterday" with a quiet long date, other days as
 * "Thursday 22 October" (with the year when it is not this one).
 */
export function useDayTitle() {
    const copy = useJourneyCopy();
    const dates = useScheduleDates();
    return (key: string) => {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const date = new Date(`${key}T12:00:00`);
        const ago = Math.round((today.getTime() - date.getTime()) / DAY);
        const long = `${dates.dayLong(date)}${date.getFullYear() !== today.getFullYear() ? ` ${date.getFullYear()}` : ''}`;
        const near = ago === 0 ? copy('Today', 'დღეს') : ago === 1 ? copy('Yesterday', 'გუშინ') : null;
        return { key, label: near ? `${near}, ${long}` : long, today: ago === 0, title: near ? <><span>{near}</span><span className="tw-agenda__date">{long}</span></> : <span>{long}</span> };
    };
}
