import { MapPin } from 'lucide-react';
import { Button, EmptyNote, List, Panel, Skeleton } from '../../../design/primitives';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import type { ArrangedGroup } from './groups';
import { DirectoryItemKey } from './selection';
import type { AnySource } from './types';
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

/** Placeholder rows while a list loads. */
export function SkeletonRows({ count, label }: { count: number; label: string }) {
    return (
        <div role="status" aria-label={label}>
            {Array.from({ length: count }, (_, index) => <div key={index} className="gk-world-skeleton-row"><Skeleton height={36} width={36} /><span><Skeleton height={16} width="40%" /><Skeleton height={12} width="65%" /></span></div>)}
        </div>
    );
}

function LoadingResults({ source }: { source: AnySource }) {
    const t = useWorldCopy();
    const label = t('Loading {things}', { things: t(source.noun[1]) });
    if (source.layout === 'results') return (
        <ul className="gk-results" role="status" aria-label={label}>
            {Array.from({ length: 6 }, (_, index) => <li key={index} className="gk-world-skeleton-row"><Skeleton height={56} width={56} /><span><Skeleton height={16} width="45%" /><Skeleton height={12} width="70%" /><Skeleton height={12} width="35%" /></span></li>)}
        </ul>
    );
    if (source.layout === 'cards') return (
        <div className="gk-world-cards" role="status" aria-label={label}>
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="gk-world-card gk-world-card--skeleton"><Skeleton height={44} width={44} /><Skeleton height={18} width="70%" /><Skeleton height={14} width="45%" /></div>)}
        </div>
    );
    return <Panel flush><SkeletonRows count={5} label={label} /></Panel>;
}

/** Results of one source with honest loading, error, notice, empty and load-more states. */
export function DirectoryResults({ source, data, groups, filtered, onClear, onWiden, onClearFor }: {
    source: AnySource; data: DirectoryData; /** The results in their groups, when the list is grouped. */ groups?: ArrangedGroup<unknown>[];
    filtered: boolean; /** Absent when nothing can be cleared. */ onClear?: () => void;
    /** The list was narrowed to a city: search every city instead. */ onWiden?: () => void;
    /** The list was narrowed to a child (`source.forWhom`): search for anyone instead. */ onClearFor?: () => void;
}) {
    const t = useWorldCopy();
    const things = t(source.noun[1]);
    if (data.notice) return <div className="gk-notice" role="status">{data.notice}</div>;
    if (data.loading) return <LoadingResults source={source} />;
    if (data.error) return <ErrorNote message={data.error} onRetry={data.retry} />;
    if (!data.items.length) {
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
    const laid = (list: unknown[], label: string) => {
        const items = list.map(item => <DirectoryItemKey.Provider key={source.key(item)} value={source.key(item)}><Item item={item} /></DirectoryItemKey.Provider>);
        if (source.layout === 'results') return <ul className="gk-results" aria-label={label}>{items}</ul>;
        return source.layout === 'rows' ? <Panel flush><List label={label}>{items}</List></Panel> : <div className="gk-world-cards">{items}</div>;
    };
    return (
        <div className="gk-stack gk-stack--tight">
            {groups && groups.length > 1
                ? groups.map(({ group, items }) => (
                    <section key={group.key} className="gk-world-group" aria-label={t(group.label)}>
                        <h3 className="gk-world-group__head">
                            {group.crest ? <Crest src={group.crest.src} name={group.crest.name} size={22} round={group.crest.round} /> : group.pin ? <MapPin aria-hidden="true" /> : null}
                            <span>{t(group.label)}</span><span className="gk-world-group__count">{items.length}</span>
                        </h3>
                        {laid(items, t(group.label))}
                    </section>
                ))
                : laid(data.items, t(source.label))}
            {(data.hasMore || data.moreError) && (
                <div className="gk-world-more">
                    {data.total != null && <span className="gk-faint">{t('Showing {count} of {total}', { count: data.items.length, total: plural(data.total, source.noun[0], source.noun[1]) })}</span>}
                    {data.moreError && <span role="alert" className="gk-world-more__error">{data.moreError}</span>}
                    <Button onClick={data.loadMore} disabled={data.loadingMore}>{data.loadingMore ? t('Loading…') : t('Show more {things}', { things })}</Button>
                </div>
            )}
        </div>
    );
}
