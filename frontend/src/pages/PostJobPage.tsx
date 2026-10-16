import { CreateLink } from '../features/pages/create/CreateLink';
import { pt } from '../features/pages/copy';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button, ButtonLink, EmptyNote, Field, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { canManageClubOperations } from '../features/clubs/domain';
import { CATEGORIES, HOURS, postJob, TERMS, type JobApplyMethod, type JobDirection, type JobHours } from '../features/jobs/api';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import { extractApiErrorMessage } from '../utils/apiError';
import { useOwnedDraft } from '../utils/ownedDraft';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
import '../features/jobs/jobs.css';

interface Draft { posterKind: 'CLUB' | 'PERSON'; direction: JobDirection; category: string; terms: string; hours: JobHours | ''; title: string; description: string; pay: string; city: string; licence: string; applyMethod: JobApplyMethod | ''; applyTarget: string; /** The club the person was in while writing it. */ clubId: number | null }
const empty: Draft = { posterKind: 'PERSON', direction: 'HIRING', category: '', terms: 'PAID', hours: '', title: '', description: '', pay: '', city: '', licence: '', applyMethod: '', applyTarget: '', clubId: null };
/**
 * The ways to answer that work for this poster and line of work: the in-app application exists for coaching roles
 * only (`JobApplication`), and a club has no inbox of its own, so "message" means its page's contact details.
 */
const methods = (kind: 'CLUB' | 'PERSON', direction: JobDirection, category: string): Array<{ value: JobApplyMethod; label: string; line: string }> => [
    ...(kind === 'CLUB' && category === 'COACHING' ? [{ value: 'IN_APP' as const, label: 'Apply in the app', line: 'Applicants land in your club workspace' }] : []),
    kind === 'CLUB' ? { value: 'MESSAGE', label: 'The club’s contact details', line: 'The phone and email on your club page' } : { value: 'MESSAGE', label: direction === 'OFFERING' ? 'Message me' : 'Message me in the app', line: 'A conversation on GrassKickZ' },
    { value: 'EMAIL', label: 'Email', line: 'We show the address' },
    { value: 'LINK', label: 'A link', line: 'Your own form or site' },
];

/**
 * Posting in three screens, for a club or for yourself: who you are and what you need (or offer); the title, the
 * story, the pay and the hours; how people answer. Published straight away.
 */
