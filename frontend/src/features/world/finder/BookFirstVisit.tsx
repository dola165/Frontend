import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Avatar, Button, Chip, LoadFailed, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorCode, extractApiErrorMessage } from '../../../utils/apiError';
import { formatDate, formatTime } from '../../../utils/formatting';
import { bookFirstVisit, fetchFirstVisits, savePlayerIdentity } from '../../admissions/api';
import type { AdmissionCase, FirstVisitSession, FirstVisitSessions, Opportunity } from '../../admissions/types';
import type { JoiningChild } from '../../joining-contract/types';
import { AddChild } from '../../parents/AddChild';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useWorldChild } from '../players';
import { useWorldData } from '../useWorldData';
import { useFinder } from './finderContext';
import { bornLabel, visitChanges, type SeenVisit } from './waysIn';

const when = (iso: string) => `${formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(iso)}`;
/** The next trainings shown at first (about two weeks); "More dates" shows the rest of the four weeks. */
const SHOWN = 6;
type Gender = 'MALE' | 'FEMALE';
const bornIn = (child: JoiningChild) => child.identity.dateOfBirth ? Number(child.identity.dateOfBirth.slice(0, 4)) : null;

/**
 * Book a first visit, inside the open club: the group's next trainings with a place, the child (the finder's, another
 * of the family's who fits, or a new card), and one press. It is confirmed at once and lands in the family's week; where
 * the group needs the current club's permission first it is reserved until the club records it. Only what is missing is
 * asked: a new child's name and birth date, whether a child with none declared is a boy or a girl (for a boys' or girls'
 * group, saved on their card), and a phone when the parent's profile has none. The booking carries the terms and the
 * training the family saw: when the club changed either meanwhile, nothing is booked and what changed is shown first.
 */
