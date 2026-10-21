import { useId, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Map, SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, ButtonLink, Chip, EmptyNote, Field, SearchInput } from '../../design/primitives';
import { useMediaQuery } from '../world/useMediaQuery';
import { CATEGORIES, DIRECTIONS, HOURS, TERMS, type JobSort } from './api';
import { JobRow, JobSkeletons } from './JobCard';
import { JobDetail } from './JobDetail';
import { activeFilters, PAGE_SIZE, readJobs, SORTS, withoutFilter, worldJobsPath, type JobsSearch } from './query';
import { useJobsList } from './useJobsList';

function Option({ pressed, onPress, children }: { pressed: boolean; onPress: () => void; children: ReactNode }) {
    return <button type="button" className="gk-store-option" aria-pressed={pressed} onClick={onPress}><span className="gk-store-option__dot" aria-hidden="true" />{children}</button>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
    return <fieldset className="gk-store-fgroup"><legend className="gk-store-fgroup__title">{title}</legend>{children}</fieldset>;
}

/** The filter column: the selections, then what is wanted, the line of work, the terms, the hours, who posted, where and when. */
function Filters({ query, onChange, fixedClub }: { query: JobsSearch; onChange: (next: JobsSearch) => void; fixedClub: boolean }) {
    const id = useId();
    const set = (change: Partial<JobsSearch>) => onChange({ ...query, ...change, page: 0, job: undefined });
    const selections = activeFilters(query, fixedClub);
    return (
        <div className="gk-store-filters__body">
            <div className="gk-store-filters__head"><span>Filters</span>{selections.length > 0 && <Button variant="ghost" size="sm" onClick={() => onChange({ ...query, direction: '', category: '', terms: '', hours: '', poster: '', country: '', city: '', posted: '', clubId: fixedClub ? query.clubId : undefined, page: 0, job: undefined })}>Clear all</Button>}</div>
            {selections.length > 0 && <div className="gk-store-selections" aria-label="Your selections">{selections.map(filter => <Chip key={filter.key} aria-label={`Remove ${filter.label}`} onClick={() => onChange(withoutFilter(query, filter.key))}>{filter.label}<X aria-hidden="true" /></Chip>)}</div>}
            {!fixedClub && <Group title="Looking for">
                <Option pressed={!query.direction} onPress={() => set({ direction: '' })}>Everything</Option>
                {DIRECTIONS.map(direction => <Option key={direction.value} pressed={query.direction === direction.value} onPress={() => set({ direction: direction.value })}>{direction.label}</Option>)}
            </Group>}
            <Group title="Line of work">
                <Option pressed={!query.category} onPress={() => set({ category: '' })}>Any</Option>
                {CATEGORIES.map(category => <Option key={category.value} pressed={query.category === category.value} onPress={() => set({ category: category.value })}>{category.label}</Option>)}
            </Group>
            <Group title="Terms">
                <Option pressed={!query.terms} onPress={() => set({ terms: '' })}>Paid or volunteer</Option>
                {TERMS.map(terms => <Option key={terms.value} pressed={query.terms === terms.value} onPress={() => set({ terms: terms.value })}>{terms.label}</Option>)}
            </Group>
            <Group title="Hours">
                <Option pressed={!query.hours} onPress={() => set({ hours: '' })}>Any</Option>
                {HOURS.map(hours => <Option key={hours.value} pressed={query.hours === hours.value} onPress={() => set({ hours: hours.value })}>{hours.label}</Option>)}
            </Group>
            {!fixedClub && <Group title="Posted by">
                <Option pressed={!query.poster} onPress={() => set({ poster: '' })}>Clubs and people</Option>
                <Option pressed={query.poster === 'clubs'} onPress={() => set({ poster: 'clubs' })}>Clubs</Option>
                <Option pressed={query.poster === 'people'} onPress={() => set({ poster: 'people' })}>People</Option>
            </Group>}
            {!fixedClub && <Group title="Where">
                <Field label="City" htmlFor={`${id}-city`} hint="The club's ground, or the person's town"><input id={`${id}-city`} className="gk-input" placeholder="Any city" defaultValue={query.city} key={query.city} onBlur={event => { if (event.target.value.trim() !== query.city) set({ city: event.target.value.trim() }); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); set({ city: (event.target as HTMLInputElement).value.trim() }); } }} /></Field>
            </Group>}
            <Group title="Posted">
                <Option pressed={!query.posted} onPress={() => set({ posted: '' })}>Any time</Option>
                <Option pressed={query.posted === '7D'} onPress={() => set({ posted: '7D' })}>Past 7 days</Option>
                <Option pressed={query.posted === '30D'} onPress={() => set({ posted: '30D' })}>Past 30 days</Option>
            </Group>
        </div>
    );
}

function Pages({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
    if (pages <= 1) return null;
    return <nav className="gk-store-pages" aria-label="Pages">
        <Button variant="ghost" size="sm" iconOnly aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" /></Button>
        <span className="gk-faint">{page + 1} / {pages}</span>
        <Button variant="ghost" size="sm" iconOnly aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight aria-hidden="true" /></Button>
    </nav>;
}
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
    const [text, setText] = useState(value);
    const [seen, setSeen] = useState(value);
    if (seen !== value) { setSeen(value); setText(value); }
    const commit = () => { if (text.trim() !== value) onCommit(text.trim()); };
    return <form role="search" className="gk-store-toolbar__search" onSubmit={event => { event.preventDefault(); commit(); }}><SearchInput aria-label="Search jobs" placeholder="Search jobs, clubs or people" maxLength={100} value={text} onChange={event => setText(event.target.value)} onBlur={commit} /></form>;
}

