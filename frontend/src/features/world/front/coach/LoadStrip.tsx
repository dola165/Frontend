import { appLocale } from '../../../../utils/formatting';
import { useWorldCopy } from '../../copy';
import { fixtureTime } from '../../format';
import { restLabel, type LoadDay } from './load';
import './coach.css';

const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);
const letter = (date: string) => dayOf(date).toLocaleDateString(appLocale(), { weekday: 'narrow', timeZone: 'UTC' });
const weekend = (date: string) => [0, 6].includes(dayOf(date).getUTCDay());
const longDay = (date: string) => dayOf(date).toLocaleDateString(appLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Each squad's next two weeks as a strip of days: a dot on a match day (two dots' worth when it has two), and a
 * warning ring where the rest before it is short. Notes under it say which days and how much rest there is.
 */
export function LoadStrip({ rows }: { rows: { name: string; days: LoadDay[] }[] }) {
    const t = useWorldCopy();
    const header = rows[0]?.days ?? [];
    const notes = rows.flatMap(row => row.days.filter(day => day.tight).map(day => ({ key: `${row.name}:${day.date}`, text: day.matches.length > 1
        ? t('{squad}: two matches on {day}', { squad: row.name, day: longDay(day.date) })
        : day.restDays != null ? t('{squad}: {rest} before {day}', { squad: row.name, rest: restLabel(day.restDays, t).toLowerCase(), day: longDay(day.date) })
        : t('{squad}: third match in a week on {day}', { squad: row.name, day: longDay(day.date) }) })));
    return <>
        <div className="gk-load" role="table" aria-label={t('Matches over the next two weeks')}>
            <span role="row" style={{ display: 'contents' }}>
                <span role="columnheader" className="gk-load__squad"><span className="gk-visually-hidden">{t('Squad')}</span></span>
                {header.map((day, index) => <span key={day.date} role="columnheader" className="gk-load__day" data-today={index === 0 || undefined} title={longDay(day.date)}>{letter(day.date)}</span>)}
            </span>
            {rows.map(row => <span key={row.name} role="row" style={{ display: 'contents' }}>
                <span role="rowheader" className="gk-load__squad" title={row.name}>{row.name}</span>
                {row.days.map(day => <span key={day.date} role="cell" className="gk-load__cell" data-weekend={weekend(day.date) || undefined} data-tight={day.tight || undefined}
                    title={day.matches.length ? `${longDay(day.date)}: ${day.matches.map(match => `${fixtureTime(match.startsAt)} ${match.title}`).join(', ')}` : longDay(day.date)}
                    aria-label={day.matches.length ? t('{day}: {count} match', { day: longDay(day.date), count: day.matches.length }) : longDay(day.date)}>
                    {day.matches.length > 0 && <span className="gk-load__dot" data-count={Math.min(day.matches.length, 2)} />}
                </span>)}
            </span>)}
        </div>
        {notes.length > 0 && <ul className="gk-load__notes">{notes.map(note => <li key={note.key}>{note.text}</li>)}</ul>}
    </>;
}
