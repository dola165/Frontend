import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, MapPin, Plus, Wallet } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Avatar, Button, ButtonLink, GkRoot, PageFrame, Skeleton } from '../../../design/primitives';
import { buildLoginPath } from '../../../utils/authRedirect';
import { fetchAdmissionHome, fetchOpportunity, submitAdmission } from '../api';
import type { Opportunity, Participant, Submission } from '../types';
import { AddChild } from '../../parents/AddChild';
import { useAdmissionData } from './useAdmissionData';
import { useAdmissionMutation } from './useAdmissionMutation';
import { AdmissionError } from './AdmissionFrame';
import { TermsFacts } from './OpportunityFacts';
import { termsComplete } from './termsComplete';
import { useAdmissionCopy } from './copy';
import { PlayerCardEditor } from './PlayerCardEditor';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';
import './joining.css';

const bornIn = (p: Participant) => Number(p.dateOfBirth?.slice(0, 4));
const fitsAge = (o: Opportunity, p: Participant) => bornIn(p) >= o.birthYearFrom && bornIn(p) <= o.birthYearTo;
const fitsGender = (o: Opportunity, p: Participant) => o.gender === 'ANY' || o.gender === p.gender;

export function OpportunityDetailPage() {
    const { opportunityId } = useParams(); const { user, sessionId } = useAuth();
    return <OpportunityDetailContent key={`${opportunityId}:${user?.id}:${sessionId}`} id={Number(opportunityId)} />;
}

/**
 * Joining a group, child first (F33): who is joining (faces, or the child's name and birth date when there is no
 * child yet), then one line of when · where · cost, then the request with the consent beside the button it governs.
 * The full terms fold away. The page keeps its form while the group refreshes, so a failed send keeps its
 * explanation and the answers (F05).
 */
