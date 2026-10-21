import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { durationMinutes, upcomingTrainingDates } from '../../../components/schedule/scheduleFormUtils';
import type { EventCreationFormValues } from '../../../components/schedule/EventCreationModal';
import { GuidedFlow, type GuideResult, type GuideTask } from '../../pages/guide/GuidedFlow';
import { fetchPage, type Ground } from '../../pages/api';
import { clearReceipt, installAdmissionPrivacyCleanup, prepareReceipt, readReceipt, receiptKey } from '../../admissions/applicant/receipt';
import type { DayOfWeek } from '../../schedule/api';
import { PlanReview } from '../SquadEventComposer';
import { formPayload, newSquadEvent, squadEventPlan } from '../squadEventForms';
import { useJourneyCopy } from '../journeyCopy';
import * as api from '../api';
import './training-setup.css';

installAdmissionPrivacyCleanup(getAuthSessionId);
const DAYS: [DayOfWeek, string, string][] = [
    ['MONDAY', 'Monday', 'ორშაბათი'], ['TUESDAY', 'Tuesday', 'სამშაბათი'], ['WEDNESDAY', 'Wednesday', 'ოთხშაბათი'],
    ['THURSDAY', 'Thursday', 'ხუთშაბათი'], ['FRIDAY', 'Friday', 'პარასკევი'], ['SATURDAY', 'Saturday', 'შაბათი'], ['SUNDAY', 'Sunday', 'კვირა'],
];
type PlanPayload = Omit<api.SquadEventPlan, 'requestId'>;
const groundLocation = (ground: Ground) => [ground.name, ground.address].map(value => value?.trim()).filter(Boolean).join(', ');

/** Squad-specific composition on the shared guide and existing schedule preview/commit actions. */
export function SquadTrainingSetup({ space, onClose, onSaved }: {
    space: api.SquadOverview; onClose: () => void; onSaved: (firstDate?: string) => void;
}) {
    const { user, sessionId } = useAuth();
    return space.can_manage ? <TrainingSetup key={`${sessionId}:${space.id}`} scope={`${user?.id}:${sessionId}`} space={space} onClose={onClose} onSaved={onSaved} /> : null;
}

