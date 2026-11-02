import { useEffect, useId, useState } from 'react';
import { Bell } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, Chip } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from './journeyCopy';
import { noticeReach, notifySquad, type NoticeAudience, type NoticeReach } from './api';
import './squad-notify.css';

interface Squad { id: number; name: string }

/**
 * Notify a squad: pick the squad (when you coach several), who should hear it (the whole squad, its parents, its
 * players or its staff, with how many each reaches), write one line, send. They get it at once in the bell, on their
 * phone and by email where they have it on; a child's phone and email only say there is an update.
 */
function NotifySquadDialog({ squads, initial, onClose }: { squads: Squad[]; initial: number; onClose: () => void }) {
    const copy = useJourneyCopy();
    const lineId = useId();
    const [squad, setSquad] = useState(initial);
    const [audience, setAudience] = useState<NoticeAudience>('EVERYONE');
    const [reach, setReach] = useState<NoticeReach | null | 'error'>(null);
    const [line, setLine] = useState('');
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [told, setTold] = useState<number | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setReach(null);
        noticeReach(squad, controller.signal).then(value => { if (!controller.signal.aborted) setReach(value); }).catch(() => { if (!controller.signal.aborted) setReach('error'); });
        return () => controller.abort();
    }, [squad]);
    const choices: { value: NoticeAudience; label: string; count: (r: NoticeReach) => number }[] = [
        { value: 'EVERYONE', label: copy('Whole squad', 'მთელი გუნდი'), count: r => r.everyone },
        { value: 'PARENTS', label: copy('Parents', 'მშობლები'), count: r => r.parents },
        { value: 'PLAYERS', label: copy('Players', 'მოთამაშეები'), count: r => r.players },
        { value: 'STAFF', label: copy('Staff', 'პერსონალი'), count: r => r.staff },
    ];
    const chosen = reach && reach !== 'error' ? choices.find(choice => choice.value === audience)!.count(reach) : null;
    const change = (next: () => void) => { setError(''); setRequestId(crypto.randomUUID()); next(); };
    const send = async () => {
        if (!line.trim()) { setError(copy('Write what they should know.', 'დაწერეთ, რა უნდა იცოდნენ.')); return; }
        if (chosen === 0) { setError(copy('Nobody to tell in that group yet.', 'ამ ჯგუფში ჯერ არავინაა.')); return; }
        setBusy(true); setError('');
        try { setTold((await notifySquad(squad, { requestId, audience, line: line.trim() })).told); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be sent.', 'ვერ გაიგზავნა.'))); }
        finally { setBusy(false); }
    };
    const squadName = squads.find(item => item.id === squad)?.name ?? '';
    return <Dialog open size="sm" className="sq-notify-dialog" title={copy('Who should hear?', 'ვინ უნდა გაიგოს?')} description={squadName} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={told !== null ? <Button variant="primary" onClick={onClose}>{copy('Done', 'მზადაა')}</Button>
            : <><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || reach === null} onClick={() => void send()}><Bell aria-hidden="true" />{busy ? copy('Sending…', 'იგზავნება…') : chosen ? copy(`Send to ${chosen}`, `გაეგზავნოს ${chosen}-ს`) : copy('Send', 'გაგზავნა')}</Button></>}>
        {told !== null ? <p className="sq-notify__done" role="status">{told
            ? copy(`Sent to ${told} ${told === 1 ? 'person' : 'people'} in ${squadName}.`, `გაეგზავნა ${told} ადამიანს (${squadName}).`)
            : copy('Nobody to tell in that group yet.', 'ამ ჯგუფში ჯერ არავინაა.')}</p>
            : <form className="sq-notify" onSubmit={event => { event.preventDefault(); void send(); }}>
                {squads.length > 1 && <div className="sq-notify__row" role="group" aria-label={copy('Squad', 'გუნდი')}>
                    {squads.map(item => <Chip key={item.id} pressed={item.id === squad} onClick={() => change(() => setSquad(item.id))}>{item.name}</Chip>)}
                </div>}
                <div className="sq-notify__row" role="group" aria-label={copy('Who should hear?', 'ვინ უნდა გაიგოს?')}>
                    {choices.map(choice => <Chip key={choice.value} pressed={choice.value === audience} onClick={() => change(() => setAudience(choice.value))}>
                        {choice.label}{reach && reach !== 'error' && <span className="sq-notify__count">{choice.count(reach)}</span>}
                    </Chip>)}
                </div>
                {reach === 'error' && <p className="gk-notice gk-notice--danger" role="alert">{copy('Couldn’t see who is in this squad.', 'ვერ ჩაიტვირთა, ვინ არის გუნდში.')}</p>}
                <div className="sq-notify__field">
                    <label htmlFor={lineId} className="sq-notify__label">{copy('What should they know, in one line', 'რა უნდა იცოდნენ, ერთი ხაზით')}</label>
                    <input id={lineId} className="gk-input" maxLength={200} value={line} placeholder={copy('Tomorrow’s training moves to 18:00.', 'ხვალინდელი ვარჯიში 18:00-ზე გადაიტანება.')} onChange={event => change(() => setLine(event.target.value))} />
                </div>
                <p className="sq-notify__hint">{copy('They get it at once in the app and on their phone, and by email where they have it on. A child’s phone only says there’s an update.', 'მიიღებენ მაშინვე აპში და ტელეფონზე, ელფოსტითაც, თუ ჩართული აქვთ. ბავშვის ტელეფონზე მხოლოდ ჩანს, რომ სიახლეა.')}</p>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            </form>}
    </Dialog>;
}

/** The Notify button on My squads: opens on the squad in focus, or the first one you coach. */
export function NotifySquadButton({ squads, focus }: { squads: Squad[]; focus: number | null }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    if (!squads.length) return null;
    return <>
        <Button variant="secondary" onClick={() => setOpen(true)}><Bell aria-hidden="true" />{copy('Notify', 'შეტყობინება')}</Button>
        {open && <NotifySquadDialog squads={squads} initial={focus && squads.some(squad => squad.id === focus) ? focus : squads[0].id} onClose={() => setOpen(false)} />}
    </>;
}
