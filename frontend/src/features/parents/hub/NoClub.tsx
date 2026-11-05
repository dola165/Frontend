import { useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Link2, MapPinned } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { formatDate, formatTime } from '../../../utils/formatting';
import { Crest } from '../../world/Crest';
import { FINDER_OPENED } from '../../world/finder/finderContext';
import { fetchJoinLink, sendJoin, type JoinLink, type JoinSent } from '../../pages/api';
import { joinTarget } from '../../actions/flows/joinTarget';
import { useInquiryCopy } from '../../admissions/inquiryPresentation';
import { parentName } from '../../world/finder/waysIn';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { playerPath } from '../playerSelection';
import type { JoiningChild } from '../api';
import type { AdmissionCase } from '../../admissions/types';
import { birthYear, firstName } from './childFacts';
import { childPath } from './childParams';
import { reservedVisit } from './familyEvents';
import './parent-hub.css';

/** A request whose next step is the family's: a place offered, a visit to confirm, a requirement to complete. */
const waitsOnFamily = (c: AdmissionCase) => c.stage !== 'CLOSED' && c.enrollment?.status !== 'CANCELLED' && c.nextAction?.owner === 'APPLICANT';

/**
 * A child with no club yet holds two things: "Find a club near you", which opens World's club map in its pop-up set for
 * the child, and the field for a coach's link or code, which opens that squad's join for the child right here. Anything
 * waiting on the family's answer (a place the club offered) comes first, and finding a club steps back meanwhile. What
 * the family has asked already stays reachable below, each with where it stands.
 */
