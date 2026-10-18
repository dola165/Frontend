import { useId, useLayoutEffect, useRef, useState } from 'react';
import { GuidedFlow, type GuideResult, type GuideTask } from '../pages/guide/GuidedFlow';
import { Field, Button } from '../../design/primitives';
import { get, post, root, type Bootstrap, type OperationRecord } from '../clubOperations/api';
import { rolesRoot, type RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import type { createSession } from '../squadCommunication/api';
import { useRecordCreation } from '../clubOperations/useRecordCreation';
import { appLanguage, formatDate } from '../../utils/formatting';
import type { CoachTrainingContext } from './coachHub/coachData';
import { extractApiErrorMessage } from '../../utils/apiError';
import { assertCurrentAuthSession, getAuthSessionId } from '../../utils/authStorage';
import './workspace-guide.css';

const localTime = () => {
  const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(17, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T17:00`;
};
const complete: GuideResult = { status: 'complete' };
const trainingMarker = (key: string) => { try { return sessionStorage.getItem(key); } catch { return null; } };
const rememberTraining = (key: string, requestId: string) => { try { sessionStorage.setItem(key, requestId); } catch { /* The unresolved-save message says to keep this page open. */ } };
const forgetTraining = (key: string, requestId: string) => { try { if (trainingMarker(key) === requestId) sessionStorage.removeItem(key); } catch { /* No private details are stored here. */ } };
const writable = (boot: Bootstrap, module: string, squad: number | null) => {
  const access = boot.modules.find(m => m.id === module);
  return Boolean(boot.settings.enabled_modules.includes(module) && access?.writable && (access.globalWrite || squad != null && access.writeSquads.includes(squad)));
};

interface WorkspaceGuideProps {
  boot: Bootstrap; roles: RolesWorkspace; mode: 'club' | 'coach'; onRefresh: () => Promise<void> | void; suspended?: boolean;
  training?: CoachTrainingContext; onOpenSchedule?: (next?: NonNullable<CoachTrainingContext['next']>) => void;
}
export function WorkspaceGuide(props: WorkspaceGuideProps) {
  return <OperationalFlow key={`${props.mode}:${props.boot.clubId}:${props.boot.actorId}:${getAuthSessionId()}`} {...props} />;
}
function OperationalFlow({ boot, roles, mode, onRefresh, suspended = false, training, onOpenSchedule }: WorkspaceGuideProps) {
  const id = useId(), ka = appLanguage() === 'ka';
  const t = (en: string, ge: string) => ka ? ge : en;
  const [authSessionId] = useState(getAuthSessionId);
  const active = useRef(true);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const assertActive = () => {
    if (!active.current) throw new Error(t('This guide is no longer active.', 'ეს გზამკვლევი უკვე დახურულია.'));
    assertCurrentAuthSession(authSessionId);
  };
  const send = <T,>(path: string, body: unknown) => {
    assertActive();
    return post<T>(path, body, undefined, authSessionId);
  };
  const dutyCreation = useRecordCreation(boot, 'DUTY'), attendanceCreation = useRecordCreation(boot, 'ATTENDANCE');
  // Next uses the displayed controls, including a just-typed value whose React
  // change is still being committed. The task runner intentionally has no form state.
  const valueOf = (field: string, fallback: string) => {
    const control = document.getElementById(`${id}-${field}`);
    return control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement ? control.value : fallback;
  };
  const coachingIds = roles.views.filter(v => !v.clubWide).flatMap(v => v.squadIds);
  const squads = mode === 'coach' ? roles.requestSquads.filter(s => coachingIds.includes(s.id)) : boot.squads;
  const trainingAccess = boot.modules.find(module => module.id === 'ATTENDANCE');
  const canPlanTraining = (squadId: number) => boot.leadership || roles.views.some(view => view.id === 'coaching' && view.squadIds.includes(squadId)) || Boolean(trainingAccess?.writable && (trainingAccess.globalWrite || trainingAccess.writeSquads.includes(squadId)));
  const trainingSquads = squads.filter(squad => canPlanTraining(squad.id));
  const dutySquads = squads.filter(squad => writable(boot, 'STAFF', squad.id));
  const wholeDuty = mode === 'club' && writable(boot, 'STAFF', null);
  const attendanceSessions = boot.sessions.filter(s => squads.some(q => q.id === s.squad_id) && writable(boot, 'ATTENDANCE', s.squad_id ?? null));
  const sessions = attendanceSessions.filter(s => roles.people.some(person => person.squad_id === s.squad_id));
  const [squad, setSquad] = useState(String(squads[0]?.id ?? ''));
  const trainingSquad = trainingSquads.some(item => String(item.id) === squad) ? squad : String(trainingSquads[0]?.id ?? '');
  const dutySquad = wholeDuty && !squad ? '' : dutySquads.some(item => String(item.id) === squad) ? squad : String(dutySquads[0]?.id ?? '');
  const [starts, setStarts] = useState(localTime), [ground, setGround] = useState('');
  const [minutes, setMinutes] = useState('90'), [dutyTitle, setDutyTitle] = useState(t('Training cover', 'ვარჯიშზე ჩანაცვლება'));
  const [assignee, setAssignee] = useState(String(boot.staff.find(p => p.id === boot.actorId)?.id ?? boot.staff[0]?.id ?? ''));
  const [role, setRole] = useState(roles.catalog.find(r => !roles.requests.some(q => q.user_id === boot.actorId && q.role_key === r.key && ['PENDING', 'APPROVED'].includes(q.status)))?.key ?? '');
  const [requestNote, setRequestNote] = useState('');
  const [player, setPlayer] = useState(''), [answer, setAnswer] = useState('ARRIVED');
  const [session, setSession] = useState(String(sessions[0]?.id ?? ''));
  const [receipt, setReceipt] = useState(''), [refreshError, setRefreshError] = useState('');
  const [completed, setCompleted] = useState<string[]>([]), [sessionSubmitted, setSessionSubmitted] = useState(false);
  const trainingKey = `gk-training-create:${boot.actorId}:${boot.clubId}`;
  const [unresolvedTraining] = useState(() => trainingMarker(trainingKey));
  const unresolvedTrainingMessage = t('A previous training save was not confirmed. Reloading cleared its details. Review the calendar before planning another.', 'წინა ვარჯიშის შენახვა არ დადასტურებულა. გადატვირთვისას დეტალები წაიშალა. ახალი ვარჯიშის დაგეგმვამდე შეამოწმეთ კალენდარი.');
  const [trainingUncertain, setTrainingUncertain] = useState(false);
  const [planningNew, setPlanningNew] = useState(false);
  const currentTraining = training?.clubId === boot.clubId && training.actorId === boot.actorId && roles.actorId === boot.actorId ? training : undefined;
  const nextTraining = currentTraining?.next && squads.some(item => item.id === currentTraining.next?.squadId) ? currentTraining.next : null;
  // A submitted/uncertain request always retains its original editor, body and UUID when reads refresh.
  const trainingForm = trainingSquads.length > 0 && (planningNew || Boolean(unresolvedTraining) || sessionSubmitted || currentTraining?.state === 'ready' && currentTraining.next === null);
  const canReviewTraining = onOpenSchedule && squads.length > 0 && (nextTraining || currentTraining?.state !== 'ready');
  const saved = useRef(new Map<string, string>()), attendanceRecord = useRef<OperationRecord | null>(null);
  const attendanceNeedsRead = useRef(false);
  const sessionAttempt = useRef<{ squad: number; body: Parameters<typeof createSession>[1] } | null>(null);
  const sessionRequestId = useRef(unresolvedTraining ?? crypto.randomUUID());
  const [hasRequest] = useState(roles.requests.some(r => r.user_id === boot.actorId && r.status === 'PENDING'));
  const [retrying, setRetrying] = useState(false);
  const refresh = async () => {
    try { await onRefresh(); setRefreshError(''); }
    catch (error) { setRefreshError(extractApiErrorMessage(error, t('Saved. The page could not refresh.', 'შენახულია. გვერდი ვერ განახლდა.'))); }
  };
  const acknowledge = async (task: string, message: string) => {
    saved.current.set(task, message); setCompleted(previous => [...new Set([...previous, task])]); setReceipt(message); await refresh(); return complete;
  };
  const replay = (task: string) => {
    const message = saved.current.get(task);
    if (!message) return false;
    setReceipt(message); return true;
  };
  const scope = <Field label={t('Squad', 'გუნდი')} htmlFor={`${id}-squad`}><select id={`${id}-squad`} className="gk-input" value={dutySquad} onChange={e => setSquad(e.target.value)} required={!wholeDuty}>
    {wholeDuty && <option value="">{t('Whole club', 'მთელი კლუბი')}</option>}{dutySquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
  </select></Field>;
  const trainingScope = <Field label={t('Squad', 'გუნდი')} htmlFor={`${id}-squad`}><select id={`${id}-squad`} className="gk-input" value={trainingSquad} onChange={e => setSquad(e.target.value)} required>{trainingSquads.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>;
  const when = <Field label={t('Starts', 'დაწყება')} htmlFor={`${id}-starts`}><input id={`${id}-starts`} className="gk-input" type="datetime-local" required value={starts} onChange={e => setStarts(e.target.value)} /></Field>;
  const where = <Field label={t('Ground or meeting place', 'მოედანი ან შეხვედრის ადგილი')} htmlFor={`${id}-ground`}><input id={`${id}-ground`} className="gk-input" value={ground} maxLength={160} onChange={e => setGround(e.target.value)} /></Field>;
  let tasks: GuideTask[] = [];
  if (mode === 'coach' && (trainingSquads.length || canReviewTraining)) tasks = [...tasks, {
    id: 'training', title: trainingForm ? t('Plan one training session', 'დაგეგმეთ ერთი ვარჯიში') : nextTraining ? t('Your upcoming training', 'თქვენი მომავალი ვარჯიში') : t('Check your training', 'შეამოწმეთ ვარჯიშები'),
    description: trainingForm ? t('Confirm the squad, time and ground. Weekly training is set on the squad page.', 'დაადასტურეთ გუნდი, დრო და მოედანი. ყოველკვირეული ვარჯიში გუნდის გვერდზე ირჩევა.') : undefined,
    nextLabel: trainingForm ? undefined : nextTraining ? t('Open session', 'ვარჯიშის გახსნა') : t('Open calendar', 'კალენდრის გახსნა'),
    disabled: trainingForm ? Boolean(unresolvedTraining) : !onOpenSchedule || !nextTraining && (!currentTraining || currentTraining.state === 'loading'),
    content: <div className="cw-guide-fields">{!trainingForm ? <>
      {nextTraining ? <><strong>{nextTraining.session.title}</strong><p>{nextTraining.squadName} · {formatDate(nextTraining.session.starts_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: boot.settings.timezone ?? 'Asia/Tbilisi' })}</p>
        {nextTraining.session.location && <p>{nextTraining.session.location}</p>}</> : <p role="status">{!currentTraining || currentTraining.state === 'loading' ? t('Checking your training…', 'ვარჯიშები მოწმდება…') : t('Training could not be checked. Open the calendar or choose to plan a new session.', 'ვარჯიშების შემოწმება ვერ მოხერხდა. გახსენით კალენდარი ან დაგეგმეთ ახალი ვარჯიში.')}</p>}
      {trainingSquads.length > 0 && <Button onClick={() => setPlanningNew(true)}>{nextTraining ? t('Plan another session', 'კიდევ ერთი ვარჯიშის დაგეგმვა') : t('Plan new training', 'ახალი ვარჯიშის დაგეგმვა')}</Button>}
    </> : unresolvedTraining ? <p role="status">{unresolvedTrainingMessage}</p> : <>
      {trainingUncertain && <p role="status">{t('Training may already be saved. Keep this page open; retry uses the same request.', 'ვარჯიში შეიძლება უკვე შენახული იყოს. დატოვეთ ეს გვერდი ღია; გამეორება იმავე მოთხოვნას იყენებს.')}</p>}
      <fieldset disabled={completed.includes('training') || sessionSubmitted}>{trainingScope}{when}{where}
      <Field label={t('Minutes', 'წუთები')} htmlFor={`${id}-minutes`}><input id={`${id}-minutes`} className="gk-input" type="number" min={15} max={240} required value={minutes} onChange={e => setMinutes(e.target.value)} /></Field>
    </fieldset></>}</div>,
    next: async () => {
      if (!trainingForm) { assertActive(); onOpenSchedule?.(nextTraining ?? undefined); return complete; }
      if (replay('training')) return complete;
      assertActive();
      if (unresolvedTraining) return { status: 'stay', message: t('Review the previous training save in the calendar.', 'შეამოწმეთ წინა შენახვა კალენდარში.') };
      const recovering = sessionAttempt.current !== null;
      if (!sessionAttempt.current) {
        const chosenSquad = valueOf('squad', trainingSquad), chosenStart = valueOf('starts', starts), chosenGround = valueOf('ground', ground), chosenMinutes = valueOf('minutes', minutes);
        const startsAt = new Date(chosenStart); if (!Number.isFinite(startsAt.getTime()) || !Number(chosenSquad)) return { status: 'stay', message: t('Choose a squad and start time.', 'აირჩიეთ გუნდი და დაწყების დრო.') };
        if (!canPlanTraining(Number(chosenSquad))) return { status: 'stay', message: t('Choose a squad where you can plan training.', 'აირჩიეთ გუნდი, რომლის ვარჯიშის დაგეგმვაც შეგიძლიათ.') };
        setSquad(chosenSquad); setStarts(chosenStart); setGround(chosenGround); setMinutes(chosenMinutes);
        sessionAttempt.current = { squad: Number(chosenSquad), body: { requestId: sessionRequestId.current, title: t('Training', 'ვარჯიში'), startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + Number(chosenMinutes) * 60000).toISOString(), location: chosenGround.trim() } };
        setSessionSubmitted(true);
      }
      const attempt = sessionAttempt.current;
      rememberTraining(trainingKey, attempt.body.requestId);
      try { await send(`/squad-communication/${attempt.squad}/sessions`, attempt.body); forgetTraining(trainingKey, attempt.body.requestId); setTrainingUncertain(false); }
      catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (!recovering && status && [400, 401, 403, 404, 422].includes(status)) { forgetTraining(trainingKey, attempt.body.requestId); sessionAttempt.current = null; sessionRequestId.current = crypto.randomUUID(); setSessionSubmitted(false); setTrainingUncertain(false); }
        else setTrainingUncertain(true);
        throw error;
      }
      return acknowledge('training', t('Training saved.', 'ვარჯიში შენახულია.'));
    },
  }];
  if (!hasRequest && !boot.leadership && roles.catalog.length) tasks = [...tasks, {
    id: 'responsibility', title: t('Ask for a responsibility', 'მოითხოვეთ პასუხისმგებლობა'), description: t('The club reviews this request before access changes.', 'წვდომის შეცვლამდე კლუბი განიხილავს მოთხოვნას.'),
    content: <div className="cw-guide-fields"><fieldset disabled={completed.includes('responsibility')}>
      <Field label={t('Responsibility', 'პასუხისმგებლობა')} htmlFor={`${id}-role`}><select id={`${id}-role`} className="gk-input" required value={role} onChange={e => setRole(e.target.value)}>{roles.catalog.map(r => <option key={r.key} value={r.key}>{r.title}</option>)}</select></Field>
      <Field label={t('Squad', 'გუნდი')} htmlFor={`${id}-request-squad`}><select id={`${id}-request-squad`} className="gk-input" value={squad} onChange={e => setSquad(e.target.value)}><option value="">{t('Whole club', 'მთელი კლუბი')}</option>{roles.requestSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label={t('Message to the club', 'შეტყობინება კლუბს')} htmlFor={`${id}-note`}><textarea id={`${id}-note`} className="gk-input" rows={2} maxLength={1000} value={requestNote} onChange={e => setRequestNote(e.target.value)} /></Field>
    </fieldset></div>,
    next: async () => {
      if (replay('responsibility')) return complete;
      const chosenSquad = valueOf('request-squad', squad);
      await send(`${rolesRoot(boot.clubId)}/requests`, { roleKey: valueOf('role', role), clubWide: !chosenSquad, squadIds: chosenSquad ? [Number(chosenSquad)] : [], note: valueOf('note', requestNote).trim() || null, replaceAppointmentId: null });
      return acknowledge('responsibility', t('Request sent for approval.', 'მოთხოვნა გაგზავნილია დასამტკიცებლად.'));
    },
  }];
  if ((wholeDuty || dutySquads.length > 0) && boot.staff.length) tasks = [...tasks, {
    id: 'staff-duty', title: t('Give a staff member a task', 'მიეცით თანამშრომელს დავალება'),
    disabled: dutyCreation.blocked || !writable(boot, 'STAFF', dutySquad ? Number(dutySquad) : null),
    content: <div className="cw-guide-fields">{dutyCreation.message && <p role="status">{dutyCreation.message}</p>}<fieldset disabled={completed.includes('staff-duty') || dutyCreation.uncertain || dutyCreation.blocked}>
      <Field label={t('Task', 'დავალება')} htmlFor={`${id}-duty`}><input id={`${id}-duty`} className="gk-input" maxLength={160} required value={dutyTitle} onChange={e => setDutyTitle(e.target.value)} /></Field>
      <Field label={t('Who does it?', 'ვინ შეასრულებს?')} htmlFor={`${id}-staff`}><select id={`${id}-staff`} className="gk-input" required value={assignee} onChange={e => setAssignee(e.target.value)}>{boot.staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      {scope}{when}
    </fieldset></div>,
    next: async () => {
      if (replay('staff-duty')) return complete;
      const chosenSquad = valueOf('squad', dutySquad);
      const chosenStart = valueOf('starts', starts);
      const savedRecord = await dutyCreation.create({ kind: 'DUTY', title: valueOf('duty', dutyTitle).trim(), assignedUserId: Number(valueOf('staff', assignee)), squadId: chosenSquad ? Number(chosenSquad) : null, dueOn: chosenStart.slice(0, 10), data: { duty: 'SESSION_COVER', startsAt: new Date(chosenStart).toISOString(), location: ground.trim() } });
      return acknowledge('staff-duty', t(`Saved: ${savedRecord.title} · #${savedRecord.id}`, `შენახულია: ${savedRecord.title} · #${savedRecord.id}`));
    },
  }];
  if (mode === 'coach' && sessions.length) tasks = [...tasks, {
    id: 'attendance', title: t('Record attendance, if you use it', 'აღრიცხეთ დასწრება, თუ იყენებთ'),
    disabled: attendanceCreation.blocked,
    description: t('Optional. Choose one player and their actual attendance.', 'სურვილისამებრ. აირჩიეთ ერთი მოთამაშე და მისი რეალური დასწრება.'),
    content: <div className="cw-guide-fields">{attendanceCreation.message && <p role="status">{attendanceCreation.message}</p>}<fieldset disabled={completed.includes('attendance') || attendanceCreation.uncertain || attendanceCreation.blocked}>
      <Field label={t('Session', 'ვარჯიში')} htmlFor={`${id}-session`}><select id={`${id}-session`} className="gk-input" required value={session} onChange={e => { setSession(e.target.value); setPlayer(''); attendanceRecord.current = null; }}><option value="">{t('Choose a session', 'აირჩიეთ ვარჯიში')}</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.squad_name} · {s.title} · {s.starts_at.slice(0, 10)}</option>)}</select></Field>
      <Field label={t('Player', 'მოთამაშე')} htmlFor={`${id}-player`}><select id={`${id}-player`} className="gk-input" required value={player} onChange={e => { setPlayer(e.target.value); attendanceRecord.current = null; }}><option value="">{t('Choose a player', 'აირჩიეთ მოთამაშე')}</option>{roles.people.filter(p => p.squad_id === sessions.find(s => String(s.id) === session)?.squad_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label={t('Attendance', 'დასწრება')} htmlFor={`${id}-answer`}><select id={`${id}-answer`} className="gk-input" value={answer} onChange={e => setAnswer(e.target.value)}><option value="ARRIVED">{t('Arrived', 'მოვიდა')}</option><option value="ABSENT">{t('Absent', 'არ მოვიდა')}</option></select></Field>
    </fieldset></div>,
    next: async () => {
      if (replay('attendance')) return complete;
      const chosenSession = valueOf('session', session), chosenPlayer = valueOf('player', player), chosenAnswer = valueOf('answer', answer);
      const selectedSession = sessions.find(s => String(s.id) === chosenSession); if (!selectedSession || !roles.people.some(person => String(person.id) === chosenPlayer && person.squad_id === selectedSession.squad_id)) return { status: 'stay', message: t('Choose a session and a player from its squad.', 'აირჩიეთ ვარჯიში და მოთამაშე მისი გუნდიდან.') };
      if (attendanceRecord.current && (attendanceRecord.current.session_id !== Number(chosenSession) || attendanceRecord.current.subject_user_id !== Number(chosenPlayer))) { attendanceRecord.current = null; attendanceNeedsRead.current = false; }
      if (!attendanceRecord.current) {
        const body = { kind: 'ATTENDANCE', title: `${roles.people.find(p => String(p.id) === chosenPlayer)?.name} · ${selectedSession.title}`, squadId: selectedSession.squad_id, sessionId: Number(chosenSession), subjectUserId: Number(chosenPlayer), data: {} };
        if (attendanceCreation.uncertain) attendanceRecord.current = await attendanceCreation.create(body);
        else {
          const rows = await get<OperationRecord[]>(`${rolesRoot(boot.clubId)}/work?module=ATTENDANCE&squad=${selectedSession.squad_id}&session=${chosenSession}&person=${chosenPlayer}`);
          attendanceRecord.current = rows[0] ?? await attendanceCreation.create(body);
        }
      }
      if (attendanceNeedsRead.current) { attendanceRecord.current = await get<OperationRecord>(`${root(boot.clubId)}/records/${attendanceRecord.current.id}`); attendanceNeedsRead.current = false; }
      const record = attendanceRecord.current;
      try { if (record.status !== chosenAnswer) attendanceRecord.current = await send<OperationRecord>(`${root(boot.clubId)}/records/${record.id}/transition`, { status: chosenAnswer, revision: record.revision, note: null }); }
      catch (error) { attendanceNeedsRead.current = true; throw error; }
      return acknowledge('attendance', t('Attendance saved.', 'დასწრება შენახულია.'));
    },
  }];
  return <>{receipt && <div className="gk-notice cw-guide-receipt" role="status">{receipt}</div>}
    {!suspended && mode === 'coach' && !trainingForm && (unresolvedTraining || trainingUncertain) && <p className="gk-notice cw-guide-receipt" role="status">{unresolvedTraining ? unresolvedTrainingMessage : t('Training may already be saved. Keep this page open and review the calendar.', 'ვარჯიში შეიძლება უკვე შენახული იყოს. დატოვეთ ეს გვერდი ღია და შეამოწმეთ კალენდარი.')}</p>}
    {!suspended && mode === 'coach' && attendanceSessions.length > 0 && sessions.length === 0 && <p className="gk-notice cw-guide-receipt" role="status">{t('Attendance is available once players are added to your squad.', 'დასწრების აღრიცხვა ხელმისაწვდომი იქნება, როცა თქვენს გუნდს მოთამაშეები დაემატებიან.')}</p>}
    {refreshError && <div className="gk-notice gk-notice--warning cw-guide-receipt" role="alert">{refreshError}<Button size="sm" disabled={retrying} onClick={() => { setRetrying(true); void refresh().finally(() => setRetrying(false)); }}>{t('Refresh page', 'გვერდის განახლება')}</Button></div>}
    <GuidedFlow flowId={`workspace:${mode}:${boot.actorId}:${boot.clubId}`} title={mode === 'club' ? t('Club work', 'კლუბის საქმეები') : t('My squads', 'ჩემი გუნდები')} tasks={tasks} suspended={suspended} />
  </>;
}

