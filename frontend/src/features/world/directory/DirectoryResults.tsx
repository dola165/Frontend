import { Button, EmptyNote, List, Panel, Skeleton } from '../../../design/primitives';
import { plural } from '../format';
import type { AnySource } from './types';
import type { useDirectoryData } from './useDirectoryData';

type Data = ReturnType<typeof useDirectoryData>;

function LoadingResults({ source }: { source: AnySource }) {
    const count = source.layout === 'cards' ? 6 : 5;
    if (source.layout === 'cards') return (
        <div className="gk-world-cards" role="status" aria-label={`Loading ${source.noun[1]}`}>
            {Array.from({ length: count }, (_, index) => <div key={index} className="gk-world-card gk-world-card--skeleton"><Skeleton height={44} width={44} /><Skeleton height={18} width="70%" /><Skeleton height={14} width="45%" /></div>)}
        </div>
    );
    return (
        <Panel flush>
            <div role="status" aria-label={`Loading ${source.noun[1]}`}>
                {Array.from({ length: count }, (_, index) => <div key={index} className="gk-world-skeleton-row"><Skeleton height={36} width={36} /><span><Skeleton height={16} width="40%" /><Skeleton height={12} width="65%" /></span></div>)}
            </div>
        </Panel>
    );
}

/** Results of one source with honest loading, error, empty and load-more states. */
export function DirectoryResults({ source, data, filtered, onClear }: { source: AnySource; data: Data; filtered: boolean; onClear: () => void }) {
    if (data.loading) return <LoadingResults source={source} />;
    if (data.error) return (
        <div className="gk-notice gk-notice--danger" role="alert">
            <span className="gk-world-grow">{data.error}</span>
            <Button size="sm" onClick={data.retry}>Try again</Button>
        </div>
    );
    if (!data.items.length) return (
        <Panel>
            <EmptyNote title={filtered ? `No ${source.noun[1]} match this search` : source.empty.title}
                action={filtered ? <Button size="sm" onClick={onClear}>Clear filters</Button> : source.empty.action}>
                {filtered ? 'Try a wider search or remove a filter.' : source.empty.body}
            </EmptyNote>
        </Panel>
    );
    const { Item } = source;
    return (
        <div className="gk-stack gk-stack--tight">
            {source.layout === 'rows'
                ? <Panel flush><List label={source.label}>{data.items.map(item => <Item key={source.key(item)} item={item} />)}</List></Panel>
                : <div className="gk-world-cards">{data.items.map(item => <Item key={source.key(item)} item={item} />)}</div>}
            {(data.hasMore || data.moreError) && (
                <div className="gk-world-more">
                    {data.total != null && <span className="gk-faint">Showing {data.items.length} of {plural(data.total, source.noun[0], source.noun[1])}</span>}
                    {data.moreError && <span role="alert" className="gk-world-more__error">{data.moreError}</span>}
                    <Button onClick={data.loadMore} disabled={data.loadingMore}>{data.loadingMore ? 'Loading…' : `Show more ${source.noun[1]}`}</Button>
                </div>
            )}
        </div>
    );
}
