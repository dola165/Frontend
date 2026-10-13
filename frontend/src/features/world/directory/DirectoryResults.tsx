import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Button, EmptyNote, List, Panel, Skeleton } from '../../../design/primitives';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { peekClick, usePeek } from '../peek/usePeek';
import type { ArrangedGroup } from './groups';
import { DirectoryItemKey } from './selection';
import type { AnySource, DirectoryQuery, NavProps } from './types';
import type { DirectoryData } from './useDirectoryData';
import './result-row.css';

/** An error with a way to try again. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
    const t = useWorldCopy();
    return (
        <div className="gk-notice gk-notice--danger" role="alert">
            <span className="gk-world-grow">{message}</span>
            <Button size="sm" onClick={onRetry}>{t('Try again')}</Button>
        </div>
    );
}

/** Placeholder rows while a list loads: a 40px crest, a name and a line. */
export function SkeletonRows({ count, label }: { count: number; label: string }) {
    return (
        <div role="status" aria-label={label}>
            {Array.from({ length: count }, (_, index) => <div key={index} className="gk-world-skeleton-row"><Skeleton height={40} width={40} /><span><Skeleton height={14} width="40%" /><Skeleton height={11} width="65%" /></span></div>)}
        </div>
    );
}

/**
 * Results of one source with honest loading, error, notice, empty and load-more states. Every list reads the same way:
 * rows in one panel, and when the list is grouped (my teams, a tournament, a lane), a quiet header over each group's
 * panel with its symbol, its name, how many, one detail and one way on; an always-shown group with nothing in it says so.
 */
export function DirectoryResults({ source, data, groups, filtered, onClear, onWiden, onClearFor, query, go }: {
    source: AnySource; data: DirectoryData; /** The results in their groups, when the list is grouped. */ groups?: ArrangedGroup<unknown>[];
    /** For a source's own empty state (`source.Empty`). */ query?: DirectoryQuery; go?: NavProps['go'];
    filtered: boolean; /** Absent when nothing can be cleared. */ onClear?: () => void;
    /** The list was narrowed to a city: search every city instead. */ onWiden?: () => void;
    /** The list was narrowed to a child (`source.forWhom`): search for anyone instead. */ onClearFor?: () => void;
}) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const things = t(source.noun[1]);
    if (data.notice) return <div className="gk-notice" role="status">{data.notice}</div>;
    if (data.loading) return <Panel flush><SkeletonRows count={6} label={t('Loading {things}', { things })} /></Panel>;
    if (data.error) return <ErrorNote message={data.error} onRetry={data.retry} />;
    // Lanes are shown even when every one is empty: each says what it is waiting for.
    const standing = Boolean(groups?.some(group => group.group.empty));
    if (!data.items.length && !standing && source.Empty && query && go) return <source.Empty query={query} go={go} filtered={filtered} onClear={onClear} />;
    if (!data.items.length && !standing) {
        // Only a list the area narrows can say there are none near the city.
        const city = source.area === true ? data.area?.city : undefined, who = source.forWhom;
        // An empty list names what narrowed it (the filters, the child, the city) and offers to widen each.
        const title = filtered ? t('No {things} match this search', { things })
            : who ? (city ? t('No {things} for {who} near {city}', { things, who, city }) : t('No {things} for {who}', { things, who }))
            : city ? t('No {things} near {city} yet', { things, city }) : t(source.empty.title);
        const widen = <>
            {filtered && onClear && <Button size="sm" onClick={onClear}>{t('Clear filters')}</Button>}
            {who && onClearFor && <Button size="sm" onClick={onClearFor}>{t('Search for anyone')}</Button>}
            {onWiden && <Button size="sm" onClick={onWiden}>{t('Search everywhere')}</Button>}
        </>;
        const narrowed = filtered || Boolean(who) || Boolean(onWiden);
        return (
            <Panel>
                <EmptyNote title={title} action={narrowed ? widen : source.empty.action}>
                    {filtered ? t('Try a wider search or remove a filter.') : narrowed ? null : t(source.empty.body)}
                </EmptyNote>
            </Panel>
        );
    }
    const { Item } = source;
    const laid = (list: unknown[], label: string) => (
        <Panel flush><List label={label}>{list.map(item => <DirectoryItemKey.Provider key={source.key(item)} value={source.key(item)}><Item item={item} /></DirectoryItemKey.Provider>)}</List></Panel>
    );
    const more = (data.hasMore || data.moreError) && (
        <div className="gk-world-more">
            {data.total != null && <span className="gk-faint">{t('Showing {count} of {total}', { count: data.items.length, total: plural(data.total, source.noun[0], source.noun[1]) })}</span>}
            {data.moreError && <span role="alert" className="gk-world-more__error">{data.moreError}</span>}
            <Button onClick={data.loadMore} disabled={data.loadingMore}>{data.loadingMore ? t('Loading…') : t('Show more {things}', { things })}</Button>
        </div>
    );
    return (
        <div className="gk-stack gk-stack--tight">
            {groups && groups.length > 1
                ? groups.map(({ group, items }) => (
                    <section key={group.key} className="gk-world-group" data-tone={group.icon ? group.tint ?? 'accent' : undefined} aria-label={t(group.label)}>
                        <h3 className="gk-world-group__head">
                            {group.icon ? <span className="gk-world-group__icon" aria-hidden="true"><group.icon /></span>
                                : group.crest ? <Crest src={group.crest.src} name={group.crest.name} size={22} round={group.crest.round} /> : group.pin ? <MapPin aria-hidden="true" /> : null}
                            <span>{t(group.label)}</span>
                            {!source.groups?.uncounted && <span className="gk-world-group__count">{items.length}</span>}
                            {group.detail && <span className="gk-world-group__detail">{group.detail}</span>}
                            {group.action && <Link className="gk-world-group__action" to={group.action.to} onClick={peekClick(group.action.peek, drawers.open)}>{t(group.action.label)}</Link>}
                        </h3>
                        {items.length ? laid(items, t(group.label)) : <p className="gk-world-group__empty">{t(group.empty ?? 'Nothing here')}</p>}
                    </section>
                ))
                : laid(data.items, t(source.label))}
            {more}
        </div>
    );
}
