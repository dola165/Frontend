import { useEffect, useRef, useState } from 'react';
import { EventCreationModal, type EventCreationFormValues } from '../../components/schedule/EventCreationModal';
import { localDateISO } from '../../components/schedule/scheduleFormUtils';
import type { ScheduleEventUpsertInput } from '../schedule/api';
import type { CalendarSquad } from './useSquadSchedule';
import { useJourneyCopy } from './journeyCopy';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/formatting';
import { formPayload } from './squadEventForms';
import * as api from './api';
import './squad-event-composer.css';

export function SeriesScope({ value, onChange, disabled = false }: { value: api.SeriesScope; onChange: (scope: api.SeriesScope) => void; disabled?: boolean }) {
    const copy = useJourneyCopy();
    return <label className="schedule-compose-field"><span>{copy('Apply to', 'ცვლილება შეეხება')}</span><select disabled={disabled} value={value} onChange={event => onChange(event.target.value as api.SeriesScope)}>
        <option value="THIS">{copy('This event only', 'მხოლოდ ეს ღონისძიება')}</option>
        <option value="FOLLOWING">{copy('This and following events', 'ეს და მომდევნო ღონისძიებები')}</option>
        <option value="ALL_FUTURE">{copy('All future events in this series', 'სერიის ყველა მომავალი ღონისძიება')}</option>
    </select></label>;
}
const local = (value: string) => { const date = new Date(value); return `${localDateISO(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:00`; };

function ChangeReview({ squadId, session, change, scope, onReviewed, onReload }: {
    squadId: number; session: api.SquadSession; change: api.SessionChange; scope: api.SeriesScope;
    onReviewed: (value: { signature: string; expected?: api.ExpectedSession[] } | null) => void;
    onReload: () => void;
}) {
    const copy = useJourneyCopy();
    const signature = JSON.stringify({ change, scope });
    const [result,setResult] = useState<{ signature: string; value?: api.SessionConsequence | api.SeriesPreview; error?: string } | null>(null);
    const [attempt,setAttempt] = useState(0);
    useEffect(() => {
        let live = true; onReviewed(null);
        const { change, scope } = JSON.parse(signature) as { change: api.SessionChange; scope: api.SeriesScope };
        const pending = session.series_id ? api.previewSeriesChange(squadId,session.id,{ change,scope }) : api.previewSession(squadId,session.id,change);
        void pending.then(value => { if(live) { setResult({ signature,value }); onReviewed({ signature,expected: 'expected' in value ? value.expected : undefined }); } })
            .catch(error => { if(live) setResult({ signature,error:extractApiErrorMessage(error,'The change preview could not load.') }); });
        return () => { live = false; };
    },[signature,squadId,session.id,session.series_id,attempt,onReviewed]);
    const current = result?.signature === signature ? result : null;
    if(current?.error) return <p role="alert">{current.error} <button type="button" onClick={() => setAttempt(n=>n+1)}>{copy('Try again','ხელახლა ცდა')}</button><button type="button" onClick={onReload}>{copy('Review latest event','ღონისძიების ბოლო ვერსიის ნახვა')}</button></p>;
    if(!current?.value) return <p role="status">{copy('Checking affected events and replies…','ღონისძიებებისა და პასუხების შემოწმება…')}</p>;
    const value=current.value;
    return <div className="squad-plan-review" role="status"><p>{'eventCount' in value ? value.eventCount : 1} {copy('events will change. Past events remain unchanged.','ღონისძიება შეიცვლება. წარსული ღონისძიებები უცვლელია.')}</p>
        <p>{value.affectedResponses} {copy('existing replies affected. Changes to dates, times, location or participants require a new confirmation when availability is requested.','არსებული პასუხი იცვლება. თარიღის, დროის, ადგილის ან მონაწილეთა ცვლილება ხელმისაწვდომობის ახალ დასტურს მოითხოვს.')}</p>
        <p>{'notificationDeliveries' in value ? value.notificationDeliveries : value.notificationRecipients} {copy('change notifications will be sent.','ცვლილების შეტყობინება გაიგზავნება.')}</p>
        {'dates' in value && <details><summary>{copy('Affected dates','შესაცვლელი თარიღები')}</summary><ol>{value.dates.map(date=><li key={date}>{formatDateTime(date)}</li>)}</ol></details>}
    </div>;
}