export const PostJobPage = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { status } = useAuth();
    const { area } = useWorldArea();
    const step = Math.min(3, Math.max(1, Number(params.get('step')) || 1));
    const side = params.get('as') === 'hire' ? 'hire' : params.get('as') === 'work' ? 'work' : null;
    // The draft is the signed-in person's; a club draft is for the club they were in when they wrote it.
    const owned = useOwnedDraft<Draft>('job', empty, { ...(params.get('club') ? { posterKind: 'CLUB' as const } : {}), ...(side ? { direction: side === 'hire' ? 'HIRING' as const : 'OFFERING' as const } : {}) });
    const draft = owned.draft;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const membership = useWorldData(status === 'authenticated' ? 'my-club' : null, () => fetchMyClubMembershipContext());
    const club = membership.data;
    const clubAllowed = !!club?.clubId && canManageClubOperations(club.myRole);
    const posterKind = draft.posterKind === 'CLUB' && clubAllowed ? 'CLUB' : 'PERSON';
    const change = (patch: Partial<Draft>) => owned.change({ ...patch, clubId: club?.clubId ?? null });
    const otherClub = draft.posterKind === 'CLUB' && draft.clubId != null && !!club && draft.clubId !== club.clubId;
    useEffect(() => { if (otherClub) owned.reset(); }, [otherClub]); // eslint-disable-line react-hooks/exhaustive-deps
    const go = (next: number) => setParams(current => { const copy = new URLSearchParams(current); if (next > 1) copy.set('step', String(next)); else copy.delete('step'); return copy; });
    const offering = draft.direction === 'OFFERING';
    const city = draft.city || (posterKind === 'CLUB' ? club?.clubName && area.city : area.city) || area.city;
    const stepOneDone = !!draft.category;
    const stepTwoDone = draft.title.trim().length >= 4 && draft.description.trim().length >= 10;
    const offered = methods(posterKind, draft.direction, draft.category);
    const applyMethod: JobApplyMethod = offered.find(method => method.value === draft.applyMethod)?.value ?? offered[0].value;
    const needsTarget = applyMethod === 'EMAIL' || applyMethod === 'LINK';
    const targetOk = !needsTarget || (applyMethod === 'EMAIL' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.applyTarget.trim()) : /^https?:\/\/\S+$/.test(draft.applyTarget.trim()));
    const publish = async () => {
        if (saving || !applyMethod) return;
        setSaving(true); setError('');
        try {
            const job = await postJob({ posterKind, clubId: posterKind === 'CLUB' ? club?.clubId : null, direction: draft.direction, title: draft.title.trim(), description: draft.description.trim(), category: draft.category as never, engagementType: draft.terms as never, hours: draft.hours || null, pay: draft.pay.trim(), city, licence: draft.licence.trim() || undefined, applyMethod, applyTarget: needsTarget ? draft.applyTarget.trim() : undefined, requiredRole: applyMethod === 'IN_APP' ? 'COACH' : null });
            owned.clear();
            toast.success(offering ? 'You are listed' : 'Your job is live', { description: job.title });
            navigate(`/jobs/${job.id}`, { replace: true });
        } catch (failure) { setError(extractApiErrorMessage(failure, 'Could not publish. Your answers are still here.')); }
        finally { setSaving(false); }
    };
    const steps = <div className="gk-fund-start__steps" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map(n => <span key={n} data-done={n <= step || undefined} />)}</div>;
    const body = status === 'bootstrapping' || membership.loading ? <><Skeleton height={34} width={320} /><Skeleton height={120} /></>
        : status !== 'authenticated' ? <EmptyNote title="Sign in to post" action={<ButtonLink variant="primary" to="/login">Sign in</ButtonLink>}>Anyone with an account can post: a club, a parent, a coach, a referee.</EmptyNote>
        : step === 1 ? <>
            {steps}
            <div><h1>{offering ? 'What do you offer?' : 'What do you need?'}</h1><p className="gk-fund-start__lead">{side ? offering ? 'Your line of work. Clubs and families looking to hire find you by it.' : 'The line of work. People find your job by it.' : 'Pick the line of work. People find listings by it.'}</p></div>
            {!side && <div className="gk-fund-start__tiles" role="group" aria-label="Which way round" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <button type="button" className="gk-fund-start__tile" aria-pressed={!offering} onClick={() => change({ direction: 'HIRING' })}><Briefcase aria-hidden="true" /><strong>I’m looking for someone</strong><small>A coach, a referee, a physio, help on match day</small></button>
                <button type="button" className="gk-fund-start__tile" aria-pressed={offering} onClick={() => change({ direction: 'OFFERING', posterKind: 'PERSON' })}><UserCheck aria-hidden="true" /><strong>I’m available</strong><small>List yourself: a coach, a referee, a specialist</small></button>
            </div>}
            {side && <p className="gk-muted">{offering ? 'Listing yourself as available.' : 'Posting a job.'} <Link className="gk-section__action" to={offering ? '/jobs/new?as=hire' : '/jobs/new?as=work'} onClick={() => change({ direction: offering ? 'HIRING' : 'OFFERING', ...(offering ? {} : { posterKind: 'PERSON' as const }) })}>{offering ? 'Post a job instead' : 'List yourself instead'}</Link></p>}
            {!offering && clubAllowed && <div className="gk-fund-start__chips" role="group" aria-label="Posting as">
                <button type="button" className="gk-chip" aria-pressed={posterKind === 'CLUB'} onClick={() => change({ posterKind: 'CLUB' })}>As {club?.clubName}</button>
                <button type="button" className="gk-chip" aria-pressed={posterKind === 'PERSON'} onClick={() => change({ posterKind: 'PERSON' })}>As myself</button>
            </div>}
            {!offering && !clubAllowed && <p className="gk-muted">{pt('Posting for a club?')} <CreateLink kind="CLUB" from="jobs" variant="text">{pt('Start your club')}</CreateLink></p>}
            <div className="gk-fund-start__tiles" role="group" aria-label="Line of work">
                {CATEGORIES.map(category => <button key={category.value} type="button" className="gk-fund-start__tile" aria-pressed={draft.category === category.value} onClick={() => change({ category: category.value })}><category.icon aria-hidden="true" /><strong>{category.label}</strong><small>{category.line}</small></button>)}
            </div>
            <div className="gk-fund-start__foot"><ButtonLink variant="ghost" to="/jobs"><ArrowLeft aria-hidden="true" />Jobs</ButtonLink><Button variant="primary" disabled={!stepOneDone} onClick={() => go(2)}>Continue</Button></div>
        </>
        : step === 2 ? <>
            {steps}
            <div><h1>{offering ? 'Tell people what you do' : 'Tell people what you need'}</h1><p className="gk-fund-start__lead">A clear title and a few sentences. The pay and the hours are the facts people look for first.</p></div>
            <Field label="Title" htmlFor="job-title"><input id="job-title" className="gk-input" autoFocus maxLength={120} placeholder={offering ? 'For example: UEFA B coach available for private sessions' : 'For example: Goalkeeper coach for my daughter, weekends'} value={draft.title} onChange={event => change({ title: event.target.value })} /></Field>
            <Field label={offering ? 'About you' : 'About the role'} htmlFor="job-description" hint={`${draft.description.length}/1200`}><textarea id="job-description" className="gk-input" maxLength={1200} placeholder={offering ? 'Your experience, who you work with, where and when.' : 'Who it is for, where and when, what matters to you.'} value={draft.description} onChange={event => change({ description: event.target.value })} /></Field>
            <div className="gk-store-fgroup__pair">
                <Field label="Pay" htmlFor="job-pay" hint="In words, as you would say it"><input id="job-pay" className="gk-input" maxLength={40} placeholder="GEL 40 / session" value={draft.pay} onChange={event => change({ pay: event.target.value })} /></Field>
                <Field label="Terms" htmlFor="job-terms"><select id="job-terms" className="gk-input" value={draft.terms} onChange={event => change({ terms: event.target.value })}>{TERMS.map(terms => <option key={terms.value} value={terms.value}>{terms.label}</option>)}</select></Field>
            </div>
            <div className="gk-store-fgroup__pair">
                <Field label="Hours" htmlFor="job-hours"><select id="job-hours" className="gk-input" value={draft.hours} onChange={event => change({ hours: event.target.value as JobHours | '' })}><option value="">Not set</option>{HOURS.map(hours => <option key={hours.value} value={hours.value}>{hours.label}</option>)}</select></Field>
                <Field label="Where" htmlFor="job-city" hint="The town; the exact place comes later"><input id="job-city" className="gk-input" maxLength={60} value={draft.city} placeholder={city} onChange={event => change({ city: event.target.value })} /></Field>
            </div>
            {draft.category === 'COACHING' && !offering && <Field label="Licence needed" htmlFor="job-licence" hint="Optional"><input id="job-licence" className="gk-input" maxLength={60} placeholder="For example: UEFA C" value={draft.licence} onChange={event => change({ licence: event.target.value })} /></Field>}
            <div className="gk-fund-start__foot"><Button variant="ghost" onClick={() => go(1)}><ArrowLeft aria-hidden="true" />Back</Button><Button variant="primary" disabled={!stepTwoDone} onClick={() => go(3)}>Continue</Button></div>
        </>
        : <>
            {steps}
            <div><h1>How do people reach you?</h1><p className="gk-fund-start__lead">{posterKind === 'CLUB' ? applyMethod === 'IN_APP' ? 'Applications in the app land in your club workspace.' : 'Where people reach your club about it.' : 'A message in the app keeps your details private.'}</p></div>
            <div className="gk-fund-start__tiles" role="group" aria-label="How to apply" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {offered.map(method => <button key={method.value} type="button" className="gk-fund-start__tile" aria-pressed={applyMethod === method.value} onClick={() => change({ applyMethod: method.value })}><strong>{method.label}</strong><small>{method.line}</small></button>)}
            </div>
            {needsTarget && <Field label={applyMethod === 'EMAIL' ? 'Email address' : 'Link'} htmlFor="job-target" hint={draft.applyTarget && !targetOk ? (applyMethod === 'EMAIL' ? 'That is not an email address.' : 'The link must start with https://') : undefined}><input id="job-target" className="gk-input" type={applyMethod === 'EMAIL' ? 'email' : 'url'} placeholder={applyMethod === 'EMAIL' ? 'jobs@yourclub.ge' : 'https://…'} value={draft.applyTarget} onChange={event => change({ applyTarget: event.target.value })} /></Field>}
            <div className="gk-fund-start__club"><Briefcase aria-hidden="true" style={{ color: 'var(--gk-accent)' }} /><div><strong>{draft.title.trim()}</strong><small>{[CATEGORIES.find(c => c.value === draft.category)?.label, draft.pay.trim() || TERMS.find(t => t.value === draft.terms)?.label, city, posterKind === 'CLUB' ? `as ${club?.clubName}` : 'as yourself'].filter(Boolean).join(' · ')}</small></div></div>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="gk-fund-start__foot"><Button variant="ghost" disabled={saving} onClick={() => go(2)}><ArrowLeft aria-hidden="true" />Back</Button><Button variant="primary" disabled={saving || !stepOneDone || !stepTwoDone || !targetOk} onClick={() => void publish()}>{saving ? 'Publishing…' : offering ? 'List myself' : 'Publish'}</Button></div>
        </>;
    return (
        <GkRoot className="gk-store gk-page" data-market="jobs">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label="Breadcrumb"><Link to="/jobs">Jobs & volunteering</Link><span aria-hidden="true">/</span><span>Post</span></nav>
                <div className="gk-fund-start">{body}</div>
            </PageFrame>
        </GkRoot>
    );
};
