import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ButtonLink, GkRoot, PageFrame, SearchInput, Section } from '../design/primitives';
import { CATEGORIES, fetchJobsFront } from '../features/jobs/api';
import { JobRowSection, Poster } from '../features/jobs/JobCard';
import { JOBS_KEYS, jobsPath } from '../features/jobs/query';
import { AreaPicker } from '../features/store/front/StoreFrontRows';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/jobs/jobs.css';

/**
 * Jobs & volunteering for everyone, in LinkedIn's shape and the store's skin: one search and "Post a job", two doors
 * (find work, find someone), the lines of work as circles, then For you, Near you, People available, Clubs you follow
 * are hiring and Just posted. Your own applications and postings sit at the top when you have any.
 */
export const JobsPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { status } = useAuth();
    const { area, setCity } = useWorldArea();
    const [text, setText] = useState('');
    const near = area.anywhere ? undefined : area.city;
    const front = useWorldData(area.ready ? `jobs-front:${near ?? ''}` : null, signal => fetchJobsFront(near, signal), 'Jobs could not load.');
    if (JOBS_KEYS.some(key => key !== 'page' && params.has(key)) || params.has('q')) return <Navigate to={`/jobs/all?${params}`} replace />;
    const signedIn = status === 'authenticated';
    const data = front.data;
    const mine = [...(data?.applications ?? []).map(job => ({ job, kind: 'application' as const })), ...(data?.postings ?? []).map(job => ({ job, kind: 'posting' as const }))];
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <div className="gk-store-head">
                    <div><h1>Jobs & volunteering</h1><p className="gk-store-head__hint">Work in football, from clubs and from people, near you</p></div>
                    <form className="gk-store-head__search" role="search" onSubmit={event => { event.preventDefault(); navigate(jobsPath({ query: text.trim() })); }}>
                        <SearchInput aria-label="Search jobs" placeholder="Search jobs, clubs or people" maxLength={100} value={text} onChange={event => setText(event.target.value)} />
                    </form>
                    <div className="gk-store-head__actions">
                        <ButtonLink to={jobsPath()}>Browse all</ButtonLink>
                        <ButtonLink variant="primary" to="/jobs/new"><Plus aria-hidden="true" />Post a job</ButtonLink>
                    </div>
                </div>
                <div className="gk-store-stack">
                    {signedIn && mine.length > 0 && <Section title="Yours" hint="Your applications and postings">
                        <div className="gk-jobs-mine">{mine.map(({ job, kind }) => <Link key={`${kind}-${job.id}`} className="gk-jobs-mine__item" to={`/jobs/${job.id}`}><Poster job={job} size={32} /><span><strong>{job.title}</strong><small>{kind === 'application' ? `Applied · ${job.application?.status === 'PENDING' ? 'waiting for an answer' : job.application?.status?.toLowerCase()}` : `Your posting · ${job.applicationCount ?? 0} ${job.applicationCount === 1 ? 'applicant' : 'applicants'}`}</small></span></Link>)}</div>
                    </Section>}
                    <div className="gk-store-doors gk-jobs-doors">
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
                            <span className="gk-store-door__eyebrow"><UserCheck aria-hidden="true" size={16} />Find someone</span>
                            <Link className="gk-store-door__title" to={jobsPath({ direction: 'OFFERING' })}>Coaches, referees and specialists available</Link>
                            <p className="gk-store-door__line">{data ? `${data.available} people` : 'People'} offering their time: a trainer for your child, a referee for Saturday, a physio for match day</p>
                            <div className="gk-store-door__chips">
                                <Link className="gk-store-door__chip" to={jobsPath({ direction: 'OFFERING', category: 'COACHING' })}>Coaches</Link>
                                <Link className="gk-store-door__chip" to={jobsPath({ direction: 'OFFERING', category: 'MATCHDAY' })}>Referees</Link>
                                <Link className="gk-store-door__chip" to="/jobs/new">Post what you need</Link>
                            </div>
                        </article>
                    </div>
                    <nav className="gk-store-cats" aria-label="Lines of work">
                        {CATEGORIES.map(category => <Link key={category.value} className="gk-store-cat" to={jobsPath({ category: category.value })}><span className="gk-store-cat__icon"><category.icon aria-hidden="true" /></span><span>{category.label}</span></Link>)}
                    </nav>
                    <JobRowSection title="For you" hint={data?.role === 'COACH' ? 'Coaching first, then the clubs you follow and your city' : data?.role === 'REFEREE' ? 'Matchday first, then the clubs you follow and your city' : 'The clubs you follow and your city first'} to={jobsPath({ direction: 'HIRING' })} jobs={data?.forYou ?? []} loading={front.loading} error={front.error} retry={front.retry} empty="No open jobs yet" />
                    <JobRowSection title="Near you" hint={near ? <AreaPicker city={data?.city ?? near} onChange={setCity} /> : 'Nearest first'} jobs={data?.near ?? []} loading={front.loading} error={front.error} retry={front.retry} empty={near ? `No open job near ${near} yet` : 'No open job yet'} action={{ label: 'View all', to: jobsPath({ direction: 'HIRING', sort: 'NEAREST' }) }} />
                    <JobRowSection title="People available" hint="Coaches, referees and specialists offering their time" to={jobsPath({ direction: 'OFFERING' })} jobs={data?.offering ?? []} loading={front.loading} error={front.error} retry={front.retry} empty="Nobody has listed themselves yet" />
                    {signedIn && (front.loading || (data?.followed.length ?? 0) > 0) && <JobRowSection title="Clubs you follow are hiring" hint="Open roles at clubs you follow" jobs={data?.followed ?? []} loading={front.loading} error={front.error} retry={front.retry} empty="None of the clubs you follow is hiring" />}
                    <JobRowSection title="Just posted" hint="The newest listings" to={jobsPath({ sort: 'NEWEST' })} jobs={data?.fresh ?? []} loading={front.loading} error={front.error} retry={front.retry} empty="Nothing new yet" />
                </div>
            </PageFrame>
        </GkRoot>
    );
};