export function SquadEventEditComposer({ squad, session: currentSession, onClose, onSaved }: {
    squad: CalendarSquad; session: api.SquadSession; onClose: () => void; onSaved: () => void;
}) {
    const copy=useJourneyCopy();
    // Polling must never rebase a dirty form onto a revision the user has not reviewed.
    const [session] = useState(currentSession);
    const [initial] = useState<EventCreationFormValues>(() => ({ eventType:session.event_type??'TRAINING',title:session.title,
        date:local(session.starts_at).slice(0,10), endDate:local(session.ends_at).slice(0,10), startTime:local(session.starts_at).slice(11,16), endTime:local(session.ends_at).slice(11,16),
        isRecurring:false,locationName:session.location??'',locationLat:'',locationLng:'',visibility:'PRIVATE',publishAt:'',description:session.description??'',hostSquadId:squad.id }));
    const [roster,setRoster]=useState<api.Person[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
    const [playerIds,setPlayerIds]=useState(session.attendance.filter(p=>p.active!==false).map(p=>p.id));
    const [audienceChanged,setAudienceChanged]=useState(false),[responses,setResponses]=useState(session.response_requested!==false);
    const [scope,setScope]=useState<api.SeriesScope>('THIS');
    const [reviewed,setReviewed]=useState<{signature:string;expected?:api.ExpectedSession[]}|null>(null);
    const [saveFailed,setSaveFailed]=useState(false);
    const request=useRef<{signature:string;id:string}|null>(null);
    useEffect(()=>{const abort=new AbortController();void api.overview(squad.id,abort.signal).then(value=>{if(!abort.signal.aborted){setRoster(value.players);setError('');}}).catch(e=>{if(!abort.signal.aborted)setError(extractApiErrorMessage(e,'The roster could not load.'));});return()=>abort.abort();},[squad.id,retry]);
    const command=(payload:ScheduleEventUpsertInput):api.SessionChange=>{
        const draft={revision:session.revision,title:payload.title,startsAt:payload.startsAt===local(session.starts_at)?session.starts_at:new Date(payload.startsAt).toISOString(),
            endsAt:payload.endsAt===local(session.ends_at)?session.ends_at:new Date(payload.endsAt).toISOString(),location:payload.locationName??'',playerIds:audienceChanged?[...playerIds].sort((a,b)=>a-b):null,
            eventType:payload.eventType,description:payload.description??'',requestResponses:responses};
        const signature=JSON.stringify({draft,scope});if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
        return {...draft,requestId:request.current.id};
    };
    return <EventCreationModal isOpen fixedSquad mode="edit" surface="CLUB_SCHEDULE" clubId={squad.club_id??null} subjectLabel={squad.name}
        initialValues={initial} onClose={onClose} audience={{privateInvitations:true,privacyLabel:copy('Invited squad · private','მოწვეული გუნდი · პირადი'),
            saveLabel:copy('Confirm changes','ცვლილებების დადასტურება'),dirty:audienceChanged||scope!=='THIS'||responses!==(session.response_requested!==false),ready:!!reviewed,
            planContent:session.series_id?<SeriesScope value={scope} onChange={setScope}/>:null,
            reviewContent:form=><div className="squad-event-audience">
                {saveFailed && <p>{copy('Your draft is kept. Retry saving, or discard this draft to review the latest saved event.', 'თქვენი მონახაზი შენარჩუნებულია. სცადეთ შენახვა ან უარყავით მონახაზი ბოლო შენახული ვერსიის სანახავად.')} <button type="button" onClick={()=>{onSaved();onClose();}}>{copy('Discard draft & review latest', 'მონახაზის უარყოფა და ბოლო ვერსიის ნახვა')}</button></p>}
                {roster&&<ChangeReview squadId={squad.id} session={session} change={command(formPayload(form))} scope={scope} onReviewed={setReviewed} onReload={()=>{onSaved();onClose();}}/>}
                <details className="squad-event-people" open={error ? true : undefined}><summary>{copy('Edit invited players', 'მოწვეული მოთამაშეების შეცვლა')} <span>{playerIds.length} {copy('selected', 'არჩეულია')}</span></summary><fieldset><legend className="sr-only">{copy('Invited players','მოწვეული მოთამაშეები')}</legend>
                {error?<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>{copy('Retry roster','სიის ხელახლა ჩატვირთვა')}</button></p>:!roster?<p role="status">{copy('Loading squad roster…','გუნდის სია იტვირთება…')}</p>:<div className="squad-event-roster">{roster.map(player=><label className="squad-event-check" key={player.id}><input type="checkbox" checked={playerIds.includes(player.id)} onChange={event=>{setAudienceChanged(true);setPlayerIds(ids=>event.target.checked?[...ids,player.id]:ids.filter(id=>id!==player.id));}}/>{player.name}</label>)}</div>}
                <p>{copy('Unchanged invitation lists are preserved separately for each event. Selecting players replaces the list on every affected date.','უცვლელი მოწვევები თითოეული ღონისძიებისთვის ინახება. მოთამაშეების არჩევა ყველა არჩეულ თარიღზე სიას შეცვლის.')}</p>
            </fieldset></details><label className="squad-event-check"><input type="checkbox" checked={responses} onChange={e=>setResponses(e.target.checked)}/>{copy('Request availability','ხელმისაწვდომობის მოთხოვნა')}</label></div>}}
        onSubmit={async payload=>{const change=command(payload);if(reviewed?.signature!==JSON.stringify({change,scope}))throw new Error(copy('Review the updated change before saving.','შენახვამდე გადახედეთ განახლებულ ცვლილებას.'));
            try { if(session.series_id)await api.changeSeries(squad.id,session.id,{change,scope,expected:reviewed.expected});else await api.editSession(squad.id,session.id,change);onSaved();onClose(); }
            catch(error) { setSaveFailed(true); throw error; } }}/ >;
}
