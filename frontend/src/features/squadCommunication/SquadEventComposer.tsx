import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Lock, RefreshCw, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EventCreationModal } from '../../components/schedule/EventCreationModal';
import { createClubEvent } from '../schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/formatting';
import type { CalendarSquad } from './useSquadSchedule';
import { useJourneyCopy } from './journeyCopy';
import * as api from './api';
import './squad-event-composer.css';
import { newSquadEvent, squadEventPlan, formPayload } from './squadEventForms';
import { TrainingVenuePicker, type BookingReview } from './trainingBookings/TrainingVenuePicker';
import { createTraining, selectionSignature, type TrainingSelection } from './trainingBookings/api';

function PlanReview({ squadId, plan, onReviewed }: { squadId: number; plan: api.SquadEventPlan; onReviewed: (signature: string | null) => void }) {
    const copy = useJourneyCopy();
    const signature = JSON.stringify(plan);
    const [result, setResult] = useState<{ signature: string; value?: api.SquadEventPreview; error?: string } | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const abort = new AbortController(); onReviewed(null);
        void api.previewSquadEvent(squadId, JSON.parse(signature), abort.signal).then(value => {
            if (!abort.signal.aborted) { setResult({ signature, value }); onReviewed(signature); }
        }).catch(error => { if (!abort.signal.aborted) setResult({ signature, error: extractApiErrorMessage(error, 'The invitation preview could not load. Try again.') }); });
        return () => abort.abort();
    }, [signature, squadId, attempt, onReviewed]);
    const current = result?.signature === signature ? result : null;
    if (current?.error) return <div role="alert" className="squad-plan-error">{current.error}<button type="button" onClick={() => setAttempt(n => n+1)}><RefreshCw size={15}/>{copy('Try again', 'ხელახლა ცდა')}</button></div>;
    if (!current?.value) return <p role="status">{copy('Checking dates and invitation recipients…', 'თარიღებისა და მიმღებების შემოწმება…')}</p>;
    const value = current.value;
    return <div className="squad-plan-review" role="status">
        <div className="squad-plan-facts"><span><CalendarDays size={18}/><strong>{value.occurrences.length}</strong> {copy(value.occurrences.length === 1 ? 'event' : 'events', 'ღონისძიება')}</span><span><Users size={18}/><strong>{value.participantCount}</strong> {copy(value.participantCount === 1 ? 'player' : 'players', 'მოთამაშე')}</span><span><Check size={18}/><strong>{value.notificationRecipients}</strong> {copy(value.notificationRecipients === 1 ? 'recipient' : 'recipients', 'მიმღები')}</span></div>
        <p>{copy('Only invited players, their currently authorized guardians and squad staff can access these events. One notification announces the plan.', 'ღონისძიებები ხელმისაწვდომია მხოლოდ მოწვეული მოთამაშეებისთვის, მათი უფლებამოსილი მეურვეებისა და გუნდის პერსონალისთვის. გეგმის შესახებ გაიგზავნება ერთი შეტყობინება.')}</p>
        <p>{plan.requestResponses ? copy('Availability is requested separately for each date. Replies are plans to attend, not recorded attendance.', 'ხელმისაწვდომობის პასუხი თითოეული თარიღისთვის ცალკეა. პასუხი დასწრების გეგმას ასახავს და არა ფაქტობრივ დასწრებას.') : copy('No availability reply is requested.', 'ხელმისაწვდომობის პასუხი არ მოითხოვება.')}</p>
        {value.conflictingOccurrences > 0 && <p className="squad-plan-warning">{value.conflictingOccurrences} {copy('dates overlap existing squad invitations. Review the times before sending.', 'თარიღი ემთხვევა გუნდის არსებულ მოწვევებს. გაგზავნამდე გადაამოწმეთ დრო.')}</p>}
        <details><summary>{copy('Review all dates', 'ყველა თარიღის ნახვა')}</summary><ol>{value.occurrences.map(item => <li key={item.startsAt}>{formatDateTime(item.startsAt)} – {new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</li>)}</ol></details>
        <small>{copy('The invitation list is fixed when saved. New roster members are not added automatically.', 'შენახვისას მოწვევის სია ფიქსირდება. ახალი მოთამაშეები ავტომატურად არ ემატებიან.')}</small>
    </div>;
}

