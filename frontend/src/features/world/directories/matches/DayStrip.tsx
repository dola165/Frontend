import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { useWorldArea } from '../../useWorldArea';
import { Button, EmptyNote, Panel } from '../../../../design/primitives';
import { appLocale } from '../../../../utils/formatting';
import { plural, useWorldCopy } from '../../copy';
import { first, type NavProps } from '../../directory/types';
import { isoDay } from '../../format';
import { useWorldData } from '../../useWorldData';
import { loadWindow, longDay, nextMatchday, shiftDay, stripDay, windowFilters } from './matchday';
import './day-strip.css';

/** The matchday window for this query, shared with the list (one request). */
function useWindow(query: NavProps['query']) {
    const { sessionId } = useAuth();
    const { area } = useWorldArea();
    const filters = windowFilters(query, area.country), today = isoDay(0);
    return useWorldData(`matchday-strip:${sessionId}:${today}:${filters}`, () => loadWindow(sessionId, filters, today), undefined, { keep: true, follow: true });
}

/**
 * The day strip over the map: the latest results at one end, a week either side of today (each day's matches counted,
 * a star where one of my teams plays), everything to come at the other. A radio group: the arrow keys move along it
 * and choose, Home goes back to today. Choosing writes the address without a history entry.
 */
export function DayStrip({ query, go }: NavProps) {
    const t = useWorldCopy();
    const window = useWindow(query);
    const today = isoDay(0);
    const period = first(query, 'period'), day = first(query, 'day');
    const days = window.data?.days ?? Array.from({ length: 15 }, (_, index) => shiftDay(today, index - 7));
    const stops = ['HISTORY', ...days, 'UPCOMING'];
    const current = period || day;
    const chosen = stops.indexOf(current);
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const strip = useRef<HTMLDivElement>(null);
    const choose = (stop: string) => go(stop === 'HISTORY' || stop === 'UPCOMING' ? { period: [stop], day: [] } : { day: [stop], period: [] });
    // The chosen day stays in view as the days scroll sideways; only the strip scrolls, never the page.
    useEffect(() => {
        const button = refs.current[chosen], days = strip.current;
        if (button && days?.contains(button)) days.scrollLeft = button.offsetLeft - (days.clientWidth - button.offsetWidth) / 2;
    }, [chosen]);
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        // From the stop that has focus (with no stop chosen, that is today), not from the first.
        const focused = refs.current.findIndex(node => node === event.target);
        const from = focused >= 0 ? focused : chosen >= 0 ? chosen : stops.indexOf(today);
        const next = event.key === 'ArrowRight' ? Math.min(stops.length - 1, from + 1) : event.key === 'ArrowLeft' ? Math.max(0, from - 1) : event.key === 'Home' ? stops.indexOf(today) : -1;
        if (next < 0) return;
        event.preventDefault();
        choose(stops[next]);
        refs.current[next]?.focus();
    };
    const locale = appLocale();
    const props = (stop: string, index: number) => ({ ref: (node: HTMLButtonElement | null) => { refs.current[index] = node; }, type: 'button' as const, role: 'radio',
        'aria-checked': stop === current, tabIndex: stop === current || (chosen < 0 && stop === today) ? 0 : -1, onClick: () => choose(stop) });
    // The ends stay in view; only the days scroll between them.
    return (
        <div className="gk-daystrip" role="radiogroup" aria-label={t('Matchday')} onKeyDown={onKey} data-loading={window.loading || undefined}>
            <button {...props('HISTORY', 0)} className="gk-daystrip__end"><ChevronLeft aria-hidden="true" />{t('Results')}</button>
            <div className="gk-daystrip__days" ref={strip}>{days.map((stop, at) => {
                const index = at + 1;
                const count = window.data?.counts.get(stop), label = stripDay(stop, locale);
                const said = window.data?.truncated ? '' : count?.count ? plural(count.count, 'match', 'matches') : t('No matches');
                return (
                    <button key={stop} {...props(stop, index)} className="gk-daystrip__day" data-today={stop === today || undefined} data-past={stop < today || undefined}
                        aria-label={[stop === today ? t('Today') : null, longDay(stop, locale), said, count?.mine ? t('Your team plays') : null].filter(Boolean).join(', ')}>
                        <span className="gk-daystrip__weekday">{stop === today ? t('Today') : label.weekday}</span>
                        <b>{label.date}</b>
                        <span className="gk-daystrip__count" aria-hidden="true">
                            {window.data && !window.data.truncated ? (count?.count || '–') : '·'}
                            {count?.mine && <Star className="gk-daystrip__mine" />}
                        </span>
                    </button>
                );
            })}</div>
            <button {...props('UPCOMING', stops.length - 1)} className="gk-daystrip__end">{t('Upcoming')}<ChevronRight aria-hidden="true" /></button>
        </div>
    );
}

/** The day before and after, beside the day's heading. Not on the ends of the list. */
export function DayStep({ query, go }: NavProps) {
    const t = useWorldCopy();
    const day = first(query, 'day');
    if (!day || first(query, 'period')) return null;
    return (
        <span className="gk-daystep">
            <button type="button" onClick={() => go({ day: [shiftDay(day, -1)], period: [] })} aria-label={t('Previous day')}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" onClick={() => go({ day: [shiftDay(day, 1)], period: [] })} aria-label={t('Next day')}><ChevronRight aria-hidden="true" /></button>
        </span>
    );
}

/** An empty day says so, and offers the next matchday (and everyone's matches, when only mine are shown). */
export function DayEmpty({ query, go, filtered, onClear }: NavProps & { filtered: boolean; onClear?: () => void }) {
    const t = useWorldCopy();
    const window = useWindow(query);
    const day = first(query, 'day'), locale = appLocale();
    if (!day || first(query, 'period')) return (
        <Panel>
            <EmptyNote title={filtered ? t('No {things} match this search', { things: t('matches') }) : t('No matches here yet')}
                action={filtered && onClear ? <Button size="sm" onClick={onClear}>{t('Clear filters')}</Button> : undefined}>
                {filtered ? t('Try a wider search or remove a filter.') : t('Matches appear when a team or competition organiser schedules or records them.')}
            </EmptyNote>
        </Panel>
    );
    const next = window.data ? nextMatchday(window.data.counts, day) : null;
    const mine = first(query, 'mine') === 'true';
    return (
        <Panel>
            <EmptyNote title={t('No matches on {day}', { day: longDay(day, locale) })} action={<>
                {next && <Button size="sm" variant="primary" onClick={() => go({ day: [next.day], period: [] })}>{t('Next matchday: {day} · {count}', { day: longDay(next.day, locale), count: next.count })}</Button>}
                {mine && <Button size="sm" onClick={() => go({ mine: [] })}>{t('Show everyone’s')}</Button>}
                {filtered && !mine && onClear && <Button size="sm" onClick={onClear}>{t('Clear filters')}</Button>}
            </>} />
        </Panel>
    );
}
