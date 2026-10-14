import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Plus, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { fetchJobs, fetchJobsFront, LINES, type Job } from '../features/jobs/api';
import { JobRow, Poster } from '../features/jobs/JobCard';
import { JobsMap } from '../features/jobs/JobsMap';
import { jobsPath } from '../features/jobs/query';
import { CircleStrip, MarketTabs } from '../features/store/front/MarketTabs';
import { useReveal } from '../features/store/front/useReveal';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/jobs/jobs.css';

/** A short list of real listings, one to a line, as the example a landing page should give. */
function Sample({ jobs, loading, error, retry }: { jobs: Job[]; loading: boolean; error: string; retry: () => void }) {
    if (error) return <EmptyNote title="Listings could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>;
    if (loading && !jobs.length) return <ul className="gk-jobs-list" aria-busy="true" aria-label="Loading"><li className="gk-job-row"><span className="gk-skeleton" style={{ display: 'block', height: 40, width: '100%' }} /></li></ul>;
    if (!jobs.length) return null;
    return <ul className="gk-jobs-list" aria-label="Listings">{jobs.map(job => <JobRow key={job.id} job={job} selected={false} to={`/jobs/${job.id}`} />)}</ul>;
}

/**
 * Jobs & volunteering for everyone: World's map frame first, every listing pinned, the filters on the left and the
 * ways in on the right; under it a short landing page that says what this is and where to go, each part on its own
 * textured band in its own colour, coming in as it scrolls into view.
 */