export function SquadEventComposer({ squad, date, weekly = false, onClose, onSaved }: {
    squad: CalendarSquad; date: Date; weekly?: boolean; onClose: () => void; onSaved: () => void;
}) {
    const copy = useJourneyCopy();
    const [initial] = useState(() => newSquadEvent(date, squad.id, weekly));
    const [roster, setRoster] = useState<api.Person[] | null>(null), [rosterError, setRosterError] = useState('');
    const [retry, setRetry] = useState(0), [playerIds, setPlayerIds] = useState<number[]>([]);
    const [invited, setInvited] = useState(true), [requestResponses, setRequestResponses] = useState(true);
    const [reviewed, setReviewed] = useState<string | null>(null);
    const [booking, setBooking] = useState<TrainingSelection | null>(null);
    const [bookingReview, setBookingReview] = useState<BookingReview | null>(null);
    const requestId = useRef(crypto.randomUUID());
    const lastSubmission = useRef<string | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        void api.overview(squad.id, abort.signal).then(value => { if (!abort.signal.aborted) { setRoster(value.players); setPlayerIds(value.players.map(p => p.id)); setRosterError(''); } })
            .catch(error => { if (!abort.signal.aborted) setRosterError(extractApiErrorMessage(error, 'The squad roster could not load.')); });
        return () => abort.abort();
    }, [squad.id, retry]);
    return <EventCreationModal isOpen fixedSquad mode="create" surface="CLUB_SCHEDULE" initialValues={initial}
        clubId={squad.club_id ?? null} subjectLabel={squad.name} onClose={onClose}
        audience={{ privateInvitations: invited, privacyLabel: copy('Invited squad · private', 'მოწვეული გუნდი · პირადი'),
            saveLabel: invited ? booking && reviewed && JSON.parse(reviewed).eventType === 'TRAINING' ? copy('Book pitches & send invitations', 'მოედნების დაჯავშნა და მოწვევები') : copy('Create & send invitations', 'შექმნა და მოწვევების გაგზავნა') : copy('Create calendar event', 'კალენდრის ღონისძიების შექმნა'),
            dirty: !invited || !requestResponses || !!roster && playerIds.length !== roster.length,
            ready: !invited || !!reviewed && (!booking || JSON.parse(reviewed).eventType !== 'TRAINING' || !!bookingReview && !!booking.contactName.trim() && !!booking.contactPhone.trim()),
            planContent: <fieldset className="squad-event-destination"><legend>{copy('Who is this for?', 'ვისთვისაა ღონისძიება?')}</legend><div>
                <button type="button" aria-pressed={invited} onClick={() => setInvited(true)}><Users size={19}/><span><strong>{copy('Squad invitation', 'გუნდის მოწვევა')}</strong><small>{copy('Private invitations and availability', 'პირადი მოწვევები და ხელმისაწვდომობა')}</small></span></button>
                <button type="button" aria-pressed={!invited} onClick={() => setInvited(false)}><CalendarDays size={19}/><span><strong>{copy('Club calendar', 'კლუბის კალენდარი')}</strong><small>{copy('Club or public listing, without invitations', 'კლუბის ან საჯარო ჩანაწერი, მოწვევების გარეშე')}</small></span></button>
            </div><p><Lock size={14}/>{invited ? copy('Invite the players you need. Authorized guardians receive updates where relevant.', 'მოიწვიეთ საჭირო მოთამაშეები. შესაბამისი უფლებამოსილი მეურვეები განახლებებს მიიღებენ.') : copy('Choose visibility in Review & share. This listing does not collect availability.', 'ხილვადობა აირჩიეთ მიმოხილვისას. ეს ჩანაწერი ხელმისაწვდომობის პასუხებს არ აგროვებს.')}</p>
            <Link to="/match-exchange" target="_blank" rel="noopener noreferrer">{copy('Arranging a match with another club? Open Match Exchange', 'სხვა კლუბთან მატჩს გეგმავთ? გახსენით მატჩების გაცვლა')} ↗</Link></fieldset>,
            reviewContent: form => !invited ? null : <div className="squad-event-audience">
                {roster && <PlanReview squadId={squad.id} plan={squadEventPlan(formPayload(form), playerIds, requestResponses, requestId.current)} onReviewed={setReviewed}/>}
                {roster && form.eventType === 'TRAINING' && <TrainingVenuePicker squadId={squad.id} plan={squadEventPlan(formPayload(form), playerIds, requestResponses, requestId.current)} selection={booking} onChange={setBooking} onReviewed={setBookingReview}/>}
                <label className="squad-event-check squad-event-replies"><input type="checkbox" checked={requestResponses} onChange={event => setRequestResponses(event.target.checked)}/><span><strong>{copy('Request availability', 'ხელმისაწვდომობის მოთხოვნა')}</strong><small>{copy('Players or authorized guardians reply for each date.', 'მოთამაშე ან უფლებამოსილი მეურვე პასუხობს თითოეულ თარიღზე.')}</small></span></label>
                <details className="squad-event-people" open={rosterError ? true : undefined}><summary>{copy('Edit invited players', 'მოწვეული მოთამაშეების შეცვლა')} <span>{playerIds.length} {copy('selected', 'არჩეულია')}</span></summary><fieldset><legend className="sr-only">{copy('Invited players', 'მოწვეული მოთამაშეები')}</legend>
                    {rosterError ? <p role="alert">{rosterError} <button type="button" onClick={() => setRetry(n => n+1)}>{copy('Retry roster', 'სიის ხელახლა ჩატვირთვა')}</button></p> : !roster ? <p role="status">{copy('Loading squad roster…', 'გუნდის სია იტვირთება…')}</p> : <>
                        <label className="squad-event-check"><input type="checkbox" checked={roster.length > 0 && playerIds.length === roster.length} onChange={event => setPlayerIds(event.target.checked ? roster.map(p => p.id) : [])}/><strong>{copy('Whole current squad', 'გუნდის მიმდინარე შემადგენლობა')}</strong></label>
                        <div className="squad-event-roster">{roster.map(player => <label className="squad-event-check" key={player.id}><input type="checkbox" checked={playerIds.includes(player.id)} onChange={event => setPlayerIds(ids => event.target.checked ? [...ids, player.id] : ids.filter(id => id !== player.id))}/>{player.name}</label>)}</div>
                        {playerIds.length === 0 && <p>{copy('No players selected. This event will be visible to squad staff only.', 'მოთამაშეები არჩეული არ არის. ღონისძიება მხოლოდ გუნდის პერსონალისთვის გამოჩნდება.')}</p>}
                    </>}
                </fieldset></details>
            </div> }}
        onSubmit={async payload => {
            if (!invited) { if (!squad.club_id) throw new Error('This squad has no club calendar.'); await createClubEvent(squad.club_id, { ...payload, hostSquadId: squad.id }); }
            else {
                const plan = squadEventPlan(payload, playerIds, requestResponses, requestId.current);
                if (JSON.stringify(plan) !== reviewed) throw new Error(copy('Review the updated dates and recipients before sending.', 'გაგზავნამდე გადახედეთ განახლებულ თარიღებსა და მიმღებებს.'));
                const actualBooking = plan.eventType === 'TRAINING' ? booking : null;
                if (actualBooking && (!bookingReview || bookingReview.signature !== selectionSignature(plan, actualBooking))) throw new Error(copy('Review the current venue, dates and prices before saving.', 'შენახვამდე გადახედეთ სტადიონს, თარიღებსა და ფასებს.'));
                const signature = JSON.stringify({ ...plan, requestId: undefined, booking: actualBooking });
                if (lastSubmission.current && lastSubmission.current !== signature) { requestId.current = crypto.randomUUID(); plan.requestId = requestId.current; }
                lastSubmission.current = signature;
                if (actualBooking && bookingReview) await createTraining(squad.id, plan, actualBooking, bookingReview.token);
                else await api.createSquadEvent(squad.id, plan);
            }
            onSaved();
        }}/ >;
}
