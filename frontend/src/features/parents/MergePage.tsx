import { useEffect, useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Avatar, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../design/primitives';
import { extractApiErrorCode, extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { answerMerge, fetchMerges, undoMerge, type PersonMerge } from './familyLinks';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import '../pages/pages.css';
import '../pages/links/join.css';

const first = (name: string | null) => (name ?? '').trim().split(/\s+/)[0];

/**
 * One join of two cards (the notice opens it): "Is this the same player?" with Join them / Not the same when it waits
 * for me, or the joined card with Undo while the 30 days last.
 */
export function MergePage() {
    const { id = '' } = useParams();
    const copy = useJourneyCopy();
    const field = useId();
    const [merge, setMerge] = useState<PersonMerge | null | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [askDate, setAskDate] = useState(false);
    const [birthDate, setBirthDate] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchMerges(controller.signal).then(all => setMerge(all.find(m => String(m.id) === id) ?? null)).catch(() => { if (!controller.signal.aborted) setMerge(null); });
        return () => controller.abort();
    }, [id]);
    const act = async (run: () => Promise<PersonMerge>) => {
        if (busy) return;
        setBusy(true); setError('');
        try { setMerge(await run()); setAskDate(false); } catch (failure) {
            if (extractApiErrorCode(failure) === 'MERGE_BIRTH_DATE') { setAskDate(true); setError(copy('The two cards have different birth dates. Enter the right one.', 'ბარათებზე სხვადასხვა დაბადების თარიღია. შეიყვანეთ სწორი.')); }
            else setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };
    const spinner = busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null;
    const failure = error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>;
    const pair = merge && <div className="gk-ctowns">
        <span className="gk-chip"><Avatar name={merge.keptName ?? ''} size={22} />{merge.keptName}</span>
        <span aria-hidden="true">=</span>
        <span className="gk-chip"><Avatar name={merge.joinedName ?? ''} size={22} />{merge.joinedName}{merge.clubName ? ` · ${merge.clubName}` : ''}</span>
    </div>;
    const body = merge === undefined ? <div role="status"><Skeleton height={56} /></div>
        : merge === null ? <Panel><EmptyNote title={copy('This is no longer available.', 'ეს აღარ არის ხელმისაწვდომი.')} action={<ButtonLink to="/parent">{copy('Open Parent Hub', 'Parent Hub-ის გახსნა')}</ButtonLink>} /></Panel>
        : <Panel padded>
            <h2 className="gk-join__question">{merge.status === 'PROPOSED' ? copy('Is this the same player?', 'ეს იგივე მოთამაშეა?')
                : merge.status === 'DONE' ? copy(`${first(merge.keptName)}’s two cards are now one`, `${first(merge.keptName)}-ის ორი ბარათი ახლა ერთია`)
                : merge.status === 'UNDONE' ? copy('The two cards are apart again', 'ბარათები ისევ ცალ-ცალკეა')
                : copy('Not the same player', 'სხვადასხვა მოთამაშეა')}</h2>
            {pair}
            {merge.status === 'DONE' && merge.undoUntil && <p className="gk-field__hint">{copy(`Everything is in one place. You can undo this until ${formatDate(merge.undoUntil, { day: 'numeric', month: 'long' })}.`, `ყველაფერი ერთ ადგილასაა. გაუქმება შეგიძლიათ ${formatDate(merge.undoUntil, { day: 'numeric', month: 'long' })}-მდე.`)}</p>}
            {askDate && <div><label className="gk-field__label" htmlFor={`${field}-dob`}>{copy('Birth date', 'დაბადების თარიღი')}</label><input id={`${field}-dob`} className="gk-input gk-join__date" type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} /></div>}
            {failure}
            <div className="gk-boxedit__foot">
                {merge.status === 'PROPOSED' && merge.waitingForMe && <>
                    <Button variant="primary" disabled={busy || (askDate && !birthDate)} onClick={() => void act(() => answerMerge(merge.id, true, askDate ? birthDate : null))}>{spinner}{copy('Join them', 'გაერთიანება')}</Button>
                    <Button disabled={busy} onClick={() => void act(() => answerMerge(merge.id, false))}>{copy('Not the same', 'სხვადასხვაა')}</Button>
                </>}
                {merge.status === 'DONE' && merge.undoUntil && <Button disabled={busy} onClick={() => void act(() => undoMerge(merge.id))}>{spinner}{copy('Undo', 'გაუქმება')}</Button>}
                {merge.status !== 'PROPOSED' && <ButtonLink variant={merge.status === 'DONE' ? 'ghost' : 'primary'} to={`/parent?player=${merge.keptId}`}><Check aria-hidden="true" />{copy('Open Parent Hub', 'Parent Hub-ის გახსნა')}</ButtonLink>}
            </div>
        </Panel>;
    return <GkRoot className="gk-page gk-join"><PageFrame width="profile"><Section title={copy('One card', 'ერთი ბარათი')}>{body}</Section></PageFrame></GkRoot>;
}
