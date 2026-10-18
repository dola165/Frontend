import { ct, useCommerceCopy } from '../features/store/copy';
import { CreateLink } from '../features/pages/create/CreateLink';
import { pt } from '../features/pages/copy';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button, ButtonLink, EmptyNote, Field, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { canManageClubOperations } from '../features/clubs/domain';
import { CATEGORIES, HOURS, postJob, TERMS, type JobApplyMethod, type JobDirection, type JobHours, type JobPublication } from '../features/jobs/api';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import { extractApiErrorMessage } from '../utils/apiError';
import { assertCurrentAuthSession, getAuthSessionId, isCurrentAuthSession } from '../utils/authStorage';
import { useOwnedDraft } from '../utils/ownedDraft';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
import '../features/jobs/jobs.css';

interface Draft { posterKind: 'CLUB' | 'PERSON'; direction: JobDirection; category: string; terms: string; hours: JobHours | ''; title: string; description: string; pay: string; city: string; licence: string; applyMethod: JobApplyMethod | ''; applyTarget: string; pendingPublication?: JobPublication; /** The club explicitly selected while writing it. */ clubId: number | null; clubName?: string }
const empty: Draft = { posterKind: 'PERSON', direction: 'HIRING', category: '', terms: 'PAID', hours: '', title: '', description: '', pay: '', city: '', licence: '', applyMethod: '', applyTarget: '', clubId: null };
/**
 * The ways to answer that work for this poster and line of work: the in-app application exists for coaching roles
 * only (`JobApplication`), and a club has no inbox of its own, so "message" means its page's contact details.
 */
const methods = (kind: 'CLUB' | 'PERSON', direction: JobDirection, category: string): Array<{ value: JobApplyMethod; label: string; line: string }> => [
    ...(kind === 'CLUB' && direction === 'HIRING' && category === 'COACHING' ? [{ value: 'IN_APP' as const, label: ct("Apply in the app"), line: ct("Applicants land in your club workspace") }] : []),
    kind === 'CLUB' ? { value: 'MESSAGE', label: ct("The club’s contact details"), line: ct("The phone and email on your club page") } : { value: 'MESSAGE', label: direction === 'OFFERING' ? ct("Message me") : ct("Message me in the app"), line: ct("A conversation on GrassKickZ") },
    { value: 'EMAIL', label: ct("Email"), line: ct("We show the address") },
    { value: 'LINK', label: ct("A link"), line: ct("Your own form or site") },
];

/**
 * Posting in three screens, for a club or for yourself: who you are and what you need (or offer); the title, the
 * story, the pay and the hours; how people answer. Published straight away.
 */