export const JobsPage = () => {
    const { status } = useAuth();
    const { area } = useWorldArea();
    const landing = useReveal<HTMLDivElement>();
    const near = area.anywhere ? undefined : area.city;
    const front = useWorldData(area.ready ? `jobs-front:${near ?? ''}` : null, signal => fetchJobsFront(near, signal), 'Jobs could not load.');
    const listings = useWorldData(area.ready ? `jobs-map:${near ?? ''}` : null, signal => fetchJobs({ page: 0, size: 200, direction: 'ALL', near, sort: 'NEWEST' }, signal), 'Listings could not load.');
    const signedIn = status === 'authenticated';
    const data = front.data;
    const mine = [...(data?.applications ?? []).map(job => ({ job, kind: 'application' as const })), ...(data?.postings ?? []).map(job => ({ job, kind: 'posting' as const }))];
    const sample = { loading: front.loading, error: front.error, retry: front.retry };
    const clubExample = (data?.fresh ?? []).find(job => job.poster?.kind === 'CLUB');
    const personExample = (data?.fresh ?? []).find(job => job.poster?.kind === 'PERSON');
    const available = (data?.offering ?? [])[0];
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <MarketTabs current="jobs" />
                <div className="gk-store-head">
                    <div><h1>Jobs & volunteering</h1><p className="gk-store-head__hint">Work in football, from clubs and from people, near you</p></div>
                    <span />
                    <div className="gk-store-head__actions">
                        <ButtonLink to={jobsPath()}>Browse all</ButtonLink>
                        <ButtonLink variant="primary" to="/jobs/new"><Plus aria-hidden="true" />Post</ButtonLink>
                    </div>
                </div>
                <JobsMap jobs={listings.data?.content ?? []} loading={listings.loading} counts={data ? { open: data.open, available: data.available } : undefined} near={near} />

                <div className="gk-jobs-land" ref={landing}>
                    {signedIn && mine.length > 0 && <section className="gk-jobs-land__section gk-jobs-land__mine" data-reveal>
                        <p className="gk-jobs-land__num">Yours</p>
                        <div className="gk-jobs-mine">{mine.map(({ job, kind }) => <Link key={`${kind}-${job.id}`} className="gk-jobs-mine__item" to={`/jobs/${job.id}`}><Poster job={job} size={32} /><span><strong>{job.title}</strong><small>{kind === 'application' ? `Applied · ${job.application?.status === 'PENDING' ? 'waiting for an answer' : job.application?.status?.toLowerCase()}` : `Your posting · ${job.applicationCount ?? 0} ${job.applicationCount === 1 ? 'applicant' : 'applicants'}`}</small></span></Link>)}</div>
                    </section>}

                    <section className="gk-jobs-land__section gk-jobs-land__sides">
                        <div className="gk-jobs-land__side gk-band" data-tone="accent" data-reveal>
                            <span className="gk-jobs-land__mark" aria-hidden="true">01</span>
                            <p className="gk-jobs-land__num">Find work</p>
                            <h2>{data ? `${data.open} open ${data.open === 1 ? 'job' : 'jobs'} and volunteer roles` : 'Jobs and volunteer roles'}</h2>
                            <p className="gk-jobs-land__line">Coaching, matchday, medical, analysis, media, grounds and admin. Posted by clubs, and by people who need a coach or a trainer. You answer the way the poster chose: in the app, a message, an email or their link.</p>
                            <ul className="gk-jobs-land__links">
                                <li><Link to={jobsPath({ direction: 'HIRING' })}>Browse the jobs<ArrowRight aria-hidden="true" /></Link></li>
                                <li><Link to={jobsPath({ direction: 'HIRING', terms: 'VOLUNTEER' })}>Volunteer roles only<ArrowRight aria-hidden="true" /></Link></li>
                                <li><Link to="/jobs/new?as=work">List yourself as available<ArrowRight aria-hidden="true" /></Link></li>
                            </ul>
                        </div>
                        <div className="gk-jobs-land__side gk-band" data-tone="info" data-reveal>
                            <span className="gk-jobs-land__mark" aria-hidden="true">02</span>
                            <p className="gk-jobs-land__num">Hire</p>
                            <h2>{data ? `${data.available} ${data.available === 1 ? 'person' : 'people'} available now` : 'People available now'}</h2>
                            <p className="gk-jobs-land__line">Coaches, referees, physios, analysts, listed with their rate, hours and town. Or say what you need in three screens, as your club or as yourself, and let them come to you.</p>
                            <ul className="gk-jobs-land__links">
                                <li><Link to={jobsPath({ direction: 'OFFERING' })}>Browse people available<ArrowRight aria-hidden="true" /></Link></li>
                                <li><Link to={jobsPath({ direction: 'OFFERING', category: 'COACHING' })}>Coaches for private sessions<ArrowRight aria-hidden="true" /></Link></li>
                                <li><Link to="/jobs/new?as=hire">Post a job<ArrowRight aria-hidden="true" /></Link></li>
                            </ul>
                        </div>
                    </section>

                    <section className="gk-jobs-land__section gk-band" data-tone="violet" data-reveal>
                        <span className="gk-jobs-land__mark" aria-hidden="true">03</span>
                        <p className="gk-jobs-land__num">Lines of work</p>
                        <CircleStrip title="Pick yours" hint="Each opens the jobs and the people in that line" label="Lines of work" dense>
                            {LINES.map(line => <Link key={line.id} className="gk-store-cat" to={jobsPath({ category: line.category, query: line.query ?? '' })}><span className="gk-store-cat__icon"><line.icon aria-hidden="true" /></span><span>{line.label}</span></Link>)}
                        </CircleStrip>
                    </section>

                    <section className="gk-jobs-land__section" data-reveal>
                        <p className="gk-jobs-land__num">04 · Who posts, and what it looks like</p>
                        <div className="gk-jobs-land__examples">
                            <div className="gk-band" data-tone="accent">
                                <h3><span className="gk-jobs-way__icon"><Briefcase aria-hidden="true" /></span>A club, hiring</h3>
                                <p className="gk-jobs-land__line">A role at the ground, with the pay and the hours. Applicants land in the club’s workspace.</p>
                                <Sample jobs={clubExample ? [clubExample] : []} {...sample} />
                            </div>
                            <div className="gk-band" data-tone="warning">
                                <h3><span className="gk-jobs-way__icon"><Users aria-hidden="true" /></span>A person, hiring</h3>
                                <p className="gk-jobs-land__line">A parent who needs a trainer twice a week. Answered with a message in the app, so nobody’s details are shown.</p>
                                <Sample jobs={personExample ? [personExample] : []} {...sample} />
                            </div>
                            <div className="gk-band" data-tone="info">
                                <h3><span className="gk-jobs-way__icon"><UserCheck aria-hidden="true" /></span>A person, available</h3>
                                <p className="gk-jobs-land__line">A coach or a referee with a rate and hours, found by clubs and families who are hiring.</p>
                                <Sample jobs={available ? [available] : []} {...sample} />
                            </div>
                        </div>
                    </section>

                    <section className="gk-jobs-land__section gk-jobs-land__foot gk-band" data-tone="accent" data-reveal>
                        <span className="gk-jobs-land__mark" aria-hidden="true">05</span>
                        <p className="gk-jobs-land__num">The rules that matter</p>
                        <ul className="gk-jobs-land__rules">
                            <li><Plus aria-hidden="true" /><span>Posting is free and takes three screens. Nothing is published that you did not write.</span></li>
                            <li><ShieldCheck aria-hidden="true" /><span>People who offer services to children are checked before their listing goes live.</span></li>
                            <li><Briefcase aria-hidden="true" /><span>Your applications and your postings stay here, under Yours, with every answer.</span></li>
                        </ul>
                        <div className="gk-store-head__actions"><ButtonLink variant="primary" to="/jobs/new?as=hire"><Plus aria-hidden="true" />Post a job</ButtonLink><ButtonLink to="/jobs/new?as=work"><UserCheck aria-hidden="true" />List yourself</ButtonLink><ButtonLink variant="ghost" to={jobsPath()}>Browse all</ButtonLink></div>
                    </section>
                </div>
            </PageFrame>
        </GkRoot>
    );
};
