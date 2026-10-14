import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Briefcase, ChevronDown, ChevronUp, Compass, Map as MapIcon, Plus, Search, UserCheck } from 'lucide-react';
import { Button, ButtonLink, EmptyNote } from '../../design/primitives';
import { WorldMap } from '../world/map/WorldMap';
import { CATEGORIES, HOURS, TERMS, type Job } from './api';
import { JobRow, JobSkeletons } from './JobCard';
import { filterListings, pinsOf } from './mapPins';
import { JOBS_KEYS, jobsPath, jobsSearch, readJobs, type JobsSearch } from './query';

/** One filter as a line: its name on the left, its value on the right; pressed, its choices open under it. */
function Line({ label, value, options, onChoose }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChoose: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const current = options.find(option => option.value === value) ?? options[0];
    return (
        <div className="gk-jobs-line" data-open={open || undefined} data-set={value ? true : undefined}>
            <button type="button" className="gk-jobs-line__head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}><span>{label}</span><span className="gk-jobs-line__value">{current.label}{open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</span></button>
            {open && <div id={id} className="gk-jobs-line__choices" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" className="gk-store-option" aria-pressed={option.value === value} onClick={() => { onChoose(option.value); setOpen(false); }}><span className="gk-store-option__dot" aria-hidden="true" />{option.label}</button>)}</div>}
        </div>
    );
}

/**
 * The jobs map in World's frame: the map filling the screen in the hero look, the solid column on its left (search,
 * Post, what to show, the filters as lines), and on its right the glass panel with the ways in: Work, Be found, Hire.
 * The filters live in the address and travel to the catalogue with "Show as a list".
 */
export function JobsMap({ jobs, loading, counts, near, children }: { jobs: Job[]; loading: boolean; counts?: { open: number; available: number }; near?: string; children?: ReactNode }) {
    const [params, setParams] = useSearchParams();
    const query = useMemo(() => readJobs(params), [params]);
    const shown = useMemo(() => filterListings(jobs, query), [jobs, query]);
    const { points, placed } = useMemo(() => pinsOf(shown), [shown]);
    const nearest = useMemo(() => [...shown].sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)).slice(0, 40), [shown]);
    const [text, setText] = useState(query.query);
    const set = (change: Partial<JobsSearch>) => setParams(current => {
        const copy = new URLSearchParams(current);
        for (const name of JOBS_KEYS) copy.delete(name);
        copy.delete('q');
        jobsSearch({ ...query, ...change, page: 0, job: undefined, sort: 'RELEVANCE' }).forEach((value, name) => copy.set(name, value));
        return copy;
    }, { replace: true, preventScrollReset: true });
    const active = [query.category, query.terms, query.hours, query.poster, query.city, query.posted, query.query].filter(Boolean).length;
    const listPath = jobsPath({ ...query, page: 0, job: undefined });
    const people = query.direction === 'OFFERING';
    return (
        <div className="gk-jobs-stage">
            <WorldMap points={points} label="Jobs on the map" variant="hero" gestures="cooperative" insetLeft={432} insetRight={412} onSelect={() => undefined}
                overlay={<>
                    <aside className="gk-jobs-side" aria-label="Filters">
                        <div className="gk-jobs-side__head">
                            <form role="search" className="gk-jobs-side__search" onSubmit={event => { event.preventDefault(); set({ query: text.trim() }); }}>
                                <span className="gk-search"><Search aria-hidden="true" /><input className="gk-input" aria-label="Search roles, clubs or people" placeholder="Search roles, clubs or people" maxLength={100} value={text} onChange={event => setText(event.target.value)} onBlur={() => { if (text.trim() !== query.query) set({ query: text.trim() }); }} /></span>
                            </form>
                            <div className="gk-jobs-side__row">
                                {active > 0 ? <Button variant="ghost" size="sm" onClick={() => { setText(''); set({ query: '', category: '', terms: '', hours: '', poster: '', city: '', posted: '' }); }}>Clear {active}</Button> : <span className="gk-faint">{loading && !jobs.length ? 'Loading…' : `${shown.length} ${people ? 'people' : 'listings'}`}</span>}
                                <ButtonLink variant="primary" to="/jobs/new"><Plus aria-hidden="true" />Post</ButtonLink>
                            </div>
                            <div className="gk-chips gk-jobs-side__kinds" role="group" aria-label="What the map shows">
                                <button type="button" className="gk-chip" aria-pressed={!people} onClick={() => set({ direction: 'HIRING' })}><span className="gk-jobs-key" data-tone="club" aria-hidden="true" />Jobs{counts ? <span className="gk-jobs-side__count">{counts.open}</span> : null}</button>
                                <button type="button" className="gk-chip" aria-pressed={people} onClick={() => set({ direction: 'OFFERING' })}><span className="gk-jobs-key" data-tone="person" aria-hidden="true" />People available{counts ? <span className="gk-jobs-side__count">{counts.available}</span> : null}</button>
                            </div>
                        </div>
                        <div className="gk-jobs-side__body">
                            <Line label="Line of work" value={query.category} options={[{ value: '', label: 'Any' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))]} onChoose={value => set({ category: value })} />
                            <Line label="Terms" value={query.terms} options={[{ value: '', label: 'Paid or volunteer' }, ...TERMS]} onChoose={value => set({ terms: value })} />
                            <Line label="Hours" value={query.hours} options={[{ value: '', label: 'Any' }, ...HOURS]} onChoose={value => set({ hours: value })} />
                            <Line label="Posted by" value={query.poster} options={[{ value: '', label: 'Clubs and people' }, { value: 'clubs', label: 'Clubs' }, { value: 'people', label: 'People' }]} onChoose={value => set({ poster: value as JobsSearch['poster'] })} />
                            <Line label="Posted" value={query.posted} options={[{ value: '', label: 'Any time' }, { value: '7D', label: 'Past 7 days' }, { value: '30D', label: 'Past 30 days' }]} onChoose={value => set({ posted: value as JobsSearch['posted'] })} />
                            <p className="gk-jobs-side__caption">{near ? 'Nearest first' : 'Newest first'}</p>
                            {loading && !jobs.length ? <ul className="gk-jobs-list gk-jobs-side__list" aria-busy="true" aria-label="Loading"><JobSkeletons count={4} /></ul>
                                : nearest.length ? <ul className="gk-jobs-list gk-jobs-side__list" aria-label={people ? 'People on the map' : 'Jobs on the map'}>{nearest.map(job => <JobRow key={job.id} job={job} selected={false} to={`/jobs/${job.id}`} />)}</ul>
                                : <EmptyNote title={people ? 'Nobody with these filters' : 'No listings with these filters'}>Clear a filter or widen the area.</EmptyNote>}
                        </div>
                    </aside>
                    <aside className="gk-jobs-ways" aria-label="Ways in">
                        <div className="gk-jobs-ways__head"><span className="gk-jobs-ways__icon"><Compass aria-hidden="true" /></span><span className="gk-jobs-ways__titles"><strong>What are you here for?</strong><small>{near ? `Around ${near}` : 'Everywhere'} · clubs and people</small></span></div>
                        <div className="gk-jobs-ways__body">
                            <Link className="gk-jobs-way" data-tone="accent" to={jobsPath({ ...query, direction: 'HIRING', page: 0, job: undefined })}><span className="gk-jobs-way__icon"><Briefcase aria-hidden="true" /></span><span><strong>Work</strong><small>{counts ? `${counts.open} open jobs and volunteer roles` : 'Jobs and volunteer roles'}</small></span><ArrowRight aria-hidden="true" /></Link>
                            <Link className="gk-jobs-way" data-tone="accent" to="/jobs/new?as=work"><span className="gk-jobs-way__icon"><UserCheck aria-hidden="true" /></span><span><strong>Be found</strong><small>List yourself: your line of work, rate and hours</small></span><ArrowRight aria-hidden="true" /></Link>
                            <Link className="gk-jobs-way" data-tone="info" to={jobsPath({ ...query, direction: 'OFFERING', page: 0, job: undefined })}><span className="gk-jobs-way__icon"><UserCheck aria-hidden="true" /></span><span><strong>Hire</strong><small>{counts ? `${counts.available} people available now` : 'People available now'}</small></span><ArrowRight aria-hidden="true" /></Link>
                            <Link className="gk-jobs-way" data-tone="info" to="/jobs/new?as=hire"><span className="gk-jobs-way__icon"><Plus aria-hidden="true" /></span><span><strong>Post a job</strong><small>Three screens, as your club or yourself</small></span><ArrowRight aria-hidden="true" /></Link>
                            {children}
                        </div>
                    </aside>
                    <div className="gk-jobs-stage__foot">
                        <span className="gk-jobs-stage__count">{loading && !jobs.length ? 'Loading…' : `${placed} on the map${shown.length - placed ? ` · ${shown.length - placed} without a place` : ''}`}</span>
                        <Link className="gk-jobs-stage__list" to={listPath}>Show {shown.length} as a list<ArrowRight aria-hidden="true" /></Link>
                        <Link className="gk-jobs-stage__list" to="/world/opportunities?tab=jobs"><MapIcon aria-hidden="true" />Full map in World</Link>
                    </div>
                </>} />
        </div>
    );
}