/**
 * The jobs catalogue as LinkedIn lays it out: the filter column, the toolbar, the rows on the left and the chosen
 * listing open on the right (on a narrow screen a row opens the job page). "Show on map" takes the same search to World.
 */
export function JobsCatalogue({ fixedClubId, revision = 0, embedded = false, empty }: { fixedClubId?: number; revision?: number; /** Inside the club page the column is narrow: rows open the job page. */ embedded?: boolean;
    /** Replaces the whole catalogue while the club has nothing listed (no toolbar or filters over nothing). */ empty?: ReactNode }) {
    const id = useId();
    const { query, update, jobs, total, loading, error, retry } = useJobsList(fixedClubId, revision);
    const [sheet, setSheet] = useState(false);
    const wide = useMediaQuery('(min-width: 1101px)', true) && !embedded;
    const filters = activeFilters(query, !!fixedClubId);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const selected = jobs.find(job => job.id === query.job) ?? jobs[0];
    const column = <Filters query={query} onChange={next => update(next)} fixedClub={!!fixedClubId} />;
    if (empty && fixedClubId && !error && !loading && total === 0 && !filters.length && !query.query) return <div className="gk-store-results__empty">{empty}</div>;
    return (
        <div className="gk-store-catalogue">
            <aside className="gk-store-filters" aria-label="Filters">{column}</aside>
            <div className="gk-store-results">
                <div className="gk-store-toolbar">
                    <Button className="gk-store-filters__toggle" size="sm" aria-haspopup="dialog" onClick={() => setSheet(true)}><SlidersHorizontal aria-hidden="true" />Filters{filters.length ? ` (${filters.length})` : ''}</Button>
                    <SearchBox value={query.query} onCommit={value => update({ ...query, query: value, page: 0, job: undefined })} />
                    <span className="gk-store-toolbar__count" role="status">{loading && !jobs.length ? 'Loading…' : total ? `${total} ${total === 1 ? 'listing' : 'listings'}` : 'No listings'}</span>
                    <label className="gk-store-toolbar__sort" htmlFor={`${id}-sort`}>Sort<select id={`${id}-sort`} className="gk-input" value={query.sort} onChange={event => update({ ...query, sort: event.target.value as JobSort, page: 0, job: undefined })}>{SORTS.map(sort => <option key={sort.value} value={sort.value}>{sort.label}</option>)}</select></label>
                    {!fixedClubId && query.direction !== 'OFFERING' && <ButtonLink variant="ghost" size="sm" to={worldJobsPath(query)}><Map aria-hidden="true" />Show on map</ButtonLink>}
                    <Pages page={query.page} pages={pages} onPage={page => update({ ...query, page, job: undefined })} />
                </div>
                <div className="gk-store-shortcuts gk-chips" role="group" aria-label="Lines of work">
                    {CATEGORIES.map(category => <Chip key={category.value} pressed={query.category === category.value} onClick={() => update({ ...query, category: query.category === category.value ? '' : category.value, page: 0, job: undefined })}>{category.label}</Chip>)}
                </div>
                {error ? <div className="gk-store-results__empty"><EmptyNote title="Listings could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote></div>
                    : loading && !jobs.length ? <div className="gk-jobs-split"><ul className="gk-jobs-list" aria-busy="true" aria-label="Loading"><JobSkeletons /></ul></div>
                    : !jobs.length ? <div className="gk-store-results__empty"><EmptyNote title={query.query ? `Nothing matches “${query.query}”` : 'No listings match these filters'} action={(filters.length > 0 || query.query) && <Button size="sm" onClick={() => update(readJobs(new URLSearchParams(), fixedClubId))}>Clear search and filters</Button>}>Try another word or fewer filters.</EmptyNote></div>
                    : <div className="gk-jobs-split">
                        <ul className="gk-jobs-list" aria-label="Listings" aria-busy={loading}>
                            {jobs.map(job => wide
                                ? <JobRow key={job.id} job={job} selected={job.id === selected?.id} onSelect={() => update({ ...query, job: job.id }, true)} />
                                : <JobRow key={job.id} job={job} selected={false} to={`/jobs/${job.id}`} />)}
                        </ul>
                        {wide && selected && <div className="gk-jobs-pane" aria-label="The listing"><JobDetail key={selected.id} id={selected.id} pane /><div className="gk-jobs-pane__page"><ButtonLink variant="ghost" size="sm" to={`/jobs/${selected.id}`}>Open the full page</ButtonLink></div></div>}
                    </div>}
                {pages > 1 && <div className="gk-store-results__foot"><Pages page={query.page} pages={pages} onPage={page => { update({ ...query, page, job: undefined }); window.scrollTo({ top: 0 }); }} /></div>}
            </div>
            <Dialog open={sheet} title="Filters" size="sheet" onClose={() => setSheet(false)} footer={<Button variant="primary" onClick={() => setSheet(false)}>Show {total} {total === 1 ? 'listing' : 'listings'}</Button>}>
                <div className="gk-store-sheet">{column}</div>
            </Dialog>
        </div>
    );
}
