import { useEffect, useId, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Check, Loader2, User, Users } from 'lucide-react';
import { Avatar, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorCode, extractApiErrorMessage } from '../../utils/apiError';
import { buildLoginRedirectPath, buildSignupPath } from '../../utils/authRedirect';
import { Crest } from '../world/Crest';
import { fetchJoiningChildren, type JoiningChild } from './api';
import { claimFamilyLink, previewFamilyLink, type FamilyLinkClaimed, type FamilyLinkPreview } from './familyLinks';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import '../pages/pages.css';
import '../pages/links/join.css';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A family link, opened from any chat (owner, 2 November 2026). It shows what it asks before signing in (first names
 * only), brings the person straight back after signing in, and asks one thing: "I'm their parent", or for a club's
 * card the exact birth date (the card may hold only the year), or "This is me" for a player old enough.
 */
export function FamilyLinkPage() {
    const { code = '' } = useParams();
    const location = useLocation();
    const copy = useJourneyCopy();
    const id = useId();
    const { sessionId, isAuthenticated, isBootstrapping } = useAuth();
    const [preview, setPreview] = useState<FamilyLinkPreview | null>(null);
    const [failed, setFailed] = useState(false);
    const [as, setAs] = useState<'PARENT' | 'SELF'>('PARENT');
    const [birthDate, setBirthDate] = useState('');
    const [childId, setChildId] = useState<number | null>(null);
    const [kids, setKids] = useState<JoiningChild[]>([]);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<FamilyLinkClaimed | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        previewFamilyLink(code, controller.signal).then(setPreview).catch(() => { if (!controller.signal.aborted) setFailed(true); });
        return () => controller.abort();
    }, [code]);
    const card = preview?.kind === 'CLUB_CARD';
    useEffect(() => {
        if (!card || !isAuthenticated) return;
        const controller = new AbortController();
        // A child already in the family can be the card's child: the two become one.
        fetchJoiningChildren(sessionId, controller.signal).then(found => setKids(found.children)).catch(() => setKids([]));
        return () => controller.abort();
    }, [card, isAuthenticated, sessionId]);

    const name = preview?.personName ?? '';
    const claim = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            setDone(await claimFamilyLink(code, { as, confirmed: true, childId: as === 'PARENT' ? childId : null, birthDate: card && as === 'PARENT' ? birthDate : null }));
        } catch (failure) {
            const problem = extractApiErrorCode(failure);
            setError(problem === 'FAMILY_LINK_BIRTH_DATE' ? copy('That birth date doesn’t match the club’s card.', 'ეს თარიღი არ ემთხვევა კლუბის ბარათს.')
                : problem === 'FAMILY_LINK_REVOKED' ? copy('This link was turned off. Ask the club for a new one.', 'ეს ბმული გაითიშა. სთხოვეთ კლუბს ახალი.')
                : problem === 'FAMILY_LINK_NOT_YOU' ? copy('This card’s name or birth date doesn’t match your account. Ask the club.', 'ბარათის სახელი ან დაბადების თარიღი არ ემთხვევა თქვენს ანგარიშს. მიმართეთ კლუბს.')
                : problem === 'FAMILY_LINK_OWN' ? copy('Send this link to your parent.', 'ეს ბმული მშობელს გაუგზავნეთ.')
                : problem === 'FAMILY_LINK_STAFF' ? copy('Club staff can’t become a player’s parent through their own club’s card. Add your child in Parent Hub instead.', 'კლუბის თანამშრომელი საკუთარი კლუბის ბარათით მოთამაშის მშობელი ვერ გახდება. შვილი Parent Hub-ში დაამატეთ.')
                : problem === 'GUARDIAN_MUST_BE_ADULT' ? copy('Only adults (18 or older) can be a parent here.', 'აქ მშობელი მხოლოდ სრულწლოვანი (18+) შეიძლება იყოს.')
                : extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };

    const header = preview && (card
        ? <div className="gk-cmatch__page"><Crest src={preview.clubLogoUrl ?? undefined} name={preview.clubName ?? ''} size={44} /><span className="gk-cmatch__text"><strong>{preview.clubName}</strong><small>{copy(`${name}’s player card`, `${name}-ის ბარათი`)}</small></span></div>
        : <div className="gk-cmatch__page"><Avatar name={name} size={44} /><span className="gk-cmatch__text"><strong>{name}</strong>{preview.kind === 'ANOTHER_PARENT' && <small>{copy(`From ${preview.askedBy}`, `${preview.askedBy}-სგან`)}</small>}</span></div>);
    const question = !preview ? '' : preview.kind === 'ADD_PARENT' ? copy(`${name} asks you to be their parent on GrassKickZ`, `${name} გთხოვთ, GrassKickZ-ზე მისი მშობელი იყოთ`)
        : preview.kind === 'ANOTHER_PARENT' ? copy(`${preview.askedBy} asks you to be ${name}’s parent too`, `${preview.askedBy} გთხოვთ, თქვენც იყოთ ${name}-ის მშობელი`)
        : copy(`${preview.clubName} sent ${name}’s card`, `${preview.clubName}-მა გამოგზავნა ${name}-ის ბარათი`);
    const failure = error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>;
    const spinner = busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null;

    const body = failed ? <Panel><EmptyNote title={copy('This link is unavailable.', 'ეს ბმული მიუწვდომელია.')} action={<ButtonLink to="/home">{copy('Go to Home', 'მთავარზე გადასვლა')}</ButtonLink>} /></Panel>
        : !preview || isBootstrapping ? <div className="gk-stack gk-stack--tight" role="status"><Skeleton height={56} /><Skeleton height={44} /></div>
        : done ? <Panel padded><Done done={done} self={as === 'SELF'} /></Panel>
        : preview.state !== 'ACTIVE' ? <Panel padded>{header}<p className="gk-join__lead">{preview.state === 'CLAIMED' ? copy('This link has already been used.', 'ეს ბმული უკვე გამოყენებულია.')
            : preview.state === 'EXPIRED' ? copy(`This link has expired. Ask ${preview.askedBy} for a new one.`, `ბმულს ვადა გაუვიდა. სთხოვეთ ${preview.askedBy}-ს ახალი.`)
            : copy('This link was turned off.', 'ეს ბმული გაითიშა.')}</p></Panel>
        : !isAuthenticated ? <Panel padded>
            {header}
            <h2 className="gk-join__question">{question}</h2>
            <p className="gk-join__lead">{copy('Sign in or create an account. You come straight back here.', 'შედით ან შექმენით ანგარიში. პირდაპირ აქ დაბრუნდებით.')}</p>
            <div className="gk-boxedit__foot">
                <ButtonLink variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{copy('Sign in', 'შესვლა')}</ButtonLink>
                <ButtonLink to={buildSignupPath(`${location.pathname}${location.search}${location.hash}`)}>{copy('Create an account', 'ანგარიშის შექმნა')}</ButtonLink>
            </div>
        </Panel>
        : <Panel padded>
            {header}
            <h2 className="gk-join__question">{question}</h2>
            <div className="gk-boxedit gk-join__form">
                {card && preview.selfPossible && <div className="gk-ctiles gk-ctiles--two" role="group" aria-label={copy('Who are you?', 'ვინ ხართ?')}>
                    <button type="button" className="gk-ctile" aria-pressed={as === 'PARENT'} onClick={() => setAs('PARENT')}><span className="gk-ctile__icon"><Users aria-hidden="true" /></span><span className="gk-ctile__label">{copy(`I’m ${name}’s parent`, `${name}-ის მშობელი ვარ`)}</span></button>
                    <button type="button" className="gk-ctile" aria-pressed={as === 'SELF'} onClick={() => setAs('SELF')}><span className="gk-ctile__icon"><User aria-hidden="true" /></span><span className="gk-ctile__label">{copy('This is me', 'ეს მე ვარ')}</span></button>
                </div>}
                {card && as === 'PARENT' && <>
                    <div><label className="gk-field__label" htmlFor={`${id}-dob`}>{copy(`${name}’s birth date`, `${name}-ის დაბადების თარიღი`)}</label>
                        <input id={`${id}-dob`} className="gk-input gk-join__date" type="date" value={birthDate} max={today()} autoComplete="off" onChange={event => setBirthDate(event.target.value)} /></div>
                    {kids.length > 0 && <div className="gk-ctowns" role="group" aria-label={copy('Already in your family?', 'უკვე თქვენს ოჯახშია?')}>
                        <span className="gk-field__hint">{copy('Already in your family?', 'უკვე თქვენს ოჯახშია?')}</span>
                        {kids.map(kid => <button key={kid.playerId} type="button" className="gk-chip" aria-pressed={childId === kid.playerId} onClick={() => setChildId(current => current === kid.playerId ? null : kid.playerId)}><Avatar name={kid.identity.fullName} size={22} />{kid.identity.fullName.trim().split(/\s+/)[0]}</button>)}
                    </div>}
                </>}
                {as === 'PARENT' && <label className="gk-row gk-join__consent"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{copy(`I’m ${name}’s parent or guardian.`, `${name}-ის მშობელი ან მეურვე ვარ.`)}</span></label>}
                {failure}
                <div className="gk-boxedit__foot">
                    <Button variant="primary" disabled={busy || (as === 'PARENT' && !confirmed) || (card && as === 'PARENT' && !birthDate)} onClick={() => void claim()}>{spinner}{as === 'SELF' ? copy('Yes, this is me', 'დიახ, ეს მე ვარ') : copy('Yes', 'დიახ')}</Button>
                </div>
            </div>
        </Panel>;
    return <GkRoot className="gk-page gk-join"><PageFrame width="profile"><Section title={copy('Family link', 'ოჯახის ბმული')}>{body}</Section></PageFrame></GkRoot>;
}