function TrainingSetup({ scope, space, onClose, onSaved }: {
    scope: string; space: api.SquadOverview; onClose: () => void; onSaved: (firstDate?: string) => void;
}) {
    const { sessionId } = useAuth();
    const copy = useJourneyCopy();
    const draftKey = `admission-form:${scope}:squad-training:${space.id}`;
    const retryKey = receiptKey(scope, space.id, 'squad-training');
    const [pending, setPending] = useState(() => readReceipt<PlanPayload>(retryKey));
    const [requestId] = useState(() => pending?.requestId ?? crypto.randomUUID());
    const [initialDraft] = useState<{ form: EventCreationFormValues; keepGround: boolean }>(() => {
        const fresh = { ...newSquadEvent(new Date(), space.id, true), title: copy('Training', 'ვარჯიში') };
        try {
            const stored = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
            const draft = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
            return { form: { ...fresh, ...draft, locationName: typeof draft.locationName === 'string' ? draft.locationName : fresh.locationName, eventType: 'TRAINING', isRecurring: true }, keepGround: Object.prototype.hasOwnProperty.call(draft, 'locationName') };
        } catch { return { form: fresh, keepGround: false }; }
    });
    const [form, setForm] = useState(initialDraft.form);
    const groundAnswered = useRef(initialDraft.keepGround || !!pending);
    const [grounds, setGrounds] = useState<Ground[]>([]), [groundError, setGroundError] = useState(false), [groundAttempt, setGroundAttempt] = useState(0);
    const [askFamilies, setAskFamilies] = useState(() => {
        if (pending) return pending.payload.requestResponses;
        try { return sessionStorage.getItem(`${draftKey}:replies`) === 'true'; } catch { return false; }
    });
    const [existing, setExisting] = useState<number | null>(null), [loadError, setLoadError] = useState(''), [attempt, setAttempt] = useState(0);
    const [reviewed, setReviewed] = useState<string | null>(null);
    const savedDate = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (pending) return;
        const abort = new AbortController();
        void fetchPage({ type: 'club', id: space.club_id }, abort.signal).then(page => {
            if (abort.signal.aborted) return;
            if (page.ref?.type !== 'club' || page.ref.id !== space.club_id || page.clubId !== space.club_id) throw new Error('Saved grounds belong to a different club.');
            const choices = [...new Map(page.boxes.grounds.items.filter(ground => ground.name?.trim()).map(ground => [groundLocation(ground), ground])).values()];
            setGrounds(choices); setGroundError(false);
            const assignedId = page.boxes.squads.items.find(squad => squad.id === space.id)?.groundId;
            const suggestion = choices.find(ground => ground.id === assignedId) ?? (choices.length === 1 ? choices[0] : undefined);
            if (suggestion && !groundAnswered.current) {
                groundAnswered.current = true;
                setForm(current => current.locationName.trim() ? current : { ...current, locationName: groundLocation(suggestion) });
            }
        }).catch(() => { if (!abort.signal.aborted) { setGrounds([]); setGroundError(true); } });
        return () => abort.abort();
    }, [space.club_id, space.id, groundAttempt, pending]);
    useEffect(() => {
        const abort = new AbortController(), now = new Date();
        void api.sessions(space.id, abort.signal, { from: now.toISOString(), to: new Date(now.getTime() + 42 * 86400000).toISOString() }).then(sessions => {
            if (!abort.signal.aborted) {
                setExisting(sessions.filter(s => s.status !== 'CANCELLED' && (s.event_type ?? 'TRAINING') === 'TRAINING' && Date.parse(s.ends_at) > now.getTime()).length);
                setLoadError('');
            }
        }).catch(e => { if (!abort.signal.aborted) setLoadError(extractApiErrorMessage(e, copy('Current training could not load.', 'მიმდინარე ვარჯიშები ვერ ჩაიტვირთა.'))); });
        return () => abort.abort();
    }, [space.id, attempt, copy]);
    useEffect(() => {
        try { sessionStorage.setItem(draftKey, JSON.stringify(form)); sessionStorage.setItem(`${draftKey}:replies`, String(askFamilies)); } catch { /* Next must persist before it advances. */ }
    }, [draftKey, form, askFamilies]);
    const patch = (value: Partial<EventCreationFormValues>) => setForm(current => ({ ...current, ...value }));
    const changeGround = (locationName: string) => { groundAnswered.current = true; patch({ locationName }); };
    let plan: api.SquadEventPlan | null = null;
    try { plan = pending ? { ...pending.payload, requestId: pending.requestId } : squadEventPlan(formPayload(form), space.players.map(player => player.id), askFamilies, requestId); }
    catch { /* Incomplete fields remain editable; preview and save stay disabled. */ }
    const persist = (valid: boolean, message: string): GuideResult => {
        if (!valid) return { status: 'stay', message };
        try { sessionStorage.setItem(draftKey, JSON.stringify(form)); sessionStorage.setItem(`${draftKey}:replies`, String(askFamilies)); return { status: 'complete' }; }
        catch { return { status: 'stay', message: copy('Your browser could not keep this draft. Try again before continuing.', 'ბრაუზერმა მონახაზი ვერ შეინახა. გაგრძელებამდე სცადეთ ხელახლა.') }; }
    };
    const datesValid = !!form.recurrenceStartDate && !!form.recurrenceEndDate && form.recurrenceEndDate >= form.recurrenceStartDate &&
        !!durationMinutes(form.recurrenceStartTime ?? '', form.recurrenceEndTime ?? '') &&
        upcomingTrainingDates({ startDate: form.recurrenceStartDate!, endDate: form.recurrenceEndDate, daysOfWeek: form.recurrenceDays ?? [] }).length > 0;
    const save = async (): Promise<GuideResult> => {
        if (!isCurrentAuthSession(sessionId)) return { status: 'stay', message: copy('Your account changed. Reopen the squad.', 'ანგარიში შეიცვალა. ხელახლა გახსენით გუნდი.') };
        if (!plan || JSON.stringify(plan) !== reviewed || (!pending && (!datesValid || !form.locationName.trim()))) return { status: 'stay', message: copy('Review the current days, times, ground and invitations first.', 'ჯერ გადაამოწმეთ მიმდინარე დღეები, დრო, მოედანი და მოწვევები.') };
        try {
            const { requestId: _requestId, ...payload } = plan;
            void _requestId;
            const receipt = prepareReceipt(retryKey, payload); setPending(receipt);
            await api.createSquadEvent(space.id, { ...receipt.payload, requestId: receipt.requestId }, sessionId);
            if (!isCurrentAuthSession(sessionId)) return { status: 'stay' };
            savedDate.current = plan.startsAt.slice(0, 10);
            try {
                const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: plan.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(plan.startsAt)).map(part => [part.type, part.value]));
                const startDate = `${parts.year}-${parts.month}-${parts.day}`;
                savedDate.current = plan.repeat ? upcomingTrainingDates({ startDate, endDate: plan.repeat.endDate, daysOfWeek: plan.repeat.daysOfWeek, intervalValue: plan.repeat.intervalWeeks, weekAnchor: 'MONDAY' })[0] ?? startDate : startDate;
            } catch { /* Showing a date cannot undo an acknowledged save. */ }
            // Acknowledged success stays success even if browser cleanup fails afterward.
            try { clearReceipt(retryKey); sessionStorage.removeItem(draftKey); sessionStorage.removeItem(`${draftKey}:replies`); } catch { /* Any retained receipt retries the same acknowledged operation. */ }
            try { localStorage.removeItem(`gk-guide:squad-training:${scope}:${space.id}`); localStorage.removeItem(`gk-guide:squad-training:${scope}:${space.id}:hidden`); } catch { /* Guide position is optional; it cannot undo a saved plan. */ }
            return { status: 'complete' };
        } catch (error) {
            if (!isCurrentAuthSession(sessionId)) return { status: 'stay' };
            if (isAxiosError(error) && error.response && [400, 403, 404, 409].includes(error.response.status)) { clearReceipt(retryKey); setPending(null); }
            return { status: 'stay', message: extractApiErrorMessage(error, copy('The save could not be confirmed. Retry this saved plan before making another.', 'შენახვა ვერ დადასტურდა. ახალი გეგმის შექმნამდე გაიმეორეთ შენახული მოთხოვნა.')) };
        }
    };
    const tasks: GuideTask[] = [
        { id: 'days', title: copy('Which days do you train?', 'რომელ დღეებში ვარჯიშობთ?'), content: <fieldset className="sp-training-days" disabled={!!pending}>
            <legend className="sr-only">{copy('Training days', 'ვარჯიშის დღეები')}</legend>{DAYS.map(([day, en, ka]) => <label key={day}><input type="checkbox" checked={form.recurrenceDays?.includes(day) ?? false} onChange={e => patch({ recurrenceDays: e.target.checked ? [...(form.recurrenceDays ?? []), day] : form.recurrenceDays?.filter(value => value !== day) })} />{copy(en, ka)}</label>)}
        </fieldset>, next: () => persist(!!pending || !!form.recurrenceDays?.length, copy('Choose at least one training day.', 'აირჩიეთ ვარჯიშის ერთი დღე მაინც.')) },
        { id: 'times', title: copy('What time?', 'რომელ საათზე?'), content: <fieldset className="sp-training-fields" disabled={!!pending}>
            <p>{copy('Times in', 'დროის სარტყელი')}: <strong>{form.recurrenceTimezone}</strong></p>
            <div className="sp-training-pair"><label>{copy('Starts', 'დაწყება')}<input type="time" value={form.recurrenceStartTime} onChange={e => patch({ recurrenceStartTime: e.target.value })} /></label><label>{copy('Ends', 'დასრულება')}<input type="time" value={form.recurrenceEndTime} onChange={e => patch({ recurrenceEndTime: e.target.value })} /></label></div>
            <label>{copy('First week', 'პირველი კვირა')}<input type="date" value={form.recurrenceStartDate} onChange={e => patch({ recurrenceStartDate: e.target.value })} /></label>
            <label>{copy('Plan until', 'გეგმის ბოლო თარიღი')}<input type="date" min={form.recurrenceStartDate} value={form.recurrenceEndDate} onChange={e => patch({ recurrenceEndDate: e.target.value })} /></label>
        </fieldset>, next: () => persist(!!pending || datesValid, copy('Check the start, end and training dates.', 'შეამოწმეთ დაწყების, დასრულებისა და ვარჯიშის თარიღები.')) },
        { id: 'ground', title: copy('Which ground?', 'რომელ მოედანზე?'), content: <fieldset className="sp-training-fields" disabled={!!pending}>
            {grounds.length > 0 && <label>{copy('Saved club grounds', 'კლუბის შენახული მოედნები')}<select value={grounds.some(ground => groundLocation(ground) === form.locationName) ? form.locationName : ''} onChange={e => changeGround(e.target.value)}>
                <option value="">{copy('Other / enter an address', 'სხვა / ჩაწერეთ მისამართი')}</option>{grounds.map(ground => <option key={ground.id} value={groundLocation(ground)}>{groundLocation(ground)}</option>)}
            </select></label>}
            <label>{copy('Training ground and address', 'სავარჯიშო მოედანი და მისამართი')}<input value={form.locationName} maxLength={500} onChange={e => changeGround(e.target.value)} /></label>
            {groundError && <p className="sp-quiet" role="status">{copy('Saved grounds could not load. Enter the ground, or try again.', 'შენახული მოედნები ვერ ჩაიტვირთა. ჩაწერეთ მოედანი ან სცადეთ ხელახლა.')} <Button size="sm" onClick={() => setGroundAttempt(value => value + 1)}>{copy('Refresh saved grounds', 'შენახული მოედნების განახლება')}</Button></p>}
            <label>{copy('Training name', 'ვარჯიშის სახელი')}<input value={form.title} maxLength={200} onChange={e => patch({ title: e.target.value })} /></label>
            <label className="sp-training-check"><input type="checkbox" checked={askFamilies} onChange={e => setAskFamilies(e.target.checked)} />{copy('Ask families to confirm each date', 'სთხოვეთ ოჯახებს თითოეული თარიღის დადასტურება')}</label>
        </fieldset>, next: () => persist(!!pending || !!form.locationName.trim() && !!form.title.trim(), copy('Add the training ground and name.', 'ჩაწერეთ სავარჯიშო მოედანი და სახელი.')) },
        { id: 'review', title: copy('Ready to tell the families?', 'ვაცნობოთ ოჯახებს?'), canSkip: false, nextLabel: copy(pending ? 'Retry saved plan' : 'Save & send invitations', pending ? 'შენახული გეგმის გამეორება' : 'შენახვა და მოწვევების გაგზავნა'),
            content: plan ? <><p><strong>{plan.title}</strong> · {plan.location}</p>{pending && <p>{copy('This plan has an unconfirmed save. Its dates and invitation list are kept for a safe retry.', 'ამ გეგმის შენახვა დაუდასტურებელია. თარიღები და მოწვევის სია შენარჩუნებულია უსაფრთხო გამეორებისთვის.')}</p>}<PlanReview squadId={space.id} plan={plan} onReviewed={setReviewed} /></> : <p>{copy('Go back and check the training details.', 'დაბრუნდით და შეამოწმეთ ვარჯიშის მონაცემები.')}</p>,
            disabled: existing === null || !plan || JSON.stringify(plan) !== reviewed, next: save },
    ];
    return <section className="sp-box sp-training-setup" aria-label={copy('Training setup', 'ვარჯიშის დაგეგმვა')}>
        <div className="sp-training-bar"><h2>{copy('Set up training', 'ვარჯიშის დაგეგმვა')}</h2><Button size="sm" onClick={() => onClose()}>{copy('Close setup', 'დაგეგმვის დახურვა')}</Button></div>
        {loadError ? <p role="alert">{loadError} <Button size="sm" onClick={() => setAttempt(n => n + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button></p>
            : existing === null ? <p role="status">{copy('Checking current training…', 'მიმდინარე ვარჯიშების შემოწმება…')}</p>
                : <p className="sp-quiet">{existing ? copy(`${existing} sessions already planned in the next six weeks. Review any overlaps before adding this plan.`, `მომდევნო ექვს კვირაში უკვე დაგეგმილია ${existing} ვარჯიში. დამატებამდე შეამოწმეთ თარიღების დამთხვევა.`) : copy('Choose the days, times and ground with Dola.', 'დოლასთან ერთად აირჩიეთ დღეები, დრო და მოედანი.')}</p>}
        <GuidedFlow flowId={`squad-training:${scope}:${space.id}`} title={space.name} tasks={tasks} initialTaskId={pending ? 'review' : undefined} onFinish={() => onSaved(savedDate.current)} />
    </section>;
}