export const PostJobPage = () => {
    useCommerceCopy();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { status, user } = useAuth();
    const { area } = useWorldArea();
    const step = Math.min(3, Math.max(1, Number(params.get('step')) || 1));
    const side = params.get('as') === 'hire' ? 'hire' : params.get('as') === 'work' ? 'work' : null;
    // The draft is the signed-in person's; a club draft is for the club they were in when they wrote it.
    const clubParam = Number(params.get("club"));
    const requestedClub = Number.isSafeInteger(clubParam) && clubParam > 0 ? clubParam : null;
    const owned = useOwnedDraft<Draft>("job", { ...empty, ...(requestedClub ? { posterKind: 'CLUB' as const, clubId: requestedClub } : {}), ...(side ? { direction: side === 'hire' ? 'HIRING' as const : 'OFFERING' as const } : {}) });
    const draft = owned.draft;
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState('');
    const membership = useWorldData(status === 'authenticated' ? `my-club:${user?.id ?? ''}` : null, () => fetchMyClubMembershipContext());
    const club = membership.data;
    const clubAllowed = !!club?.clubId && canManageClubOperations(club.myRole);
    // Permission checks may block this actor, but never silently choose another one.
    const posterKind = draft.posterKind;
    const actorAllowed = posterKind === 'PERSON' || (!membership.loading && !membership.error && clubAllowed && draft.clubId === club?.clubId);
    const change = (patch: Partial<Draft>) => owned.change({ ...patch, ...((patch.posterKind === 'CLUB' || (posterKind === 'CLUB' && draft.clubId == null)) && clubAllowed ? { clubId: club!.clubId, clubName: club!.clubName ?? undefined } : {}) });
    const go = (next: number) => setParams(current => { const copy = new URLSearchParams(current); if (next > 1) copy.set('step', String(next)); else copy.delete('step'); return copy; });
    const offering = draft.direction === 'OFFERING';
    const city = draft.city || (posterKind === 'CLUB' ? club?.clubName && area.city : area.city) || area.city;
    const stepOneDone = !!draft.category;
    const stepTwoDone = draft.title.trim().length >= 4 && draft.description.trim().length >= 10;
    const offered = methods(posterKind, draft.direction, draft.category);
    const applyMethod: JobApplyMethod = offered.find(method => method.value === draft.applyMethod)?.value ?? offered[0].value;
    const needsTarget = applyMethod === 'EMAIL' || applyMethod === 'LINK';
    const targetOk = !needsTarget || (applyMethod === 'EMAIL' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.applyTarget.trim()) : /^https:\/\/\S+$/.test(draft.applyTarget.trim()));
    const publish = async () => {
        if (status !== 'authenticated' || pending.current || (!draft.pendingPublication && (!applyMethod || !actorAllowed || !stepOneDone || !stepTwoDone || !targetOk))) return;
        pending.current = true;
        setSaving(true); setError('');
        const session = getAuthSessionId();
        try {
            const command: JobPublication = draft.pendingPublication ?? { requestId: crypto.randomUUID(), posterKind, clubId: posterKind === 'CLUB' ? club?.clubId : null, direction: draft.direction, title: draft.title.trim(), description: draft.description.trim(), category: draft.category as never, engagementType: draft.terms as never, hours: draft.hours || null, pay: draft.pay.trim(), city, licence: draft.licence.trim() || undefined, applyMethod, applyTarget: needsTarget ? draft.applyTarget.trim() : undefined, requiredRole: applyMethod === 'IN_APP' ? 'COACH' : null };
            // Store the exact intent before sending: a reload after a lost response
            // must check the same receipt, never publish a second listing.
            sessionStorage.setItem(`gk.job.draft:${user!.id}`, JSON.stringify({ ...draft, pendingPublication: command }));
            owned.change({ pendingPublication: command });
            const job = await postJob(command);
            assertCurrentAuthSession(session);
            owned.clear();
            toast.success(offering ? ct("You are listed") : ct("Your job is live"), { description: job.title });
            navigate(`/jobs/${job.id}`, { replace: true });
        } catch (failure) { if (isCurrentAuthSession(session)) {
            const code = (failure as { response?: { status?: number } }).response?.status;
            if (code === 400 || code === 403 || code === 422) owned.change({ pendingPublication: undefined });
            setError(extractApiErrorMessage(failure, ct("Could not publish. Your answers are still here.")));
        } }
        finally { pending.current = false; setSaving(false); }
    };
    const steps = <div className="gk-fund-start__steps" aria-label={ct("Step {v0} of 3", { v0: step })}>{[1, 2, 3].map(n => <span key={n} data-done={n <= step || undefined} />)}</div>;
    const body = status === 'bootstrapping' || membership.loading ? <><Skeleton height={34} width={320} /><Skeleton height={120} /></>
        : status !== 'authenticated' ? <EmptyNote title={ct("Sign in to post")} action={<ButtonLink variant="primary" to={`/login?next=${encodeURIComponent(`/jobs/new${params.toString() ? `?${params}` : ''}`)}`}>{ct("Sign in")}</ButtonLink>}>{ct("Anyone with an account can post: a club, a parent, a coach, a referee.")}</EmptyNote>
        : draft.pendingPublication ? <EmptyNote title={ct("Check your publication")} action={<Button variant="primary" disabled={saving} onClick={() => void publish()}>{saving ? ct("Checking…") : ct("Check publication")}</Button>}><p>{ct("Your answers are saved. Check the previous attempt before publishing anything else.")}</p><p>{draft.pendingPublication.title}</p>{error && <p role="alert">{error}</p>}</EmptyNote>
        : <>
        {posterKind === 'CLUB' && <div className="gk-notice" role={actorAllowed ? 'status' : 'alert'}>
            <strong>{ct("Posting as ")}{draft.clubName || (draft.clubId === club?.clubId || draft.clubId == null ? club?.clubName : '') || ct("your club")}</strong>
            {!actorAllowed && <><p>{membership.error ? ct("Your club could not be checked. Your draft is still for the club.") : ct("This club draft needs confirmed staff permission. Your answers are still here.")}</p><Button size="sm" onClick={membership.retry}>{ct("Retry club check")}</Button>{clubAllowed && <Button size="sm" onClick={() => change({ posterKind: 'CLUB' })}>{ct('Use {name}', { name: club?.clubName })}</Button>}<Button size="sm" variant="ghost" onClick={() => change({ posterKind: 'PERSON', applyMethod: '' })}>{ct("Post as myself instead")}</Button></>}
        </div>}
        {posterKind === 'PERSON' && membership.error && <p className="gk-notice">{ct("Your club could not be checked. You are posting as yourself. ")}<Button size="sm" onClick={membership.retry}>{ct("Retry club check")}</Button></p>}
        {step === 1 ? <>
            {steps}
            <div><h1>{offering ? ct("What do you offer?") : ct("What do you need?")}</h1><p className="gk-fund-start__lead">{side ? offering ? ct("Your line of work. Clubs and families looking to hire find you by it.") : ct("The line of work. People find your job by it.") : ct("Pick the line of work. People find listings by it.")}</p></div>
            {!side && <div className="gk-fund-start__tiles" role="group" aria-label={ct("Which way round")} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <button type="button" className="gk-fund-start__tile" aria-pressed={!offering} onClick={() => change({ direction: 'HIRING' })}><Briefcase aria-hidden="true" /><strong>{ct("I’m looking for someone")}</strong><small>{ct("A coach, a referee, a physio, help on match day")}</small></button>
                <button type="button" className="gk-fund-start__tile" aria-pressed={offering} onClick={() => change({ direction: 'OFFERING', posterKind: 'PERSON' })}><UserCheck aria-hidden="true" /><strong>{ct("I’m available")}</strong><small>{ct("List yourself: a coach, a referee, a specialist")}</small></button>
            </div>}
            {side && <p className="gk-muted">{offering ? ct("Listing yourself as available.") : ct("Posting a job.")} <Link className="gk-section__action" to={offering ? '/jobs/new?as=hire' : '/jobs/new?as=work'} onClick={() => change({ direction: offering ? 'HIRING' : 'OFFERING', ...(offering ? {} : { posterKind: 'PERSON' as const }) })}>{offering ? ct("Post a job instead") : ct("List yourself instead")}</Link></p>}
            {!offering && clubAllowed && <div className="gk-fund-start__chips" role="group" aria-label={ct("Posting as")}>
                <button type="button" className="gk-chip" aria-pressed={posterKind === 'CLUB'} onClick={() => change({ posterKind: 'CLUB' })}>{ct("As ")}{club?.clubName}</button>
                <button type="button" className="gk-chip" aria-pressed={posterKind === 'PERSON'} onClick={() => change({ posterKind: 'PERSON' })}>{ct("As myself")}</button>
            </div>}
            {!offering && !membership.error && !club?.hasClubMembership && <p className="gk-muted">{pt('Posting for a club?')} <CreateLink kind="CLUB" from="jobs" variant="text">{pt('Start your club')}</CreateLink></p>}
            <div className="gk-fund-start__tiles" role="group" aria-label={ct("Line of work")}>
                {CATEGORIES.map(category => <button key={category.value} type="button" className="gk-fund-start__tile" aria-pressed={draft.category === category.value} onClick={() => change({ category: category.value })}><category.icon aria-hidden="true" /><strong>{ct(category.label)}</strong><small>{ct(category.line)}</small></button>)}
            </div>
            <div className="gk-fund-start__foot"><ButtonLink variant="ghost" to="/jobs"><ArrowLeft aria-hidden="true" />{ct("Jobs")}</ButtonLink><Button variant="primary" disabled={!stepOneDone || !actorAllowed} onClick={() => go(2)}>{ct("Continue")}</Button></div>
        </>
        : step === 2 ? <>
            {steps}
            <div><h1>{offering ? ct("Tell people what you do") : ct("Tell people what you need")}</h1><p className="gk-fund-start__lead">{ct("A clear title and a few sentences. The pay and the hours are the facts people look for first.")}</p></div>
            <Field label={ct("Title")} htmlFor="job-title"><input id="job-title" className="gk-input" autoFocus maxLength={120} placeholder={offering ? ct("For example: UEFA B coach available for private sessions") : ct("For example: Goalkeeper coach for my daughter, weekends")} value={draft.title} onChange={event => change({ title: event.target.value })} /></Field>
            <Field label={offering ? ct("About you") : ct("About the role")} htmlFor="job-description" hint={`${draft.description.length}/1200`}><textarea id="job-description" className="gk-input" maxLength={1200} placeholder={offering ? ct("Your experience, who you work with, where and when.") : ct("Who it is for, where and when, what matters to you.")} value={draft.description} onChange={event => change({ description: event.target.value })} /></Field>
            <div className="gk-store-fgroup__pair">
                <Field label={ct("Pay")} htmlFor="job-pay" hint={ct("In words, as you would say it")}><input id="job-pay" className="gk-input" maxLength={40} placeholder={ct("GEL 40 / session")} value={draft.pay} onChange={event => change({ pay: event.target.value })} /></Field>
                <Field label={ct("Terms")} htmlFor="job-terms"><select id="job-terms" className="gk-input" value={draft.terms} onChange={event => change({ terms: event.target.value })}>{TERMS.map(terms => <option key={terms.value} value={terms.value}>{ct(terms.label)}</option>)}</select></Field>
            </div>
            <div className="gk-store-fgroup__pair">
                <Field label={ct("Hours")} htmlFor="job-hours"><select id="job-hours" className="gk-input" value={draft.hours} onChange={event => change({ hours: event.target.value as JobHours | '' })}><option value="">{ct("Not set")}</option>{HOURS.map(hours => <option key={hours.value} value={hours.value}>{ct(hours.label)}</option>)}</select></Field>
                <Field label={ct("Where")} htmlFor="job-city" hint={ct("The town; the exact place comes later")}><input id="job-city" className="gk-input" maxLength={60} value={draft.city} placeholder={city} onChange={event => change({ city: event.target.value })} /></Field>
            </div>
            {draft.category === 'COACHING' && !offering && <Field label={ct("Licence needed")} htmlFor="job-licence" hint={ct("Optional")}><input id="job-licence" className="gk-input" maxLength={60} placeholder={ct("For example: UEFA C")} value={draft.licence} onChange={event => change({ licence: event.target.value })} /></Field>}
            <div className="gk-fund-start__foot"><Button variant="ghost" onClick={() => go(1)}><ArrowLeft aria-hidden="true" />{ct("Back")}</Button><Button variant="primary" disabled={!stepTwoDone || !actorAllowed} onClick={() => go(3)}>{ct("Continue")}</Button></div>
        </>
        : <>
            {steps}
            <div><h1>{ct("How do people reach you?")}</h1><p className="gk-fund-start__lead">{posterKind === 'CLUB' ? applyMethod === 'IN_APP' ? ct("Applications in the app land in your club workspace.") : ct("Where people reach your club about it.") : ct("A message in the app keeps your details private.")}</p></div>
            <div className="gk-fund-start__tiles" role="group" aria-label={ct("How to apply")} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {offered.map(method => <button key={method.value} type="button" className="gk-fund-start__tile" aria-pressed={applyMethod === method.value} onClick={() => change({ applyMethod: method.value })}><strong>{ct(method.label)}</strong><small>{ct(method.line)}</small></button>)}
            </div>
            {needsTarget && <Field label={applyMethod === 'EMAIL' ? ct("Email address") : ct("Link")} htmlFor="job-target" hint={draft.applyTarget && !targetOk ? (applyMethod === 'EMAIL' ? ct("That is not an email address.") : ct("The link must start with https://")) : undefined}><input id="job-target" className="gk-input" type={applyMethod === 'EMAIL' ? 'email' : 'url'} placeholder={applyMethod === 'EMAIL' ? 'jobs@yourclub.ge' : 'https://…'} value={draft.applyTarget} onChange={event => change({ applyTarget: event.target.value })} /></Field>}
            <div className="gk-fund-start__club"><Briefcase aria-hidden="true" style={{ color: 'var(--gk-accent)' }} /><div><strong>{draft.title.trim()}</strong><small>{[ct(CATEGORIES.find(c => c.value === draft.category)?.label), draft.pay.trim() || ct(TERMS.find(t => t.value === draft.terms)?.label), city, posterKind === 'CLUB' ? ct("as {v0}", { v0: club?.clubName }) : ct("as yourself")].filter(Boolean).join(' · ')}</small></div></div>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="gk-fund-start__foot"><Button variant="ghost" disabled={saving} onClick={() => go(2)}><ArrowLeft aria-hidden="true" />{ct("Back")}</Button><Button variant="primary" disabled={saving || !actorAllowed || !stepOneDone || !stepTwoDone || !targetOk} onClick={() => void publish()}>{saving ? ct("Publishing…") : offering ? ct("List myself") : ct("Publish")}</Button></div>
        </>}
        </>;
    return (
        <GkRoot className="gk-store gk-page" data-market="jobs">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/jobs">{ct("Jobs & volunteering")}</Link><span aria-hidden="true">/</span><span>{ct("Post")}</span></nav>
                <div className="gk-fund-start">{body}</div>
            </PageFrame>
        </GkRoot>
    );
};
