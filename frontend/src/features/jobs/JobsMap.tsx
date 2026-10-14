import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Briefcase, ChevronDown, ChevronUp, Map as MapIcon, Plus, Search, UserCheck } from 'lucide-react';
import { Button, ButtonLink } from '../../design/primitives';
import { WorldMap } from '../world/map/WorldMap';
import { CATEGORIES, HOURS, TERMS, type Job } from './api';
import { filterListings, pinsOf } from './mapPins';
import { JOBS_KEYS, jobsPath, jobsSearch, readJobs, type JobsSearch } from './query';

/** One filter as a line: its name on the left, its value on the right; pressed, its choices open under it. */
function Line({ label, value, options, onChoose }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChoose: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const current = options.find(option => option.value === value) ?? options[0];
    return (
        <div className="gk-jobs-line" data-open={open || undefined}>
            <button type="button" className="gk-jobs-line__head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}><span>{label}</span><span className="gk-jobs-line__value">{current.label}{open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</span></button>
            {open && <div id={id} className="gk-jobs-line__choices" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" className="gk-store-option" aria-pressed={option.value === value} onClick={() => { onChoose(option.value); setOpen(false); }}><span className="gk-store-option__dot" aria-hidden="true" />{option.label}</button>)}</div>}
        </div>
    );
}

/**
 * The jobs map in World's frame: the map filling the width, the filter column on the left (search, Post, what to
 * show, the filters as lines), and on the right the ways in: Work, Be found, Hire. The filters live in the address and
 * travel to the catalogue with "Show as a list".
 */
export function JobsMap({ jobs, loading, counts, near, children }: { jobs: Job[]; loading: boolean; counts?: { open: number; available: number }; near?: string; children?: ReactNode }) {
    const [params, setParams] = useSearchParams();
    const query = useMemo(() => readJobs(params), [params]);
    const shown = useMemo(() => filterListings(jobs, query), [jobs, query]);
    const { points, placed } = useMemo(() => pinsOf(shown), [shown]);
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
    return (
        <div className="gk-jobs-stage">
            <WorldMap points={points} label="Jobs on the map" gestures="cooperative" insetLeft={420} insetRight={400} onSelect={() => undefined}
                overlay={<>
                    <aside className="gk-jobs-side" aria-label="Filters">
                        <form role="search" className="gk-jobs-side__search" onSubmit={event => { event.preventDefault(); set({ query: text.trim() }); }}>
                            <span className="gk-search"><Search aria-hidden="true" /><input className="gk-input" aria-label="Search roles, clubs or people" placeholder="Search roles, clubs or people" maxLength={100} value={text} onChange={event => setText(event.target.value)} onBlur={() => { if (text.trim() !== query.query) set({ query: text.trim() }); }} /></span>
                        </form>
                        <div className="gk-jobs-side__row">
                            <ButtonLink variant="primary" to="/jobs/new"><Plus aria-hidden="true" />Post</ButtonLink>
                            {active > 0 && <Button variant="ghost" size="sm" onClick={() => { setText(''); set({ query: '', category: '', terms: '', hours: '', poster: '', city: '', posted: '' }); }}>Clear {active}</Button>}
                        </div>
                        <div className="gk-chips" role="group" aria-label="What the map shows">
                            <button type="button" className="gk-chip" aria-pressed={query.direction !== 'OFFERING'} onClick={() => set({ direction: 'HIRING' })}>Jobs{counts ? ` · ${counts.open}` : ''}</button>
                            <button type="button" className="gk-chip" aria-pressed={query.direction === 'OFFERING'} onClick={() => set({ direction: 'OFFERING' })}>People available{counts ? ` · ${counts.available}` : ''}</button>
                        </div>
                        <div className="gk-jobs-lines">
                            <Line label="Line of work" value={query.category} options={[{ value: '', label: 'Any' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))]} onChoose={value => set({ category: value })} />
                            <Line label="Terms" value={query.terms} options={[{ value: '', label: 'Paid or volunteer' }, ...TERMS]} onChoose={value => set({ terms: value })} />
                            <Line label="Hours" value={query.hours} options={[{ value: '', label: 'Any' }, ...HOURS]} onChoose={value => set({ hours: value })} />
                            <Line label="Posted by" value={query.poster} options={[{ value: '', label: 'Clubs and people' }, { value: 'clubs', label: 'Clubs' }, { value: 'people', label: 'People' }]} onChoose={value => set({ poster: value as JobsSearch['poster'] })} />
                            <Line label="Posted" value={query.posted} options={[{ value: '', label: 'Any time' }, { value: '7D', label: 'Past 7 days' }, { value: '30D', label: 'Past 30 days' }]} onChoose={value => set({ posted: value as JobsSearch['posted'] })} />
                        </div>
                    </aside>
                    <aside className="gk-jobs-ways" aria-label="Ways in">
                        <p className="gk-jobs-ways__title">What are you here for?</p>
                        <Link className="gk-jobs-way" to={jobsPath({ ...query, direction: 'HIRING', page: 0, job: undefined })}><Briefcase aria-hidden="true" /><span><strong>Work</strong><small>{counts ? `${counts.open} open jobs and volunteer roles` : 'Jobs and volunteer roles'}</small></span><ArrowRight aria-hidden="true" /></Link>
                        <Link className="gk-jobs-way" to="/jobs/new?as=work"><UserCheck aria-hidden="true" /><span><strong>Be found</strong><small>List yourself: your line of work, rate and hours</small></span><ArrowRight aria-hidden="true" /></Link>
                        <Link className="gk-jobs-way" to={jobsPath({ ...query, direction: 'OFFERING', page: 0, job: undefined })}><UserCheck aria-hidden="true" /><span><strong>Hire</strong><small>{counts ? `${counts.available} people available now` : 'People available now'}</small></span><ArrowRight aria-hidden="true" /></Link>
                        <Link className="gk-jobs-way gk-jobs-way--quiet" to="/jobs/new?as=hire"><Plus aria-hidden="true" /><span><strong>Post a job</strong><small>Three screens, as your club or yourself</small></span><ArrowRight aria-hidden="true" /></Link>
                        {children}
                    </aside>
                    <div className="gk-jobs-stage__foot">
                        <span className="gk-jobs-stage__count">{loading && !jobs.length ? 'Loading…' : `${placed} on the map${shown.length - placed ? ` · ${shown.length - placed} without a place` : ''}${near ? ` · around ${near}` : ''}`}</span>
                        <Link className="gk-jobs-stage__list" to={listPath}>Show {shown.length} as a list<ArrowRight aria-hidden="true" /></Link>
                        <Link className="gk-jobs-stage__list" to="/world/opportunities?tab=jobs"><MapIcon aria-hidden="true" />Full map in World</Link>
                    </div>
                </>} />
        </div>
    );
}