function OpportunityDetailContent({ id }: { id: number }) {
    const { isAuthenticated, sessionId, user } = useAuth(); const { copy, availability } = useAdmissionCopy();
    const [params] = useSearchParams();
    const { requestedPlayerId, selectPlayer } = usePlayerSelection();
    const opportunity = useAdmissionData(useCallback(signal => fetchOpportunity(id, signal), [id]));
    const home = useAdmissionData(useCallback(signal => isAuthenticated ? fetchAdmissionHome(sessionId, signal) : Promise.resolve({ participants: [], cases: [] }), [isAuthenticated, sessionId]), isAuthenticated ? sessionId : undefined);
    const [adding, setAdding] = useState(false);
    const o = opportunity.data;
    const all = home.error ? [] : home.data?.participants ?? [];
    // Children first; the adult themself only where the group's ages fit them.
    const people = o ? all.filter(p => p.minor || p.id !== user?.id || !p.dateOfBirth || fitsAge(o, p) || p.id === requestedPlayerId) : [];
    const player = all.find(p => p.id === requestedPlayerId);
    const existing = player && o ? home.data?.cases.find(c => c.playerId === player.id && c.organizationId === o.organizationId && c.intake === o.intake && c.stage !== 'CLOSED' && c.enrollment?.status !== 'CANCELLED') : undefined;
    if (!o) return <JoinFrame>{opportunity.error ? <AdmissionError message={opportunity.error} retry={opportunity.refresh} /> : <div className="jn-stack" role="status"><Skeleton height={64} /><Skeleton height={56} /><Skeleton height={120} /></div>}</JoinFrame>;
    const fee = o.terms.charges[0];
    const cost = !o.terms.feesKnown ? copy('Price to be confirmed', 'ფასი დასაზუსტებელია') : fee ? `${fee.amount} ${fee.currency} · ${fee.frequency}` : copy('Free', 'უფასო');
    return <JoinFrame>
        <header className="jn-head">
            <h1>{o.name}</h1>
            <p>{o.organizationName} · {copy('born', 'დაბ.')} {o.birthYearFrom}–{o.birthYearTo} · <span className="jn-availability" data-open={o.availability !== 'CLOSED' && o.availability !== 'WAITLIST'}>{availability(o.availability)}</span></p>
            <ul className="jn-facts">
                <li><Clock3 aria-hidden="true" />{o.schedule || copy('Arrange with the club', 'შეათანხმეთ კლუბთან')}</li>
                <li><MapPin aria-hidden="true" />{o.location.latitude != null && o.location.longitude != null ? <Link to={`/world?opportunity=${o.id}${player ? `&player=${player.id}` : ''}`} aria-label={copy('View actual training venue on map', 'ვარჯიშის რეალური ადგილის ნახვა რუკაზე')}>{o.location.name}</Link> : o.location.name}</li>
                <li><Wallet aria-hidden="true" />{cost}</li>
            </ul>
        </header>
        {!isAuthenticated ? <section className="jn-box"><h2>{copy('Who is joining?', 'ვინ უერთდება?')}</h2><p className="jn-quiet">{copy('Sign in to choose your child. This group stays ready for you.', 'შედით ბავშვის ასარჩევად. ჯგუფი შენარჩუნდება.')}</p>
            <ButtonLink variant="primary" to={buildLoginPath(`/admissions/opportunities/${id}${params.size ? `?${params}` : ''}`)}>{copy('Sign in to continue', 'შესვლა გასაგრძელებლად')}</ButtonLink></section>
        : <section className="jn-box" aria-labelledby="jn-who">
            <h2 id="jn-who">{copy('Who is joining?', 'ვინ უერთდება?')}</h2>
            {home.loading && !home.data ? <Skeleton height={56} /> : home.error ? <AdmissionError message={home.error} retry={home.refresh} /> : <>
                {people.length > 0 && <div className="jn-who" role="radiogroup" aria-label={copy('Player card', 'მოთამაშის ბარათი')}>
                    {people.map(p => { const fits = fitsAge(o, p) && fitsGender(o, p); return <button key={p.id} type="button" role="radio" aria-checked={p.id === player?.id} aria-label={`${p.name}, ${!p.dateOfBirth ? copy('Basic details needed', 'საჭიროა ძირითადი მონაცემები') : fits ? copy('Fits this group', 'ჯგუფს შეესაბამება') : `${copy('Born', 'დაბ.')} ${bornIn(p)}`}`} className="jn-who__person" data-fits={fits || undefined} onClick={() => { setAdding(false); selectPlayer(p.id); }}>
                        <Avatar name={p.name} size={36} /><span><strong>{p.name}</strong><small>{!p.dateOfBirth ? copy('Basic details needed', 'საჭიროა ძირითადი მონაცემები') : fits ? <><Check aria-hidden="true" />{copy('Fits this group', 'ჯგუფს შეესაბამება')}</> : `${copy('Born', 'დაბ.')} ${bornIn(p)}`}</small></span>
                    </button>; })}
                    <button type="button" className="jn-who__add" aria-expanded={adding} onClick={() => setAdding(v => !v)}><Plus aria-hidden="true" />{copy('New child', 'ახალი ბავშვი')}</button>
                </div>}
                {(adding || people.length === 0) && <AddChild inline onCreated={childId => { setAdding(false); home.refresh(); selectPlayer(childId); }} />}
            </>}
        </section>}
        {isAuthenticated && player && (existing ? <section className="jn-box"><h2>{copy('Continue your joining arrangement', 'გააგრძელეთ არსებული შეთანხმება')}</h2>
                <p className="jn-quiet">{copy(`${player.name} already has an arrangement for ${existing.groupName}.`, `${player.name} — არსებული შეთანხმება: ${existing.groupName}.`)}</p>
                <ButtonLink variant="primary" to={playerPath(`/admissions/cases/${existing.id}`, player.id)}>{copy('Open current arrangement', 'მიმდინარე შეთანხმების გახსნა')}</ButtonLink></section>
            : player.dateOfBirth ? <SubmissionForm key={player.id} opportunity={o} participant={player} refresh={opportunity.refresh} />
            : null)}
        {isAuthenticated && (home.data?.selfCardNeedsDetails || (player && (!player.dateOfBirth || (o.gender !== 'ANY' && !player.gender)))) && <details className="jn-box jn-fold" open>
            <summary>{copy('Review player details', 'მოთამაშის მონაცემების განხილვა')}</summary>
            {home.data?.selfCardNeedsDetails && user?.id && <PlayerCardEditor playerId={user.id} initialName={user.fullName || user.username || ''} onChanged={() => { home.refresh(); selectPlayer(user.id); }} />}
            {player && !(player.id === user?.id && home.data?.selfCardNeedsDetails) && <PlayerCardEditor key={`card:${player.id}`} playerId={player.id} participant={player} onChanged={home.refresh} />}
        </details>}
        <details className="jn-box jn-fold"><summary>{copy('Full terms', 'სრული პირობები')}</summary><TermsFacts terms={o.terms} /></details>
        <p className="jn-links"><Link to={playerPath(`/admissions/organizations/${o.organizationId}/inquire?group=${o.id}`, player?.id)}>{copy('Ask this organization to recommend a group', 'სთხოვეთ ორგანიზაციას ჯგუფის რეკომენდაცია')}</Link></p>
    </JoinFrame>;
}

function JoinFrame({ children }: { children: ReactNode }) {
    const { copy } = useAdmissionCopy();
    const navigate = useNavigate();
    return <GkRoot className="gk-page jn"><PageFrame width="profile">
        <button type="button" className="jn-back" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/world/opportunities?tab=groups')}><ArrowLeft aria-hidden="true" />{copy('Back', 'უკან')}</button>
        <div className="jn-stack">{children}</div>
    </PageFrame></GkRoot>;
}

