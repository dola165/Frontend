import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, ButtonLink, Field, Panel } from '../../../design/primitives';
import * as squadApi from '../../squadCommunication/api';
import { assertCurrentAuthSession, getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { appLanguage } from '../../../utils/formatting';

interface Props { clubId: number; squadId: number; squadName: string; actorId: number }
const text = (en: string, ka: string) => appLanguage() === 'ka' ? ka : en;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
function validOverview(value: squadApi.SquadOverview, { clubId, squadId, actorId }: Pick<Props, 'clubId' | 'squadId' | 'actorId'>) {
    return value?.id === squadId && value.club_id === clubId && value.viewer_id === actorId
        && typeof value.can_assign_coach === 'boolean' && (value.head_coach_id === null || positive(value.head_coach_id))
        && Array.isArray(value.coaches) && Array.isArray(value.available_coaches)
        && [...value.coaches, ...value.available_coaches].every(coach => positive(coach?.user_id) && typeof coach.full_name === 'string' && coach.full_name.trim());
}

/** Management can assign a coach without claiming to coach the squad itself. Canonical access is read first. */
export function SquadCoachAssignment(props: Props) {
    return <AssignmentSession key={`${props.clubId}:${props.squadId}:${props.actorId}:${getAuthSessionId()}`} {...props} />;
}
function AssignmentSession(props: Props) {
    const { clubId, squadId, squadName, actorId } = props, fieldId = useId();
    const [sessionId] = useState(getAuthSessionId);
    const [space, setSpace] = useState<squadApi.SquadOverview | null>(null), [choice, setChoice] = useState('');
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [retired, setRetired] = useState(false);
    const [error, setError] = useState(''), [needsReview, setNeedsReview] = useState(false);
    const [saved, setSaved] = useState<{ id: number; name: string } | null>(null);
    const active = useRef(false), busy = useRef(false), request = useRef(0), controller = useRef<AbortController | null>(null);
    const read = useCallback(async () => {
        if (!active.current || !isCurrentAuthSession(sessionId)) return;
        controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
        const attempt = ++request.current; setLoading(true); setError('');
        try {
            assertCurrentAuthSession(sessionId);
            const value = await squadApi.overview(squadId, abort.signal);
            if (!active.current || abort.signal.aborted || request.current !== attempt || !isCurrentAuthSession(sessionId)) return;
            if (!validOverview(value, { clubId, squadId, actorId })) {
                setSpace(null); setNeedsReview(true); setError(text('Coach details could not be confirmed for this squad.', 'ამ გუნდის მწვრთნელის მონაცემები ვერ დადასტურდა.')); return;
            }
            setSpace(value); setChoice(value.head_coach_id === null ? '' : String(value.head_coach_id)); setNeedsReview(false);
        } catch (failure) {
            if (!active.current || abort.signal.aborted || request.current !== attempt || !isCurrentAuthSession(sessionId)) return;
            setSpace(null); setNeedsReview(true); setError(extractApiErrorMessage(failure, text('Could not load coach details.', 'მწვრთნელის მონაცემები ვერ ჩაიტვირთა.')));
        } finally { if (active.current && request.current === attempt) setLoading(false); }
    }, [clubId, squadId, actorId, sessionId]);
    useEffect(() => {
        active.current = true; void read();
        const retire = () => { if (!isCurrentAuthSession(sessionId)) { controller.current?.abort(); setRetired(true); } };
        const unsubscribe = subscribeAuthSession(retire);
        return () => { active.current = false; controller.current?.abort(); unsubscribe(); };
    }, [read, sessionId]);
    const save = async () => {
        const selected = Number(choice);
        if (!active.current || busy.current || retired || loading || needsReview || !space?.can_assign_coach
            || !positive(selected) || selected === space.head_coach_id || !space.available_coaches.some(coach => coach.user_id === selected)) return;
        if (!isCurrentAuthSession(sessionId)) { setRetired(true); return; }
        busy.current = true; setSaving(true); setError('');
        const name = space.available_coaches.find(coach => coach.user_id === selected)!.full_name;
        try {
            assertCurrentAuthSession(sessionId);
            await squadApi.assignCoach(squadId, selected, sessionId);
            if (!active.current || !isCurrentAuthSession(sessionId)) return;
            // A confirmed write is kept distinct from the following read. Retry only that read if it fails.
            setSaved({ id: selected, name }); setNeedsReview(true); await read();
        } catch (failure) {
            if (!active.current || !isCurrentAuthSession(sessionId)) return;
            setNeedsReview(true); setError(extractApiErrorMessage(failure, text('Coach change not confirmed. Refresh this squad before trying again.', 'მწვრთნელის შეცვლა არ დადასტურებულა. ხელახლა ცდამდე განაახლეთ გუნდის მონაცემები.')));
        } finally { busy.current = false; if (active.current) setSaving(false); }
    };
    const currentName = space?.coaches.find(coach => coach.user_id === space.head_coach_id)?.full_name
        ?? space?.available_coaches.find(coach => coach.user_id === space.head_coach_id)?.full_name;
    const currentMissing = space?.head_coach_id != null && !space.available_coaches.some(coach => coach.user_id === space.head_coach_id);
    return <Panel padded title={text('Head coach', 'მთავარი მწვრთნელი')}>
        {retired ? <p role="status">{text('Your sign-in changed. Reopen this club before changing its coach.', 'თქვენი სესია შეიცვალა. მწვრთნელის შეცვლამდე ხელახლა გახსენით კლუბი.')}</p> : <div className="gk-stack gk-stack--tight">
            {saved && <div role="status" className="gk-notice cw-notices__success"><span>{text(`Coach saved: ${saved.name}.`, `მწვრთნელი შენახულია: ${saved.name}.`)}</span>{saved.id === actorId && <ButtonLink size="sm" to={`/my-squads?clubId=${clubId}`}>{text('My squads', 'ჩემი გუნდები')}</ButtonLink>}</div>}
            {loading && <p role="status">{text('Checking coach details…', 'მწვრთნელის მონაცემები მოწმდება…')}</p>}
            {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
            {space && !loading && space.can_assign_coach && <p>{text('Current head coach:', 'მიმდინარე მთავარი მწვრთნელი:')} {currentName ?? (space.head_coach_id === null ? text('Not assigned', 'არ არის დანიშნული') : `#${space.head_coach_id}`)}</p>}
            {space && !loading && (space.can_assign_coach ? space.available_coaches.length ? <form className="gk-stack gk-stack--tight" onSubmit={event => { event.preventDefault(); void save(); }}>
                <Field htmlFor={fieldId} label={text('Head coach', 'მთავარი მწვრთნელი')}><select id={fieldId} className="gk-input" value={choice} disabled={saving || needsReview} onChange={event => { setChoice(event.target.value); setSaved(null); }}>
                    <option value="">{text('Choose a club coach', 'აირჩიეთ კლუბის მწვრთნელი')}</option>
                    {currentMissing && <option value={String(space.head_coach_id)} disabled>{currentName ?? text(`Coach #${space.head_coach_id}`, `მწვრთნელი #${space.head_coach_id}`)}</option>}
                    {space.available_coaches.map(coach => <option key={coach.user_id} value={String(coach.user_id)}>{coach.full_name}</option>)}
                </select></Field>
                <div><Button type="submit" disabled={saving || needsReview || !choice || Number(choice) === space.head_coach_id}>{saving ? text('Saving…', 'ინახება…') : text('Save coach', 'მწვრთნელის შენახვა')}</Button></div>
            </form> : <p>{text('No eligible club coaches are available yet.', 'შესაფერისი კლუბის მწვრთნელი ჯერ არ არის ხელმისაწვდომი.')}</p>
                : <p>{text('View only. Current head coach:', 'მხოლოდ ნახვა. მიმდინარე მთავარი მწვრთნელი:')} {currentName ?? (space.head_coach_id === null ? text('Not assigned', 'არ არის დანიშნული') : `#${space.head_coach_id}`)}</p>)}
            {(error || needsReview) && <div><Button size="sm" disabled={saving || loading} onClick={() => void read()}>{text('Refresh coach details', 'მწვრთნელის მონაცემების განახლება')}</Button></div>}
            <span className="gk-faint">{squadName}</span>
        </div>}
    </Panel>;
}