export function BookFirstVisit({ group, onClose }: { group: Opportunity; onClose: () => void }) {
    const copy = useJourneyCopy();
    const { sessionId } = useAuth();
    const finder = useFinder();
    const { child: worldChild } = useWorldChild();
    const id = useId();
    const sessions = useWorldData(`first-visits:${sessionId}:${group.id}`, signal => fetchFirstVisits(group.id, sessionId, signal));
    // A child the group's ages take: of the group's gender, or with none declared yet (asked below, never guessed).
    const fits = (finder?.family ?? []).filter(child => {
        const year = bornIn(child);
        return year != null && year >= group.birthYearFrom && year <= group.birthYearTo && (group.gender === 'ANY' || child.identity.gender == null || child.identity.gender === group.gender);
    });
    const [playerId, setPlayerId] = useState<number | null>(() => fits.find(child => child.playerId === worldChild?.id)?.playerId ?? (fits.length === 1 ? fits[0].playerId : null));
    const [adding, setAdding] = useState(false);
    const [reference, setReference] = useState<string | null>(null), [allDates, setAllDates] = useState(false);
    const [phone, setPhone] = useState(''), [needsPhone, setNeedsPhone] = useState(false);
    const [declared, setDeclared] = useState<{ playerId: number; gender: Gender } | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [booked, setBooked] = useState<AdmissionCase | null>(null);
    const [changed, setChanged] = useState<SeenVisit | null>(null);
    const request = useRef<{ key: string; id: string } | null>(null), identityRequest = useRef<{ key: string; id: string } | null>(null);
    const data = sessions.data;
    const chosen = data?.sessions.find(item => item.reference === reference) ?? data?.sessions[0];
    const child = fits.find(item => item.playerId === playerId);
    const first = child?.identity.fullName.split(' ')[0];
    const undeclared = child != null && group.gender !== 'ANY' && child.identity.gender == null;
    const declaration = declared?.playerId === playerId ? declared.gender : null;
    const cost = data?.fee ? `${data.fee} ${data.currency ?? ''}`.trim() : copy('Free', 'უფასო');
    /** The missing declaration, through the card's own versioned update; whether the child now fits the group. */
    const declare = async (target: JoiningChild, gender: Gender) => {
        const identity = target.identity, key = `${target.playerId}:${identity.version}:${gender}`;
        if (identityRequest.current?.key !== key) identityRequest.current = { key, id: crypto.randomUUID() };
        const saved = await savePlayerIdentity(target.playerId, { requestId: identityRequest.current.id, expectedVersion: identity.version, fullName: identity.fullName, dateOfBirth: identity.dateOfBirth,
            gender, photoUrl: identity.photoUrl, positions: identity.positions, dominantFoot: identity.dominantFoot, heightCm: identity.heightCm, weightKg: identity.weightKg }, sessionId);
        finder?.changed();
        if (saved.gender === group.gender) return true;
        setError(group.gender === 'MALE' ? copy('This group is for boys.', 'ეს ჯგუფი ბიჭებისთვისაა.') : copy('This group is for girls.', 'ეს ჯგუფი გოგოებისთვისაა.'));
        return false;
    };
    const book = async (offer: FirstVisitSessions, session: FirstVisitSession) => {
        if (!child || busy || (undeclared && !declaration)) return;
        setBusy(true); setError(''); setChanged(null);
        try {
            if (undeclared && !await declare(child, declaration!)) return;
            const contact = needsPhone ? phone.trim() : '';
            const key = JSON.stringify([group.id, offer.groupVersion, session.reference, session.startsAt, session.endsAt, session.place, child.playerId, contact]);
            if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
            const result = await bookFirstVisit(group.id, { requestId: request.current.id, playerId: child.playerId, session: session.reference, groupVersion: offer.groupVersion,
                startsAt: session.startsAt, endsAt: session.endsAt, place: session.place, ...(contact ? { phone: contact } : {}) }, sessionId);
            setBooked(result); finder?.changed();
        } catch (failure) {
            const code = extractApiErrorCode(failure);
            if (code === 'TERMS_CHANGED' || code === 'SESSION_CHANGED' || code === 'SESSION_UNAVAILABLE') { setChanged({ fee: offer.fee, currency: offer.currency, places: offer.places, session }); sessions.retry(); }
            else if (code === 'PHONE_NEEDED') { setNeedsPhone(true); setError(copy('Add a phone number the coach can call during the visit.', 'დაამატეთ ტელეფონი, რომელზეც მწვრთნელი ვიზიტისას დაგირეკავთ.')); }
            else if (code === 'SESSION_FULL') { setError(copy('That training just filled up. Choose another one.', 'ეს ვარჯიში ახლახან შეივსო. აირჩიეთ სხვა.')); sessions.retry(); }
            else if (code === 'FIRST_VISIT_BOOKED') setError(copy(`${first ?? 'Your child'} already has a first visit booked here.`, `${first ?? 'ბავშვს'} აქ უკვე აქვს ვიზიტი დაჯავშნილი.`));
            else if (code === 'STALE_VERSION') { setError(copy(`${first ?? 'Your child'}’s card just changed. Check it and book again.`, `${first ? `${first}-ს` : 'ბავშვის'} ბარათი შეიცვალა. შეამოწმეთ და ხელახლა დაჯავშნეთ.`)); finder?.changed(); }
            else setError(extractApiErrorMessage(failure, copy('Couldn’t book · Try again', 'ვერ დაიჯავშნა · სცადეთ ხელახლა')));
        } finally { setBusy(false); }
    };
    if (booked) {
        const visit = booked.sessions.find(item => chosen && Date.parse(item.startsAt) === Date.parse(chosen.startsAt)) ?? booked.sessions[0];
        // Waiting for the current club's permission: reserved, and the club confirms it (the coordinator's words).
        const reserved = visit?.status === 'INVITED';
        return <div className="gk-finder-done" role="status">
            <Check aria-hidden="true" /><span><strong>{reserved ? copy('Reserved', 'დაჯავშნილია წინასწარ') : copy('Booked', 'დაჯავშნილია')}{visit ? ` · ${when(visit.startsAt)}` : ''}</strong>
                <small>{[reserved ? copy('The club confirms after its checks', 'კლუბი დაადასტურებს შემოწმების შემდეგ') : null, visit?.location.name, visit?.cost, copy(`It’s in ${booked.playerName.split(' ')[0]}’s week.`, `${booked.playerName.split(' ')[0]}-ს კვირაშია.`)].filter(Boolean).join(' · ')}</small>
                <Link className="gk-section__action" to={`/admissions/cases/${booked.id}?player=${booked.playerId}`}>{copy('See the booking', 'ჯავშნის ნახვა')}</Link></span>
        </div>;
    }
    const lines = changed && data ? visitChanges(copy, changed, data, when) : [];
    return <form className="gk-finder-book" onSubmit={event => { event.preventDefault(); if (data && chosen) void book(data, chosen); }} data-guide="book-form">
        <p className="gk-finder-book__lead">{copy(`First visit · ${cost} · at most ${data?.places ?? 3} a session`, `პირველი ვიზიტი · ${cost} · მაქსიმუმ ${data?.places ?? 3} ერთ ვარჯიშზე`)}</p>
        {sessions.loading ? <Skeleton height={40} />
            : sessions.error ? <LoadFailed text={copy('Couldn’t load the trainings', 'ვარჯიშები ვერ ჩაიტვირთა')} retry={copy('Try again', 'ხელახლა ცდა')} onRetry={sessions.retry} />
            : !data?.sessions.length ? <p className="gk-faint">{data?.addChildFirst ? copy('Add your child to see the trainings.', 'ვარჯიშების სანახავად დაამატეთ ბავშვი.') : copy('No first visits in the next four weeks. Ask the club instead.', 'მომდევნო ოთხ კვირაში ვიზიტი არ არის. ჰკითხეთ კლუბს.')}</p>
            : <div className="gk-chips" role="radiogroup" aria-label={copy('Choose a training', 'აირჩიეთ ვარჯიში')}>
                {data.sessions.slice(0, allDates ? undefined : SHOWN).map(item => <Chip key={item.reference} pressed={chosen?.reference === item.reference} onClick={() => { setReference(item.reference); setChanged(null); }}>
                    {when(item.startsAt)}<span className="gk-faint"> · {item.placesLeft === 1 ? copy('1 place', '1 ადგილი') : copy(`${item.placesLeft} places`, `${item.placesLeft} ადგილი`)}</span></Chip>)}
                {!allDates && data.sessions.length > SHOWN && <Chip onClick={() => setAllDates(true)}>{copy('More dates', 'სხვა თარიღები')}</Chip>}
            </div>}
        {changed && data && <div className="gk-notice gk-notice--warning gk-finder-changed" role="alert">
            <strong>{copy('The club changed this visit. Check it and book again.', 'კლუბმა ვიზიტი შეცვალა. შეამოწმეთ და ხელახლა დაჯავშნეთ.')}</strong>
            {lines.length > 0 && <ul>{lines.map(line => <li key={line}>{line}</li>)}</ul>}
        </div>}
        {fits.length > 1 && <div className="gk-chips" aria-label={copy('Who visits', 'ვინ მოდის')}>
            {fits.map(item => <Chip key={item.playerId} pressed={playerId === item.playerId} onClick={() => setPlayerId(item.playerId)}><Avatar name={item.identity.fullName} size={20} />{item.identity.fullName.split(' ')[0]}</Chip>)}
        </div>}
        {child && undeclared && <div className="gk-chips" role="radiogroup" aria-labelledby={`${id}-gender`} data-guide="declare-gender">
            <span id={`${id}-gender`} className="gk-faint">{copy(`Is ${first} a boy or a girl?`, `${first} ბიჭია თუ გოგო?`)}</span>
            {(['MALE', 'FEMALE'] as const).map(gender => <Chip key={gender} pressed={declaration === gender} onClick={() => { setDeclared({ playerId: child.playerId, gender }); setError(''); }}>
                {gender === 'MALE' ? copy('Boy', 'ბიჭი') : copy('Girl', 'გოგო')}</Chip>)}
        </div>}
        {!fits.length && (adding ? <AddChild inline onCreated={created => { setAdding(false); setPlayerId(created); finder?.changed(); sessions.retry(); }} />
            : <p className="gk-faint">{copy(`This group is for children ${bornLabel(copy, group.birthYearFrom, group.birthYearTo) ?? ''}.`, `ეს ჯგუფი ბავშვებისთვისაა: ${bornLabel(copy, group.birthYearFrom, group.birthYearTo) ?? ''}.`)} <button type="button" className="gk-board__link" onClick={() => setAdding(true)}>{copy('Add the child', 'ბავშვის დამატება')}</button></p>)}
        {needsPhone && <label className="gk-field" htmlFor={`${id}-phone`}><span className="gk-field__label">{copy('Your phone, for the coach during the visit', 'თქვენი ტელეფონი მწვრთნელისთვის')}</span>
            <input id={`${id}-phone`} className="gk-input" type="tel" autoComplete="tel" value={phone} maxLength={40} onChange={event => setPhone(event.target.value)} placeholder="+995 5xx xx xx xx" /></label>}
        {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        <div className="gk-finder-acts">
            <Button type="submit" variant="primary" size="sm" disabled={busy || !chosen || !child || (undeclared && !declaration) || (needsPhone && !phone.trim())}>
                {first ? copy(`Book for ${first}`, `დაჯავშნა ${first}-სთვის`) : copy('Book', 'დაჯავშნა')}</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>{copy('Not now', 'ახლა არა')}</Button>
        </div>
    </form>;
}