type FormDraft = { message: string; siblingConstraint: string; emergencyContact: string };
function SubmissionForm({ opportunity: o, participant: p, refresh }: { opportunity: Opportunity; participant: Participant; refresh: () => void }) {
    const { user, sessionId } = useAuth(); const navigate = useNavigate(); const { copy } = useAdmissionCopy();
    const key = `admission-form:${user?.id}:${sessionId}:${o.id}:${p.id}`;
    const [draft, setDraft] = useState<FormDraft>(() => { try { return JSON.parse(sessionStorage.getItem(key) || 'null') || { message: '', siblingConstraint: '', emergencyContact: '' }; } catch { return { message: '', siblingConstraint: '', emergencyContact: '' }; } });
    const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null);
    const accept = acceptedVersion === o.version;
    useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* The mutation still requires a durable receipt before sending. */ } }, [draft, key]);
    const mutation = useAdmissionMutation<Omit<Submission, 'requestId'>, Awaited<ReturnType<typeof submitAdmission>>>(p.id, `submit:${o.id}`, body => submitAdmission(body, sessionId), result => { sessionStorage.removeItem(key); navigate(`/admissions/cases/${result.id}`); }, refresh);
    const birthYearEligible = fitsAge(o, p);
    const eligible = birthYearEligible && fitsGender(o, p);
    const canCommit = (!p.minor || p.guardian) && p.restriction !== 'REVIEW';
    const familyReview = o.method === 'DIRECT' && Boolean(draft.siblingConstraint.trim());
    const direct = o.method === 'DIRECT' && o.availability === 'PLACES_AVAILABLE' && !familyReview;
    const waitlist = o.availability === 'WAITLIST';
    const active = o.intakeOpen && o.availability !== 'CLOSED';
    const needEmergency = direct && o.terms.requirements.includes('EMERGENCY_CONTACT');
    const label = waitlist ? copy('Join waiting list', 'მოლოდინის სიაში ჩაწერა') : familyReview ? copy('Request staff review', 'თანამშრომლის განხილვის მოთხოვნა') : direct ? copy('Confirm enrollment', 'ჩარიცხვის დადასტურება') : o.method === 'SELECTIVE' ? copy('Send application', 'განაცხადის გაგზავნა') : copy('Request an introduction', 'გაცნობითი ვარჯიშის მოთხოვნა');
    const submit = () => mutation.run({ opportunityId: o.id, opportunityVersion: o.version, playerId: p.id, intent: waitlist ? 'WAITLIST' : direct ? 'DIRECT_ENROLL' : 'REQUEST', message: [draft.message.trim(), draft.siblingConstraint.trim() ? `${copy('Family timing / sibling condition', 'ოჯახის დროის / და-ძმის პირობა')}: ${draft.siblingConstraint.trim()}` : ''].filter(Boolean).join('\n') || undefined, siblingConstraint: draft.siblingConstraint.trim() || undefined, emergencyContact: draft.emergencyContact.trim() || undefined, ...(direct ? { acceptTerms: accept } : {}) });
    const first = p.name.split(' ')[0];
    return <form className="jn-box jn-form" onSubmit={e => { e.preventDefault(); void submit(); }} aria-busy={mutation.busy}>
        <h2>{label}</h2>
        {o.gender !== 'ANY' && !p.gender && <p className="jn-notice">{copy('This group uses a gender category. Add your declared gender in the reusable player card below, or ask the organization for group guidance.', 'ამ ჯგუფს სქესის კატეგორია აქვს. ქვემოთ, მოთამაშის მრავალჯერად ბარათში, მიუთითეთ თქვენი სქესი ან სთხოვეთ ორგანიზაციას ჯგუფის შერჩევაში რჩევა.')}</p>}
        {o.gender !== 'ANY' && p.gender && o.gender !== p.gender && <p className="jn-notice" role="status">{copy('The selected player does not match this group’s published gender category. Choose a suitable group or ask the organization to recommend one.', 'არჩეული მოთამაშე ამ ჯგუფის გამოქვეყნებულ სქესის კატეგორიას არ შეესაბამება. აირჩიეთ შესაფერისი ჯგუფი ან სთხოვეთ ორგანიზაციას რეკომენდაცია.')}</p>}
        {!birthYearEligible && <p className="jn-notice">{copy('This birth year is outside the published range. Choose a suitable group or ask the club to recommend one.', 'დაბადების წელი გამოქვეყნებულ დიაპაზონს არ შეესაბამება. აირჩიეთ შესაფერისი ჯგუფი ან რჩევისთვის მიმართეთ კლუბს.')}</p>}
        {!canCommit && <p className="jn-notice">{copy('A current guardian must confirm participation and enrollment. You can still express interest.', 'მონაწილეობა და ჩარიცხვა მოქმედმა მეურვემ უნდა დაადასტუროს. ინტერესის გამოხატვა კვლავ შეგიძლიათ.')}</p>}
        <label className="gk-field"><span className="gk-field__label">{copy(`Anything the coach should know about ${first}? (optional)`, `რა უნდა იცოდეს მწვრთნელმა ${first}-ზე? (არასავალდებულო)`)}</span><textarea className="gk-input" rows={3} maxLength={2000} disabled={Boolean(mutation.pending)} value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} /></label>
        {p.minor && <details className="jn-more" open={Boolean(draft.siblingConstraint)}><summary>{copy('Joining with a brother or sister?', 'და-ძმასთან ერთად უერთდება?')}</summary>
            <label className="gk-field" htmlFor={`admission-sibling-${p.id}`}><span className="gk-field__label">{copy('Sibling or timing request (optional)', 'და-ძმის ან დროის მოთხოვნა (არასავალდებულო)')}</span><textarea id={`admission-sibling-${p.id}`} className="gk-input" rows={2} aria-describedby={`admission-sibling-help-${p.id}`} maxLength={1000} disabled={Boolean(mutation.pending)} value={draft.siblingConstraint} onChange={e => setDraft({ ...draft, siblingConstraint: e.target.value })} /></label>
            <p id={`admission-sibling-help-${p.id}`} className="jn-quiet">{copy('Staff will review it. This does not reserve or accept another child’s place.', 'თანამშრომელი განიხილავს. სხვა ბავშვის ადგილი არ ჯავშნდება და არ დასტურდება.')}</p></details>}
        {familyReview && <p className="jn-notice">{copy('Your family condition needs staff review. This sends a request and does not immediately enroll this child.', 'ოჯახის პირობას თანამშრომელი უნდა გაეცნოს. იგზავნება მოთხოვნა; ბავშვი დაუყოვნებლივ არ ირიცხება.')}</p>}
        {needEmergency && <label className="gk-field"><span className="gk-field__label">{copy('Emergency contact: name and phone', 'გადაუდებელი საკონტაქტო პირი: სახელი და ტელეფონი')}</span><input className="gk-input" required maxLength={500} disabled={Boolean(mutation.pending)} value={draft.emergencyContact} onChange={e => setDraft({ ...draft, emergencyContact: e.target.value })} /></label>}
        {/* The consent sits right above the button it governs, and only where the button commits a place. */}
        {direct && <><label className="jn-check"><input type="checkbox" required checked={accept} disabled={Boolean(mutation.pending)} onChange={e => setAcceptedVersion(e.target.checked ? o.version : null)} />{copy(`I confirm these terms for ${p.name}.`, `ვადასტურებ ამ პირობებს: ${p.name}.`)}</label>
            {!termsComplete(o.terms, o.schedule, o.location) && <p className="jn-notice">{copy('The club must complete essential terms before a place can be confirmed.', 'ადგილის დასადასტურებლად კლუბმა არსებითი პირობები უნდა შეავსოს.')}</p>}</>}
        {mutation.error && <AdmissionError message={mutation.error} />}
        {mutation.pending ? <div className="jn-stack"><p className="jn-quiet">{copy('A saved request has an unconfirmed response. Retry it with the original details.', 'შენახული მოთხოვნის პასუხი დაუდასტურებელია. გაიმეორეთ საწყისი მონაცემებით.')}</p><Button variant="primary" disabled={mutation.busy} onClick={() => void mutation.retry()}>{copy('Retry saved request', 'შენახული მოთხოვნის გამეორება')}</Button></div>
            : <Button type="submit" variant="primary" disabled={mutation.busy || !eligible || !active || (direct && (!canCommit || !accept || !termsComplete(o.terms, o.schedule, o.location)))}>{mutation.busy ? copy('Sending…', 'იგზავნება…') : label}</Button>}
        <p className="jn-quiet">{!active ? copy('This intake is closed. Existing arrangements remain in My requests.', 'მიღება დახურულია. არსებული შეთანხმებები იხილეთ „ჩემი მოთხოვნები“-ში.')
            : direct ? copy('This applies only to the selected player.', 'ეს მხოლოდ არჩეულ მოთამაშეს ეხება.')
            : waitlist ? copy('A waiting-list request promises no immediate place.', 'მოლოდინის მოთხოვნა დაუყოვნებლივ ადგილს არ გპირდებათ.')
            : copy('The coach answers. Nothing is confirmed until they do.', 'მწვრთნელი გიპასუხებთ. მანამდე არაფერი დასტურდება.')}</p>
    </form>;
}
