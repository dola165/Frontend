import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ButtonLink, GkRoot, PageFrame, SearchInput, Section } from '../design/primitives';
import { fetchJobsFront, LINES, type Job } from '../features/jobs/api';
import { JobRowSection, Poster } from '../features/jobs/JobCard';
import { modeOf, modePath, storeMode, type JobsMode } from '../features/jobs/mode';
import { JOBS_KEYS, jobsPath } from '../features/jobs/query';
import { TalentRowSection } from '../features/jobs/TalentCard';
import { CircleStrip, MarketTabs } from '../features/store/front/MarketTabs';
import { AreaPicker } from '../features/store/front/StoreFrontRows';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
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
 * Jobs & volunteering for everyone, split as Upwork splits it: "Find work" shows jobs to answer and lets you list
 * yourself; "Hire" shows people available and lets you post. Both sides share the search, the lines of work and
 * the store's skin.
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
                <div className="gk-store-stack" key={mode}>
                    {signedIn && <Mine items={hire ? data?.postings ?? [] : data?.applications ?? []} kind={hire ? 'posting' : 'application'} />}
                    <div className="gk-store-doors gk-jobs-doors">
                        {hire ? <>
                            <article className="gk-store-door">
                                <img className="gk-store-door__pic" src="/football/ball-field.jpg" alt="" />
                                <span className="gk-store-door__eyebrow"><UserCheck aria-hidden="true" size={16} />Available now</span>
                                <Link className="gk-store-door__title" to={jobsPath({ direction: 'OFFERING' })}>Coaches, referees and specialists</Link>
                                <p className="gk-store-door__line">{data ? `${data.available} people` : 'People'} offering their time: a trainer for your child, a referee for Saturday, a physio for match day</p>
                                <div className="gk-store-door__chips">
                                    <Link className="gk-store-door__chip" to={jobsPath({ direction: 'OFFERING', category: 'COACHING' })}>Coaches</Link>
                                    <Link className="gk-store-door__chip" to={jobsPath({ direction: 'OFFERING', category: 'MATCHDAY' })}>Referees</Link>
                                    <Link className="gk-store-door__chip" to={jobsPath({ direction: 'OFFERING', category: 'MEDICAL' })}>Medical</Link>
                                </div>
                            </article>
                            <article className="gk-store-door">
                                <img className="gk-store-door__pic" src="/football/touchline.jpg" alt="" />
                                <span className="gk-store-door__eyebrow"><Briefcase aria-hidden="true" size={16} />Post a job</span>
                                <Link className="gk-store-door__title" to="/jobs/new?as=hire">Say what you need, in three screens</Link>
                                <p className="gk-store-door__line">As your club or as yourself. People answer in the app, by email or through your link.</p>
                                <div className="gk-store-door__chips"><Link className="gk-store-door__chip" to="/jobs/new?as=hire">Post a job</Link><Link className="gk-store-door__chip" to={jobsPath({ direction: 'HIRING', poster: 'people' })}>What others ask for</Link></div>
                            </article>
                        </> : <>
                            <article className="gk-store-door">
                                <img className="gk-store-door__pic" src="/football/touchline.jpg" alt="" />
                                <span className="gk-store-door__eyebrow"><Briefcase aria-hidden="true" size={16} />Find work</span>
                                <Link className="gk-store-door__title" to={jobsPath({ direction: 'HIRING' })}>Jobs in football near you</Link>
                                <p className="gk-store-door__line">{data ? `${data.open} open jobs and volunteer roles` : 'Coaching, matchday, medical, media and more'}, from clubs and from people</p>
                                <div className="gk-store-door__chips">
                                    <Link className="gk-store-door__chip" to={jobsPath({ direction: 'HIRING', category: 'COACHING' })}>Coaching</Link>
                                    <Link className="gk-store-door__chip" to={jobsPath({ direction: 'HIRING', terms: 'VOLUNTEER' })}>Volunteering</Link>
                                    <Link className="gk-store-door__chip" to={jobsPath({ direction: 'HIRING', poster: 'people' })}>Posted by people</Link>
                                </div>
                            </article>
                            <article className="gk-store-door">
                                <img className="gk-store-door__pic" src="/football/ball-field.jpg" alt="" />
                                <span className="gk-store-door__eyebrow"><UserCheck aria-hidden="true" size={16} />Be found</span>
                                <Link className="gk-store-door__title" to="/jobs/new?as=work">List yourself as available</Link>
                                <p className="gk-store-door__line">Your line of work, your rate and your hours. Clubs and families looking to hire see you first.</p>
                                <div className="gk-store-door__chips"><Link className="gk-store-door__chip" to="/jobs/new?as=work">List yourself</Link><Link className="gk-store-door__chip" to={jobsPath({ direction: 'OFFERING' })}>See who is listed</Link></div>
                            </article>
                        </>}
                    </div>
                    <CircleStrip title={hire ? 'Who do you need?' : 'Browse by line of work'} hint={hire ? 'People available, by line of work' : 'What you do'} label="Lines of work" dense>
                        {LINES.map(line => <Link key={line.id} className="gk-store-cat" to={jobsPath({ direction, category: line.category, query: line.query ?? '' })}><span className="gk-store-cat__icon"><line.icon aria-hidden="true" /></span><span>{line.label}</span></Link>)}
                    </CircleStrip>
                    {hire ? <>
                        <TalentRowSection float="right" tone="a" title="Available near you" hint={near ? <AreaPicker city={data?.city ?? near} onChange={setCity} /> : 'Nearest first'} jobs={offering} {...rows} empty={near ? `Nobody is listed near ${near} yet` : 'Nobody is listed yet'} action={{ label: 'View all', to: jobsPath({ direction: 'OFFERING', sort: 'NEAREST' }) }} />
                        <TalentRowSection float="left" tone="b" title="Coaches" hint="Private sessions, small groups, squads" to={jobsPath({ direction: 'OFFERING', category: 'COACHING' })} jobs={byCategory('COACHING')} {...rows} empty="No coach is listed yet" />
                        <TalentRowSection float="right" tone="a" title="Referees and matchday" hint="For friendlies, tournaments and match days" to={jobsPath({ direction: 'OFFERING', category: 'MATCHDAY' })} jobs={byCategory('MATCHDAY')} {...rows} empty="No referee is listed yet" />
                        <TalentRowSection float="left" tone="b" title="Medical and analysis" hint="Physios, doctors, analysts" to={jobsPath({ direction: 'OFFERING', category: 'MEDICAL' })} jobs={byCategory('MEDICAL', 'FOOTBALL_OPERATIONS')} {...rows} empty="No specialist is listed yet" />
                        <JobRowSection float="right" tone="a" title="What others are asking for" hint="Jobs posted by clubs and families, for a feel of the going rate" to={jobsPath({ direction: 'HIRING' })} jobs={data?.fresh ?? []} {...rows} empty="Nothing posted yet" />
                    </> : <>
                        <JobRowSection float="right" tone="a" title="For you" hint={data?.role === 'COACH' ? 'Coaching first, then the clubs you follow and your city' : data?.role === 'REFEREE' ? 'Matchday first, then the clubs you follow and your city' : 'The clubs you follow and your city first'} to={jobsPath({ direction: 'HIRING' })} jobs={data?.forYou ?? []} {...rows} empty="No open jobs yet" />
                        <JobRowSection float="left" tone="b" title="Near you" hint={near ? <AreaPicker city={data?.city ?? near} onChange={setCity} /> : 'Nearest first'} jobs={data?.near ?? []} {...rows} empty={near ? `No open job near ${near} yet` : 'No open job yet'} action={{ label: 'View all', to: jobsPath({ direction: 'HIRING', sort: 'NEAREST' }) }} />
                        {signedIn && (front.loading || (data?.followed.length ?? 0) > 0) && <JobRowSection float="right" tone="a" title="Clubs you follow are hiring" hint="Open roles at clubs you follow" jobs={data?.followed ?? []} {...rows} empty="None of the clubs you follow is hiring" />}
                        <JobRowSection float="left" tone="b" title="Just posted" hint="The newest jobs" to={jobsPath({ direction: 'HIRING', sort: 'NEWEST' })} jobs={data?.fresh ?? []} {...rows} empty="Nothing new yet" />
                        <TalentRowSection float="right" tone="a" title="People like you, already listed" hint="What listing yourself looks like" to={jobsPath({ direction: 'OFFERING' })} jobs={offering} {...rows} empty="Nobody is listed yet" />
                    </>}
                </div>
            </PageFrame>
        </GkRoot>
    );
};
