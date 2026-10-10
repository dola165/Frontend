import { Button, EmptyNote, List, Panel, Skeleton } from '../../../design/primitives';
import { plural, useWorldCopy } from '../copy';
import { DirectoryItemKey } from './selection';
import type { AnySource } from './types';
import type { DirectoryData } from './useDirectoryData';

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
    if (source.layout === 'cards') return (
        <div className="gk-world-cards" role="status" aria-label={label}>
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="gk-world-card gk-world-card--skeleton"><Skeleton height={44} width={44} /><Skeleton height={18} width="70%" /><Skeleton height={14} width="45%" /></div>)}
        </div>
    );
    return <Panel flush><SkeletonRows count={5} label={label} /></Panel>;
}

/** Results of one source with honest loading, error, notice, empty and load-more states. */
export function DirectoryResults({ source, data, filtered, onClear }: { source: AnySource; data: DirectoryData; filtered: boolean; onClear: () => void }) {
    const t = useWorldCopy();
    const things = t(source.noun[1]);
    if (data.notice) return <div className="gk-notice" role="status">{data.notice}</div>;
    if (data.loading) return <LoadingResults source={source} />;
    if (data.error) return <ErrorNote message={data.error} onRetry={data.retry} />;
    if (!data.items.length) return (
        <Panel>
            <EmptyNote title={filtered ? t('No {things} match this search', { things }) : t(source.empty.title)}
                action={filtered ? <Button size="sm" onClick={onClear}>{t('Clear filters')}</Button> : source.empty.action}>
                {filtered ? t('Try a wider search or remove a filter.') : t(source.empty.body)}
            </EmptyNote>
        </Panel>
    );
    const { Item } = source;
    const items = data.items.map(item => <DirectoryItemKey.Provider key={source.key(item)} value={source.key(item)}><Item item={item} /></DirectoryItemKey.Provider>);
    return (
        <div className="gk-stack gk-stack--tight">
            {source.layout === 'rows'
                ? <Panel flush><List label={t(source.label)}>{items}</List></Panel>
                : <div className="gk-world-cards">{items}</div>}
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
