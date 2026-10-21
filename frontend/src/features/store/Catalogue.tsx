import { useId, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, Chip, EmptyNote, SearchInput } from '../../design/primitives';
import type { StoreSort } from './api';
import { activeFilters, PAGE_SIZE, readCatalogue, type CatalogueQuery } from './query';
import { CATEGORIES, SORTS } from './labels';
import { ProductCard, ProductSkeletons } from './ProductCard';
import { StoreFilters } from './StoreFilters';
import { useCatalogue } from './useCatalogue';

/** Page numbers with previous and next, as Fanatics shows them above and below the grid. */
function Pages({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
    if (pages <= 1) return null;
    const shown = [...new Set([0, page - 1, page, page + 1, pages - 1].filter(p => p >= 0 && p < pages))].sort((a, b) => a - b);
    return (
        <nav className="gk-store-pages" aria-label="Pages">
            <Button variant="ghost" size="sm" iconOnly aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" /></Button>
            {shown.map((p, i) => <span key={p} style={{ display: 'contents' }}>{i > 0 && shown[i - 1] !== p - 1 && <span className="gk-faint" aria-hidden="true">…</span>}<Button variant="ghost" size="sm" className="gk-store-pages__page" aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p + 1}`} onClick={() => onPage(p)}>{p + 1}</Button></span>)}
            <Button variant="ghost" size="sm" iconOnly aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight aria-hidden="true" /></Button>
        </nav>
    );
}

/** A search box that searches when the person presses Enter or leaves it. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
    const [text, setText] = useState(value);
    const [seen, setSeen] = useState(value);
    if (seen !== value) { setSeen(value); setText(value); }
    return <form role="search" className="gk-store-toolbar__search" onSubmit={event => { event.preventDefault(); if (text.trim() !== value) onCommit(text.trim()); }}>
        <SearchInput aria-label="Search products" placeholder="Search products" maxLength={100} value={text} onChange={event => setText(event.target.value)} onBlur={() => { if (text.trim() !== value) onCommit(text.trim()); }} />
    </form>;
}

/**
 * The catalogue: the filter column (a sheet on phones), the toolbar (search, count, sort, pages), category
 * shortcuts and the product grid. The search lives in the address; `fixedClubId` is a club's own store, and `empty`
 * replaces the whole catalogue while that club has nothing for sale (no toolbar or filters over nothing).
 */
export function Catalogue({ fixedClubId, revision = 0, empty }: { fixedClubId?: number; revision?: number; empty?: ReactNode }) {
    const id = useId();
    const { query, update, products, total, loading, error, retry } = useCatalogue(fixedClubId, revision);
    const [sheet, setSheet] = useState(false);
    const filters = activeFilters(query, !!fixedClubId);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const first = query.page * PAGE_SIZE + 1, last = Math.min(total, (query.page + 1) * PAGE_SIZE);
    const change = (next: CatalogueQuery) => update(next);
    const clear = () => update(readCatalogue(new URLSearchParams(), fixedClubId));
    const column = <StoreFilters query={query} onChange={change} fixedClub={!!fixedClubId} />;
    if (empty && fixedClubId && !error && !loading && total === 0 && !filters.length && !query.query) return <div className="gk-store-results__empty">{empty}</div>;
    const shortcuts = CATEGORIES.filter(category => category.id !== 'OTHER' && (!query.seller || query.seller === 'clubs' || ['EQUIPMENT', 'TRAINING', 'ACCESSORIES'].includes(category.id)));
    return (
        <div className="gk-store-catalogue">
            <aside className="gk-store-filters" aria-label="Filters">{column}</aside>
            <div className="gk-store-results">
                <div className="gk-store-toolbar">
                    <Button className="gk-store-filters__toggle" size="sm" aria-haspopup="dialog" onClick={() => setSheet(true)}><SlidersHorizontal aria-hidden="true" />Filters{filters.length ? ` (${filters.length})` : ''}</Button>
                    <SearchBox value={query.query} onCommit={value => change({ ...query, query: value, page: 0 })} />
                    <span className="gk-store-toolbar__count" role="status">{loading && !products.length ? 'Loading…' : total ? `${first}–${last} of ${total}` : 'No products'}</span>
                    <label className="gk-store-toolbar__sort" htmlFor={`${id}-sort`}>Sort<select id={`${id}-sort`} className="gk-input" value={query.sort} onChange={event => change({ ...query, sort: event.target.value as StoreSort, page: 0 })}>{SORTS.map(sort => <option key={sort.value} value={sort.value}>{sort.label}</option>)}</select></label>
                    <Pages page={query.page} pages={pages} onPage={page => change({ ...query, page })} />
                </div>
                <div className="gk-store-shortcuts gk-chips" role="group" aria-label="Categories">
                    {shortcuts.map(category => <Chip key={category.id} pressed={query.category === category.id} onClick={() => change({ ...query, category: query.category === category.id ? '' : category.id, page: 0 })}>{category.label}</Chip>)}
                </div>
                {error ? <div className="gk-store-results__empty"><EmptyNote title="The store could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote></div>
                    : loading && !products.length ? <ul className="gk-store-grid" aria-busy="true" aria-label="Loading products"><ProductSkeletons count={8} /></ul>
                    : !products.length ? <div className="gk-store-results__empty"><EmptyNote title={query.query ? `Nothing matches “${query.query}”` : 'No products match these filters'} action={(filters.length > 0 || query.query) && <Button size="sm" onClick={clear}>Clear search and filters</Button>}>Try another word, a wider price range or fewer filters.</EmptyNote></div>
                    : <ul className="gk-store-grid" aria-busy={loading} aria-label="Products">{products.map(product => <li key={product.id}><ProductCard product={product} /></li>)}</ul>}
                {pages > 1 && <div className="gk-store-results__foot"><Pages page={query.page} pages={pages} onPage={page => { change({ ...query, page }); window.scrollTo({ top: 0 }); }} /></div>}
            </div>
            <Dialog open={sheet} title="Filters" size="sheet" onClose={() => setSheet(false)} footer={<Button variant="primary" onClick={() => setSheet(false)}>Show {total} {total === 1 ? 'product' : 'products'}</Button>}>
                <div className="gk-store-sheet">{column}</div>
            </Dialog>
        </div>
    );
}