export function NoClub({ child, onChanged }: { child: JoiningChild; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const first = firstName(child);
    // Always for this child, also when they are the family's only one and the address names nobody yet.
    const find = new URLSearchParams(params);
    find.set('player', String(child.playerId));
    find.set('find', 'club');
    const yours = child.cases.filter(waitsOnFamily);
    return <div className="ph-noclub">
        {yours.length > 0 && <YourAnswer child={child} cases={yours} />}
        <section className="ph-noclub__card" aria-label={copy(`${first} has no club yet`, `${first}-ს კლუბი ჯერ არ ჰყავს`)}>
            <h2>{copy(`${first} has no club yet`, `${first}-ს კლუბი ჯერ არ ჰყავს`)}</h2>
            <ButtonLink variant={yours.length ? 'secondary' : 'primary'} to={`/parent?${find}`} state={FINDER_OPENED} className="ph-noclub__find" data-guide="find-club"><MapPinned aria-hidden="true" />{copy('Find a club near you', 'იპოვეთ კლუბი ახლოს')}</ButtonLink>
            <PasteJoin child={child} onSent={onChanged} />
        </section>
        <Requests child={child} />
        <Link className="ph-details-link" to={childPath(child.playerId, { details: '1' })} data-guide="child-details">
            <span>{copy(`${first}’s details · player card · family`, `${first}-ს მონაცემები · მოთამაშის ბარათი · ოჯახი`)}</span><ChevronRight aria-hidden="true" />
        </Link>
    </div>;
}

/** The coach's link or code, pasted: the squad it joins, then one press to ask for this child. */
function PasteJoin({ child, onSent }: { child: JoiningChild; onSent: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const id = useId();
    const first = firstName(child);
    const [value, setValue] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [link, setLink] = useState<{ code: string; data: JoinLink } | null>(null), [sent, setSent] = useState<JoinSent | null>(null);
    const request = useRef<{ code: string; id: string } | null>(null);
    const open = async () => {
        const target = joinTarget(value);
        if (!target) { setError(copy('That isn’t a join link or code. Copy it again from the coach.', 'ეს არ არის შესვლის ბმული ან კოდი. ხელახლა დააკოპირეთ მწვრთნელისგან.')); return; }
        if (!target.startsWith('/join/')) { navigate(target); return; }
        const code = target.slice('/join/'.length);
        setBusy(true); setError('');
        try { setLink({ code, data: await fetchJoinLink(code) }); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('This link doesn’t work any more. Ask the coach for a new one.', 'ეს ბმული აღარ მუშაობს. სთხოვეთ მწვრთნელს ახალი.'))); }
        finally { setBusy(false); }
    };
    const ask = async () => {
        if (!link || busy || !child.identity.dateOfBirth) return;
        if (request.current?.code !== link.code) request.current = { code: link.code, id: crypto.randomUUID() };
        setBusy(true); setError('');
        try { setSent(await sendJoin(link.code, { requestId: request.current.id, who: 'PARENT', playerId: child.playerId, consent: true })); onSent(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Couldn’t send · Try again', 'ვერ გაიგზავნა · სცადეთ ხელახლა'))); }
        finally { setBusy(false); }
    };
    if (sent) return <div className="ph-join ph-join--sent" role="status">
        <Check aria-hidden="true" /><span><strong>{copy(`Sent. ${sent.coachName ?? 'The coach'} answers ${first} here.`, `გაიგზავნა. ${sent.coachName ?? 'მწვრთნელი'} აქ უპასუხებს ${first}-ს.`)}</strong>
            {sent.nextTraining && <small>{copy('Next training', 'შემდეგი ვარჯიში')}: {formatDate(sent.nextTraining.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}, {formatTime(sent.nextTraining.startsAt)}</small>}</span>
    </div>;
    if (link) return <div className="ph-join" data-guide="join-in-place">
        <Crest src={link.data.page.crestUrl} name={link.data.page.name} size={36} />
        <span className="ph-join__what"><strong>{link.data.squad.name}</strong><small>{link.data.page.name}{link.data.page.town ? ` · ${link.data.page.town}` : ''}</small></span>
        <Button variant="primary" size="sm" disabled={busy || !child.identity.dateOfBirth} onClick={() => void ask()}>{copy(`Ask to join for ${first}`, `${first}-სთვის მოთხოვნა`)}</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setLink(null); setError(''); }}>{copy('Not this one', 'ეს არა')}</Button>
        {!child.identity.dateOfBirth && <p className="ph-quiet">{copy(`Add ${first}’s birth date in the details first.`, `ჯერ დაამატეთ ${first}-ს დაბადების თარიღი.`)}</p>}
        {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
    </div>;
    return <form className="ph-paste" onSubmit={event => { event.preventDefault(); void open(); }} data-guide="paste-code">
        <label className="ph-paste__label" htmlFor={`${id}-code`}><Link2 aria-hidden="true" />{copy('Got a link or code from a coach? Paste it here', 'მწვრთნელმა ბმული ან კოდი გამოგიგზავნათ? ჩასვით აქ')}</label>
        <div className="ph-paste__row">
            <input id={`${id}-code`} className="gk-input" autoComplete="off" spellCheck={false} value={value} maxLength={300} placeholder="grasskickz.com/join/…"
                aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setValue(event.target.value); setError(''); }} />
            <Button type="submit" disabled={busy || !value.trim()}>{copy('Open', 'გახსნა')}<ArrowRight aria-hidden="true" /></Button>
        </div>
        {error && <p id={`${id}-error`} className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        {birthYear(child) == null && <p className="ph-quiet">{copy('Clubs ask for a birth year: add it in the details.', 'კლუბები დაბადების წელს გკითხავენ: დაამატეთ მონაცემებში.')}</p>}
    </form>;
}

/** What waits on the family's answer, first and bright: the club, the group, where it stands and one way to answer. */
function YourAnswer({ child, cases }: { child: JoiningChild; cases: AdmissionCase[] }) {
    const copy = useJourneyCopy();
    const { stage } = useAdmissionCopy();
    return <section className="ph-requests ph-requests--yours" aria-label={copy('Waiting for your answer', 'გელოდებათ თქვენი პასუხი')}>
        <h2 className="ph-eyebrow">{copy('Waiting for your answer', 'გელოდებათ თქვენი პასუხი')}</h2>
        <ul className="ph-rows">{cases.map(c => <li key={c.id}><div className="ph-row">
            <span className="ph-dot ph-dot--decide" aria-hidden="true" />
            <span className="ph-row__text"><strong>{c.organizationName} · {parentName(c.groupName) ?? c.groupName}</strong><small>{stage(c.stage)}</small></span>
            <ButtonLink size="sm" variant="primary" to={playerPath(`/admissions/cases/${c.id}${c.stage === 'PLACE_OFFERED' ? '?tab=agreement' : ''}`, child.playerId)}>{copy('Answer', 'პასუხი')}<ArrowRight aria-hidden="true" /></ButtonLink>
        </div></li>)}</ul>
    </section>;
}

const when = (iso: string) => `${formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(iso)}`;

/**
 * What the family asked clubs already, each with where it stands (a visit waiting for the club's checks says it is
 * reserved); the request's own page holds the rest. With a visit planned, the child's calendar is one press away.
 */
function Requests({ child }: { child: JoiningChild }) {
    const copy = useJourneyCopy();
    const { stage } = useAdmissionCopy();
    const inquiryCopy = useInquiryCopy();
    const cases = child.cases.filter(c => c.stage !== 'CLOSED' && c.enrollment?.status !== 'CANCELLED' && !waitsOnFamily(c));
    const enquiries = child.inquiries.filter(i => !i.caseId && ['OPEN', 'ROUTED'].includes(i.status));
    if (!cases.length && !enquiries.length) return null;
    const planned = cases.some(c => c.sessions.some(p => ['CONFIRMED', 'RECONFIRM_REQUIRED', 'INVITED'].includes(p.status) && Date.parse(p.endsAt) > Date.now()));
    return <section className="ph-requests" aria-label={copy('Asked so far', 'აქამდე მოთხოვნილი')}>
        <h2 className="ph-eyebrow">{copy('Asked so far', 'აქამდე მოთხოვნილი')}
            {planned && <Link className="gk-section__action ph-requests__calendar" to={childPath(child.playerId, { view: 'calendar' })}>{copy('Calendar ›', 'კალენდარი ›')}</Link>}</h2>
        <ul className="ph-rows">
            {cases.map(c => {
                const visit = c.sessions.find(p => ['CONFIRMED', 'RECONFIRM_REQUIRED', 'INVITED'].includes(p.status) && Date.parse(p.endsAt) > Date.now());
                return <li key={c.id}><Link className="ph-row" to={playerPath(`/admissions/cases/${c.id}`, child.playerId)}>
                    <span className={`ph-dot${visit ? ' ph-dot--visit' : ''}`} aria-hidden="true" />
                    <span className="ph-row__text"><strong>{c.organizationName} · {parentName(c.groupName) ?? c.groupName}</strong>
                        <small>{!visit ? stage(c.stage) : reservedVisit(visit)
                            ? copy(`Reserved · first visit ${when(visit.startsAt)} · the club confirms after its checks`, `დაჯავშნილია წინასწარ · პირველი ვიზიტი ${when(visit.startsAt)} · კლუბი დაადასტურებს შემოწმების შემდეგ`)
                            : copy(`First visit ${when(visit.startsAt)}`, `პირველი ვიზიტი ${when(visit.startsAt)}`)}</small></span>
                    <ArrowRight aria-hidden="true" />
                </Link></li>;
            })}
            {enquiries.map(i => <li key={i.id}><Link className="ph-row" to={playerPath(i.applicantDestination || `/admissions/inquiries/${i.id}`, child.playerId)}>
                <span className="ph-dot" aria-hidden="true" />
                <span className="ph-row__text"><strong>{i.organizationName}</strong><small>{inquiryCopy.status(i)}</small></span>
                <ArrowRight aria-hidden="true" />
            </Link></li>)}
        </ul>
    </section>;
}
