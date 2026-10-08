import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useJourneyCopy } from './journeyCopy';
import { recordVisitorAttendance, type IntroductoryVisitor, type VisitorAttendanceCommand } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import './IntroductoryVisitors.css';

export function IntroductoryVisitors({ squadId, sessionId, revision, visitors, onSaved }: {
    squadId: number; sessionId: number; revision: number; visitors: IntroductoryVisitor[]; onSaved: () => void;
}) {
    const copy=useJourneyCopy(), authSessionId=useSyncExternalStore(subscribeAuthSession,getAuthSessionId);
    const [rows,setRows]=useState(visitors),[choice,setChoice]=useState<Record<number,'ATTENDED'|'NO_SHOW'>>({}),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState('');
    const pending=useRef(new Map<number,VisitorAttendanceCommand>()),saving=useRef(false),scope=useRef(authSessionId);
    useEffect(()=>{setRows(visitors);},[visitors]);
    useEffect(()=>{if(scope.current!==authSessionId){pending.current.clear();setRows([]);setChoice({});setError('');scope.current=authSessionId;}},[authSessionId]);
    const permission=(row:IntroductoryVisitor)=>row.permissionStatus==='CURRENT'?copy('Current session permission','მიმდინარე სესიის ნებართვა'):
        row.permissionStatus==='HISTORICAL'?copy('Historical attendance; no current permission implied','ისტორიული დასწრება; მიმდინარე ნებართვას არ გულისხმობს'):
        row.permissionStatus==='GUARDIAN_REVIEW'?copy('Guardian authority needs review; contact admissions','მეურვის უფლებამოსილება გადასახედია; დაუკავშირდით მიღების პასუხისმგებელს'):
        row.permissionStatus==='INTRODUCTION_PERMISSION_REQUIRED'?row.canRecord?copy('Prior session permission is recorded; current contact permission is unavailable','წინა სესიის ნებართვა ჩაწერილია; მიმდინარე კონტაქტის წვდომა მიუწვდომელია'):copy('Current-club permission needs review','მიმდინარე კლუბის ნებართვა გადასახედია'):
        row.permissionStatus==='RECONFIRM_REQUIRED'||row.permissionStatus==='CONSENT_RECONFIRM_REQUIRED'?copy('Changed arrangement; confirmation needs review','შეცვლილი შეთანხმება; თანხმობა გადასახედია'):
        row.permissionStatus==='CANCELLED'||row.permissionStatus==='SESSION_CANCELLED'?copy('Invitation or session cancelled','მოწვევა ან სესია გაუქმებულია'):
        copy('Participation is unavailable; contact admissions','მონაწილეობა მიუწვდომელია; დაუკავშირდით მიღების პასუხისმგებელს');
    const record=async(row:IntroductoryVisitor)=>{
        if(saving.current||scope.current!==authSessionId)return;
        const earlier=pending.current.get(row.participationId);
        const attendance=earlier?.attendance??choice[row.participationId];if(!attendance)return;
        const command=earlier??{requestId:crypto.randomUUID(),caseId:row.caseId,caseVersion:row.caseVersion,participationVersion:row.participationVersion,sessionRevision:revision,attendance};
        pending.current.set(row.participationId,command);saving.current=true;setBusy(row.participationId);setError('');
        try { const result=await recordVisitorAttendance(squadId,sessionId,row.participationId,command,authSessionId);
            if(getAuthSessionId()!==authSessionId)return;
            pending.current.delete(row.participationId);setRows(current=>current.map(value=>value.participationId===result.participationId?result:value));onSaved();
        } catch(e) { if(getAuthSessionId()===authSessionId)setError(extractApiErrorMessage(e,copy('Attendance could not be checked. Retry the same recording or reload the session.','დასწრების შემოწმება ვერ მოხერხდა. ხელახლა სცადეთ იგივე ჩანაწერი ან განაახლეთ სესია.'))); }
        finally { saving.current=false;setBusy(null); }
    };
    if(!rows.length)return null;
    return <section aria-label={copy('Introductory visitors','გაცნობითი სესიის სტუმრები')} className="introductory-visitors">
        <h3>{copy('Introductory visitors','გაცნობითი სესიის სტუმრები')}</h3>
        <p>{copy('Record what happened at this introduction. Visitors have no regular squad membership or availability reply.','ჩაწერეთ ამ გაცნობით სესიაზე ფაქტობრივი დასწრება. სტუმრებს არ აქვთ გუნდის რეგულარული წევრობა ან ხელმისაწვდომობის პასუხი.')}</p>
        {rows.map(row=><article key={row.participationId}>
            <strong>{row.name}</strong><p>{permission(row)}</p>
            {row.emergencyContact&&<p>{copy('Emergency contact','საგანგებო კონტაქტი')}: {row.emergencyContact}</p>}
            {row.status==='ATTENDED'||row.status==='NO_SHOW'?<p role="status">{row.status==='ATTENDED'?copy('Attended','დაესწრო'):copy('Did not attend','არ დაესწრო')}</p>:row.canRecord?<>
                <label>{copy('Actual attendance for','ფაქტობრივი დასწრება მოთამაშისთვის')} {row.name}<select disabled={busy!==null||pending.current.has(row.participationId)} value={pending.current.get(row.participationId)?.attendance??choice[row.participationId]??''} onChange={e=>setChoice(current=>({...current,[row.participationId]:e.target.value as 'ATTENDED'|'NO_SHOW'}))}>
                    <option value="" disabled>{copy('Choose actual attendance','აირჩიეთ ფაქტობრივი დასწრება')}</option><option value="ATTENDED">{copy('Attended','დაესწრო')}</option><option value="NO_SHOW">{copy('Did not attend','არ დაესწრო')}</option>
                </select></label>
                <button type="button" disabled={busy!==null||(!choice[row.participationId]&&!pending.current.has(row.participationId))} onClick={()=>void record(row)}>{pending.current.has(row.participationId)?copy('Retry attendance for','დასწრების ხელახლა შემოწმება მოთამაშისთვის'):copy('Save attendance for','დასწრების შენახვა მოთამაშისთვის')} {row.name}</button>
            </>:row.permissionStatus==='CURRENT'&&<p>{copy('Actual attendance can be recorded after the session starts.','ფაქტობრივი დასწრების ჩაწერა შესაძლებელია სესიის დაწყების შემდეგ.')}</p>}
        </article>)}
        {error&&<p role="alert">{error} <button type="button" disabled={busy!==null} onClick={onSaved}>{copy('Reload latest session','სესიის განახლება')}</button></p>}
    </section>;
}