/** What happened, and the one place to go next. */
function Done({ done, self }: { done: FamilyLinkClaimed; self: boolean }) {
    const copy = useJourneyCopy();
    const name = (done.personName ?? '').trim().split(/\s+/)[0];
    const line = done.outcome === 'LINKED' ? copy(`You’re ${name}’s parent here now.`, `ახლა ${name}-ის მშობელი ხართ აქ.`)
        : done.outcome === 'JOINED' ? copy(`Done. ${name}’s cards are now one, with everything on them.`, `მზადაა. ${name}-ის ბარათები ახლა ერთია, ყველაფრით.`)
        : done.outcome === 'PROPOSED' ? copy(`We asked ${name}’s family to confirm. You’ll get a notice.`, `${name}-ის ოჯახს დადასტურება ვთხოვეთ. შეტყობინებას მიიღებთ.`)
        : copy(`We asked ${name}’s parent to add you. You’ll get a notice.`, `${name}-ის მშობელს ვთხოვეთ, დაგამატოთ. შეტყობინებას მიიღებთ.`);
    const toChild = !self && (done.outcome === 'LINKED' || done.outcome === 'JOINED');
    return <>
        <div className="gk-cmatch__page"><span className="gk-ghost__icon"><Check aria-hidden="true" /></span><span className="gk-cmatch__text"><strong>{line}</strong></span></div>
        <div className="gk-boxedit__foot">
            {toChild ? <ButtonLink variant="primary" to={`/parent?player=${done.personId}`}>{copy('Open Parent Hub', 'Parent Hub-ის გახსნა')}</ButtonLink>
                : <ButtonLink variant="primary" to="/home">{copy('Go to Home', 'მთავარზე გადასვლა')}</ButtonLink>}
        </div>
    </>;
}
