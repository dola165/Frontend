import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, SearchInput, Section } from '../design/primitives';
import { fetchJobsFront, LINES, type Job } from '../features/jobs/api';
import { JobRow, JobSkeletons, Poster } from '../features/jobs/JobCard';
import { modeOf, modePath, storeMode, type JobsMode } from '../features/jobs/mode';
import { JOBS_KEYS, jobsPath } from '../features/jobs/query';
import { CircleStrip, MarketTabs } from '../features/store/front/MarketTabs';
import { AreaPicker } from '../features/store/front/StoreFrontRows';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/jobs/jobs.css';

/** Which side you are on, as Upwork asks first: find work, or hire. One press switches; the choice is remembered. */
function ModeSwitch({ mode }: { mode: JobsMode }) {
    return (
        <nav className="gk-jobs-mode" aria-label="Find work or hire">
            <Link viewTransition className="gk-jobs-mode__item" to={modePath('work')} aria-current={mode === 'work' ? 'page' : undefined}><Briefcase aria-hidden="true" /><span><strong>Find work</strong><small>Jobs and volunteer roles, at clubs and for families</small></span></Link>
            <Link viewTransition className="gk-jobs-mode__item" to={modePath('hire')} aria-current={mode === 'hire' ? 'page' : undefined}><UserCheck aria-hidden="true" /><span><strong>Hire</strong><small>Coaches, referees and specialists available now</small></span></Link>
        </nav>
    );
}

/** A list of listings in a panel, one to a line, each opening its page: the useful part of a landing page. */
function Listed({ title, hint, to, jobs, loading, error, retry, empty, limit = 8 }: { title: string; hint?: React.ReactNode; to?: string; jobs: Job[]; loading: boolean; error: string; retry: () => void; empty: string; limit?: number }) {
    return (
        <Section title={title} hint={hint} action={to && jobs.length ? { label: 'View all', to } : undefined}>
            {error ? <EmptyNote title="These listings could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>
                : loading && !jobs.length ? <ul className="gk-jobs-list" aria-busy="true" aria-label="Loading"><JobSkeletons count={4} /></ul>
                : !jobs.length ? <EmptyNote title={empty} />
                : <ul className="gk-jobs-list" aria-label={title}>{jobs.slice(0, limit).map(job => <JobRow key={job.id} job={job} selected={false} to={`/jobs/${job.id}`} />)}</ul>}
        </Section>
    );
}

/** Your own side of it: applications you sent (work), or postings and their applicants (hire). */
function Mine({ items, kind }: { items: Job[]; kind: 'application' | 'posting' }) {
    if (!items.length) return null;
    return (
        <Section title={kind === 'application' ? 'Your applications' : 'Your postings'} hint={kind === 'application' ? 'Where you applied' : 'Who answered'}>
            <div className="gk-jobs-mine">{items.map(job => <Link key={job.id} className="gk-jobs-mine__item" to={`/jobs/${job.id}`}><Poster job={job} size={32} /><span><strong>{job.title}</strong><small>{kind === 'application' ? `Applied · ${job.application?.status === 'PENDING' ? 'waiting for an answer' : job.application?.status?.toLowerCase()}` : `${job.applicationCount ?? 0} ${job.applicationCount === 1 ? 'applicant' : 'applicants'}`}</small></span></Link>)}</div>
        </Section>
    );
}

/**
 * Jobs & volunteering for everyone, split as Upwork splits it and kept plain: "Find work" lists the jobs for you,
 * near you and from the clubs you follow, one to a line; "Hire" lists the people available the same way. The lines of
 * work and one search sit above; your own applications or postings at the top; the one next step beside the list.
 */
