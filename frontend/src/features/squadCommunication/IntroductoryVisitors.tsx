import { useVisitorAttendance, type VisitorAttendanceProps } from './useVisitorAttendance';
import './IntroductoryVisitors.css';

/** Introductory visitors in the squad's session dialog. The club workspace register shows the same rows in its own list. */
export function IntroductoryVisitors(props: VisitorAttendanceProps) {
    const { copy, rows, choice, busy, error, permission, record, pendingFor, select } = useVisitorAttendance(props);
    if(!rows.length)return null;
    return <section aria-label={copy('Introductory visitors','გაცნობითი სესიის სტუმრები')} className="introductory-visitors">
        <h3>{copy('Introductory visitors','გაცნობითი სესიის სტუმრები')}</h3>
        <p>{copy('Record what happened at this introduction. Visitors have no regular squad membership or availability reply.','ჩაწერეთ ამ გაცნობით სესიაზე ფაქტობრივი დასწრება. სტუმრებს არ აქვთ გუნდის რეგულარული წევრობა ან ხელმისაწვდომობის პასუხი.')}</p>
        {rows.map(row=><article key={row.participationId}>
            <strong>{row.name}</strong><p>{permission(row)}</p>
            {row.emergencyContact&&<p>{copy('Emergency contact','საგანგებო კონტაქტი')}: {row.emergencyContact}</p>}
            {row.status==='ATTENDED'||row.status==='NO_SHOW'?<p role="status">{row.status==='ATTENDED'?copy('Attended','დაესწრო'):copy('Did not attend','არ დაესწრო')}</p>:row.canRecord?<>
                <label>{copy('Actual attendance for','ფაქტობრივი დასწრება მოთამაშისთვის')} {row.name}<select disabled={busy!==null||Boolean(pendingFor(row))} value={pendingFor(row)?.attendance??choice[row.participationId]??''} onChange={e=>select(row,e.target.value as 'ATTENDED'|'NO_SHOW')}>
                    <option value="" disabled>{copy('Choose actual attendance','აირჩიეთ ფაქტობრივი დასწრება')}</option><option value="ATTENDED">{copy('Attended','დაესწრო')}</option><option value="NO_SHOW">{copy('Did not attend','არ დაესწრო')}</option>
                </select></label>
                <button type="button" disabled={busy!==null||(!choice[row.participationId]&&!pendingFor(row))} onClick={()=>void record(row)}>{pendingFor(row)?copy('Retry attendance for','დასწრების ხელახლა შემოწმება მოთამაშისთვის'):copy('Save attendance for','დასწრების შენახვა მოთამაშისთვის')} {row.name}</button>
            </>:row.permissionStatus==='CURRENT'&&<p>{copy('Actual attendance can be recorded after the session starts.','ფაქტობრივი დასწრების ჩაწერა შესაძლებელია სესიის დაწყების შემდეგ.')}</p>}
        </article>)}
        {error&&<p role="alert">{error} <button type="button" disabled={busy!==null} onClick={props.onSaved}>{copy('Reload latest session','სესიის განახლება')}</button></p>}
    </section>;
}
