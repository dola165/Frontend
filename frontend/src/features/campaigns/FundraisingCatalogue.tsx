import { ct, useCommerceCopy } from '../store/copy';
import { useId, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, Chip, EmptyNote, Field, SearchInput } from '../../design/primitives';
import { useWorldData } from '../world/useWorldData';
import { CAMPAIGN_CATEGORIES, fetchCampaignLocations, type CampaignSort } from './api';
import { FundraiserCard, FundraiserSkeletons } from './FundraiserCard';
import { FundraiserProjectLink } from '../projects/FundraiserProjectLink';
import { activeFilters, PAGE_SIZE, readFundraising, SORTS, STATES, withoutFilter, type FundraisingQuery } from './query';
import { useFundraising } from './useFundraising';

function Option({ pressed, onPress, children }: { pressed: boolean; onPress: () => void; children: ReactNode }) {
    useCommerceCopy();
    return <button type="button" className="gk-store-option" aria-pressed={pressed} onClick={onPress}><span className="gk-store-option__dot" aria-hidden="true" />{children}</button>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
    useCommerceCopy();
    return <fieldset className="gk-store-fgroup"><legend className="gk-store-fgroup__title">{title}</legend>{children}</fieldset>;
}

/** The filter column: the selections first, then Category, Status and Club location. */
function Filters({ query, onChange, fixedClub }: { query: FundraisingQuery; onChange: (next: FundraisingQuery) => void; fixedClub: boolean }) {
    useCommerceCopy();
    const id = useId();
    const set = (change: Partial<FundraisingQuery>) => onChange({ ...query, ...change, page: 0 });
    const selections = activeFilters(query, fixedClub);
    const locations = useWorldData(fixedClub ? null : `fund-locations`, signal => fetchCampaignLocations(undefined, signal));
    const countries = [...new Set((locations.data ?? []).map(item => item.country))];
    const cities = [...new Set((locations.data ?? []).filter(item => item.country === query.country).map(item => item.city).filter((city): city is string => !!city))];
    return (
        <div className="gk-store-filters__body">
            <div className="gk-store-filters__head"><span>{ct("Filters")}</span>{selections.length > 0 && <Button variant="ghost" size="sm" onClick={() => onChange({ ...query, category: '', state: 'ACTIVE', clubId: fixedClub ? query.clubId : undefined, country: '', city: '', page: 0 })}>{ct("Clear all")}</Button>}</div>
            {selections.length > 0 && <div className="gk-store-selections" aria-label={ct("Your selections")}>{selections.map(filter => <Chip key={filter.key} aria-label={ct("Remove {v0}", { v0: filter.label })} onClick={() => onChange(withoutFilter(query, filter.key))}>{ct(filter.label)}<X aria-hidden="true" /></Chip>)}</div>}
            <Group title={ct("Category")}>
                <Option pressed={!query.category} onPress={() => set({ category: '' })}>{ct("All categories")}</Option>
                {CAMPAIGN_CATEGORIES.map(category => <Option key={category.value} pressed={query.category === category.value} onPress={() => set({ category: category.value })}>{ct(category.label)}</Option>)}
            </Group>
            <Group title={ct("Status")}>{STATES.map(state => <Option key={state.value} pressed={query.state === state.value} onPress={() => set({ state: state.value })}>{ct(state.label)}</Option>)}</Group>
            {!fixedClub && <Group title={ct("Club location")}>
                <Field label={ct("Country")} htmlFor={`${id}-country`}>
                    <select id={`${id}-country`} className="gk-input" value={query.country} disabled={locations.loading} onChange={event => set({ country: event.target.value, city: '' })}>
                        <option value="">{locations.loading ? ct("Loading…") : ct("Any country")}</option>
                        {query.country && !countries.includes(query.country) && <option value={query.country}>{query.country}</option>}
                        {countries.map(country => <option key={country} value={country}>{country}</option>)}
                    </select>
                </Field>
                <Field label={ct("City")} htmlFor={`${id}-city`}>
                    <select id={`${id}-city`} className="gk-input" value={query.city} disabled={!query.country || locations.loading} onChange={event => set({ city: event.target.value })}>
                        <option value="">{query.country ? ct("Any city") : ct("Choose a country first")}</option>
                        {query.city && !cities.includes(query.city) && <option value={query.city}>{query.city}</option>}
                        {cities.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                </Field>
            </Group>}
        </div>
    );
}

function Pages({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
    useCommerceCopy();
    if (pages <= 1) return null;
    const shown = [...new Set([0, page - 1, page, page + 1, pages - 1].filter(p => p >= 0 && p < pages))].sort((a, b) => a - b);
    return (
        <nav className="gk-store-pages" aria-label={ct("Pages")}>
            <Button variant="ghost" size="sm" iconOnly aria-label={ct("Previous page")} disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" /></Button>
            {shown.map((p, i) => <span key={p} style={{ display: 'contents' }}>{i > 0 && shown[i - 1] !== p - 1 && <span className="gk-faint" aria-hidden="true">…</span>}<Button variant="ghost" size="sm" className="gk-store-pages__page" aria-current={p === page ? "page" : undefined} aria-label={ct("Page {v0}", { v0: p + 1 })} onClick={() => onPage(p)}>{p + 1}</Button></span>)}
            <Button variant="ghost" size="sm" iconOnly aria-label={ct("Next page")} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight aria-hidden="true" /></Button>
        </nav>
    );
}
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
    useCommerceCopy();
    const [text, setText] = useState(value);
    const [seen, setSeen] = useState(value);
    if (seen !== value) { setSeen(value); setText(value); }
    const commit = () => { if (text.trim() !== value) onCommit(text.trim()); };
    return <form role="search" className="gk-store-toolbar__search" onSubmit={event => { event.preventDefault(); commit(); }}><SearchInput aria-label={ct("Search fundraisers")} placeholder={ct("Search fundraisers")} maxLength={100} value={text} onChange={event => setText(event.target.value)} onBlur={commit} /></form>;
}

/** The fundraising catalogue in the store's frame: filter column (a sheet on phones and inside the club page), toolbar, category pills, grid. */
export function FundraisingCatalogue({ fixedClubId, revision = 0, manage = false, empty }: { fixedClubId?: number; revision?: number; /** The viewer works with the club: each card opens its project. */ manage?: boolean; empty?: ReactNode }) {
    useCommerceCopy();
    const id = useId();
    const { query, update, campaigns, total, loading, error, retry } = useFundraising(fixedClubId, revision);
    const [sheet, setSheet] = useState(false);
    const filters = activeFilters(query, !!fixedClubId);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const first = query.page * PAGE_SIZE + 1, last = Math.min(total, (query.page + 1) * PAGE_SIZE);
    const column = <Filters query={query} onChange={update} fixedClub={!!fixedClubId} />;
    if (empty && fixedClubId && !error && !loading && total === 0 && !filters.length && !query.query && query.state === 'ACTIVE' && query.page === 0) return <div className="gk-store-results__empty">{empty}</div>;
    return (
        <div className="gk-store-catalogue">
            <aside className="gk-store-filters" aria-label={ct("Filters")}>{column}</aside>
            <div className="gk-store-results">
                <div className="gk-store-toolbar">
                    <Button className="gk-store-filters__toggle" size="sm" aria-haspopup="dialog" onClick={() => setSheet(true)}><SlidersHorizontal aria-hidden="true" />{ct("Filters")}{filters.length ? ` (${filters.length})` : ''}</Button>
                    <SearchBox value={query.query} onCommit={value => update({ ...query, query: value, page: 0 })} />
                    <span className="gk-store-toolbar__count" role="status">{loading && !campaigns.length ? ct("Loading…") : total ? ct("{v0}–{v1} of {v2}", { v0: first, v1: last, v2: total }) : ct("No fundraisers")}</span>
                    <label className="gk-store-toolbar__sort" htmlFor={`${id}-sort`}>{ct("Sort")}<select id={`${id}-sort`} className="gk-input" value={query.sort} onChange={event => update({ ...query, sort: event.target.value as CampaignSort, page: 0 })}>{SORTS.map(sort => <option key={sort.value} value={sort.value}>{ct(sort.label)}</option>)}</select></label>
                    <Pages page={query.page} pages={pages} onPage={page => update({ ...query, page })} />
                </div>
                <div className="gk-store-shortcuts gk-chips" role="group" aria-label={ct("Categories")}>
                    {CAMPAIGN_CATEGORIES.map(category => <Chip key={category.value} pressed={query.category === category.value} onClick={() => update({ ...query, category: query.category === category.value ? '' : category.value, page: 0 })}>{ct(category.label)}</Chip>)}
                </div>
                {error ? <div className="gk-store-results__empty"><EmptyNote title={ct("Fundraisers could not load")} action={<Button size="sm" onClick={retry}>{ct("Retry")}</Button>}>{error}</EmptyNote></div>
                    : loading && !campaigns.length ? <ul className="gk-store-grid gk-fund-grid" aria-busy="true" aria-label={ct("Loading fundraisers")}><FundraiserSkeletons count={6} /></ul>
                    : !campaigns.length ? <div className="gk-store-results__empty"><EmptyNote title={query.query ? ct("Nothing matches “{v0}”", { v0: query.query }) : ct("No fundraisers match these filters")} action={(filters.length > 0 || query.query) && <Button size="sm" onClick={() => update(readFundraising(new URLSearchParams(), fixedClubId))}>{ct("Clear search and filters")}</Button>}>{ct("Try another word or fewer filters, or include ended fundraisers.")}</EmptyNote></div>
                    : <ul className="gk-store-grid gk-fund-grid" aria-busy={loading} aria-label={ct("Fundraisers")}>{campaigns.map(campaign => <li key={campaign.id}><FundraiserCard campaign={campaign} />
                        {/* On the club page the money is one tap away: GoFundMe takes it. */}
                        {fixedClubId && campaign.donateUrl && <a className="gk-fund-give-link" href={campaign.donateUrl} target="_blank" rel="noopener noreferrer">{ct("Give on GoFundMe")}<ArrowUpRight aria-hidden="true" /></a>}
                        {manage && <FundraiserProjectLink campaign={campaign} />}</li>)}</ul>}
                {pages > 1 && <div className="gk-store-results__foot"><Pages page={query.page} pages={pages} onPage={page => { update({ ...query, page }); window.scrollTo({ top: 0 }); }} /></div>}
            </div>
            <Dialog open={sheet} title={ct("Filters")} size="sheet" onClose={() => setSheet(false)} footer={<Button variant="primary" onClick={() => setSheet(false)}>{ct("Show ")}{total} {total === 1 ? 'fundraiser' : 'fundraisers'}</Button>}>
                <div className="gk-store-sheet">{column}</div>
            </Dialog>
        </div>
    );
}