export const JobsPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { status } = useAuth();
    const { area, setCity } = useWorldArea();
    const [text, setText] = useState('');
    const mode = modeOf(params);
    useEffect(() => { storeMode(mode); }, [mode]);
    const near = area.anywhere ? undefined : area.city;
    const front = useWorldData(area.ready ? `jobs-front:${near ?? ''}` : null, signal => fetchJobsFront(near, signal), 'Jobs could not load.');
    if (JOBS_KEYS.some(key => key !== 'page' && params.has(key)) || params.has('q')) return <Navigate to={`/jobs/all?${params}`} replace />;
    const signedIn = status === 'authenticated';
    const data = front.data;
    const hire = mode === 'hire';
    const direction = hire ? 'OFFERING' : 'HIRING';
    const offering = data?.offering ?? [];
    const byCategory = (...categories: string[]) => offering.filter(job => categories.includes(job.category ?? ''));
    const rows = { loading: front.loading, error: front.error, retry: front.retry };
    const place = near ? <AreaPicker city={data?.city ?? near} onChange={setCity} /> : 'Nearest first';
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <MarketTabs current="jobs" />
                <div className="gk-store-head">
                    <div><h1>Jobs & volunteering</h1><p className="gk-store-head__hint">{hire ? 'Find the right person for your club or your child' : 'Work in football, from clubs and from people, near you'}</p></div>
                    <form className="gk-store-head__search" role="search" onSubmit={event => { event.preventDefault(); navigate(jobsPath({ query: text.trim(), direction })); }}>
                        <SearchInput aria-label={hire ? 'Search people available' : 'Search jobs'} placeholder={hire ? 'Search coaches, referees, physios…' : 'Search jobs, clubs or people'} maxLength={100} value={text} onChange={event => setText(event.target.value)} />
                    </form>
                    <div className="gk-store-head__actions">
                        <ButtonLink to={jobsPath({ direction })}>{hire ? 'Browse all people' : 'Browse all jobs'}</ButtonLink>
                        {hire ? <ButtonLink variant="primary" to="/jobs/new?as=hire"><Plus aria-hidden="true" />Post a job</ButtonLink> : <ButtonLink variant="primary" to="/jobs/new?as=work"><UserCheck aria-hidden="true" />List yourself</ButtonLink>}
                    </div>
                </div>
                <ModeSwitch mode={mode} />
                <div className="gk-store-stack gk-jobs-landing" key={mode}>
                    {signedIn && <Mine items={hire ? data?.postings ?? [] : data?.applications ?? []} kind={hire ? 'posting' : 'application'} />}
                    <CircleStrip title={hire ? 'Who do you need?' : 'Browse by line of work'} hint={hire ? 'People available, by line of work' : 'What you do'} label="Lines of work" dense>
                        {LINES.map(line => <Link key={line.id} className="gk-store-cat" to={jobsPath({ direction, category: line.category, query: line.query ?? '' })}><span className="gk-store-cat__icon"><line.icon aria-hidden="true" /></span><span>{line.label}</span></Link>)}
                    </CircleStrip>
                    <div className="gk-jobs-landing__body">
                        <div className="gk-stack">
                            {hire ? <>
                                <Listed title="Available near you" hint={place} to={jobsPath({ direction: 'OFFERING', sort: 'NEAREST' })} jobs={offering} {...rows} empty={near ? `Nobody is listed near ${near} yet` : 'Nobody is listed yet'} limit={10} />
                                <Listed title="Coaches" hint="Private sessions, small groups, squads" to={jobsPath({ direction: 'OFFERING', category: 'COACHING' })} jobs={byCategory('COACHING')} {...rows} empty="No coach is listed yet" limit={5} />
                                <Listed title="Referees, medical and analysis" hint="Match days and specialists" to={jobsPath({ direction: 'OFFERING' })} jobs={byCategory('MATCHDAY', 'MEDICAL', 'FOOTBALL_OPERATIONS')} {...rows} empty="No specialist is listed yet" limit={5} />
                            </> : <>
                                <Listed title="For you" hint={data?.role === 'COACH' ? 'Coaching first, then the clubs you follow and your city' : data?.role === 'REFEREE' ? 'Matchday first, then the clubs you follow and your city' : 'The clubs you follow and your city first'} to={jobsPath({ direction: 'HIRING' })} jobs={data?.forYou ?? []} {...rows} empty="No open jobs yet" limit={10} />
                                <Listed title="Near you" hint={place} to={jobsPath({ direction: 'HIRING', sort: 'NEAREST' })} jobs={data?.near ?? []} {...rows} empty={near ? `No open job near ${near} yet` : 'No open job yet'} limit={6} />
                            </>}
                        </div>
                        <aside className="gk-stack gk-jobs-landing__side">
                            <div className="gk-jobs-cta">
                                {hire ? <><UserCheck aria-hidden="true" /><h2>Say what you need</h2><p>Three screens, as your club or as yourself. People answer in the app, by email or through your link.</p><ButtonLink variant="primary" to="/jobs/new?as=hire"><Plus aria-hidden="true" />Post a job</ButtonLink><Link className="gk-section__action" to={jobsPath({ direction: 'HIRING', poster: 'people' })}>What others are asking for</Link></>
                                    : <><Briefcase aria-hidden="true" /><h2>Be found</h2><p>Your line of work, your rate and your hours. Clubs and families looking to hire see you first.</p><ButtonLink variant="primary" to="/jobs/new?as=work"><UserCheck aria-hidden="true" />List yourself</ButtonLink><Link className="gk-section__action" to={jobsPath({ direction: 'OFFERING' })}>See who is listed</Link></>}
                            </div>
                            {hire
                                ? <Listed title="Just posted by others" hint="For a feel of the going rate" to={jobsPath({ direction: 'HIRING', sort: 'NEWEST' })} jobs={data?.fresh ?? []} {...rows} empty="Nothing posted yet" limit={5} />
                                : <>
                                    {signedIn && (front.loading || (data?.followed.length ?? 0) > 0) && <Listed title="Clubs you follow are hiring" hint="Open roles at clubs you follow" jobs={data?.followed ?? []} {...rows} empty="None of the clubs you follow is hiring" limit={5} />}
                                    <Listed title="Just posted" hint="The newest jobs" to={jobsPath({ direction: 'HIRING', sort: 'NEWEST' })} jobs={data?.fresh ?? []} {...rows} empty="Nothing new yet" limit={5} />
                                </>}
                        </aside>
                    </div>
                </div>
            </PageFrame>
        </GkRoot>
    );
};
