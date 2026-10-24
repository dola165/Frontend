import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Bot, Check, ChevronDown, ChevronRight, Eye, Image as Picture, Inbox, Video } from 'lucide-react';
import { Button, FixtureRow } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeWork, type Detail, type Person, type WorkItem } from './api';
import { acknowledgedBy, droppedBy, isNewFor, namesOf, NOTE, seenOnlyBy, waitingOn } from './findings';
import { MentionText } from './MentionInput';
import { WorkComments } from './WorkComments';
import { WorkMediaList } from './WorkMedia';
import { ago } from './teamWorkWords';
import { taskAsText } from './planAsText';


/** Beside the files when a finding is open: its name and what it is for, which anyone on the team can write or change. */
function About({ detail, onPut }: { detail: Detail; onPut: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const save = async () => {
        if (draft === null) return;
        setError('');
        try { onPut(await changeWork(detail.item.id, { version: detail.item.version, description: draft.trim() })); setDraft(null); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
    };
    return <div className="tw-finding__about">
        <h3 className="tw-finding__title">{detail.item.title}</h3>
        {draft === null ? <>
            {detail.item.description ? <p className="tw-finding__purpose">{detail.item.description}</p> : <p className="gk-faint tw-finding__purpose">{copy('Nobody has written what it’s for yet.', 'რისთვისაა, ჯერ არავის დაუწერია.')}</p>}
            <span className="tw-row-actions"><button type="button" className="tw-link-button" onClick={() => setDraft(detail.item.description ?? '')}>{detail.item.description ? copy('Edit', 'რედაქტირება') : copy('Write what it’s for', 'დაწერეთ რისთვისაა')}</button>
                <button type="button" className="tw-link-button" onClick={() => void navigator.clipboard?.writeText(taskAsText(detail, window.location.href)).then(() => setCopied(true))}><Bot aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy for AI', 'კოპირება AI-სთვის')}</button></span>
        </> : <form className="tw-field" onSubmit={event => { event.preventDefault(); void save(); }}>
            <label htmlFor={id}>{copy('What it’s for', 'რისთვისაა')}</label>
            <textarea id={id} className="gk-input" rows={3} maxLength={400} autoFocus value={draft} onChange={event => setDraft(event.target.value)} />
            <span className="tw-row-actions"><Button size="sm" variant="primary" type="submit">{copy('Save', 'შენახვა')}</Button><Button size="sm" variant="ghost" onClick={() => setDraft(null)}>{copy('Cancel', 'გაუქმება')}</Button></span>
        </form>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}

/** A short menu behind one button: "Make it a task" on its own or in a plan. Escape or a click outside closes it. */
export function PickMenu({ label, icon, options, disabled, onPick }: { label: string; icon: ReactNode; options: { key: string; label: string }[]; disabled?: boolean; onPick: (key: string) => void }) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const menuId = useId();
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
    }, [open]);
    return <div className="tw-menu" ref={box}>
        <Button size="sm" disabled={disabled} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>{icon}{label}<ChevronDown aria-hidden="true" /></Button>
        {open && <div className="tw-menu__list" id={menuId} role="menu">
            {options.map(option => <button key={option.key} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(option.key); }}><span className="tw-menu__check" />{option.label}</button>)}
        </div>}
    </div>;
}

/**
 * A finding as one row, in the agenda's look: the time, a symbol for what it holds (picture, video or nothing yet)
 * tinted when it waits on you (amber) or is new to you (green), the name and what it is for, then who dropped it,
 * where it stands in words and the page's next step. Pressed, it opens under the row: who acknowledged it or only
 * looked, Seen and Acknowledge, its files, what it is for and the whole thread.
 */
export function FindingRow({ item, detail, team, me, open, time, day, state, line, next, fresh = false, newAsks = true, onOpen, onPut }: {
    item: WorkItem; detail?: Detail; team: Person[]; me: number | null; open: boolean; time: ReactNode; day?: ReactNode;
    /** Where it stands, in words; by default who it waits on, or who acknowledged it. */ state?: string;
    /** One more fact for the opened finding, such as who pushed it. */ line?: ReactNode;
    next?: ReactNode; fresh?: boolean;
    /** Whether a finding new to you asks you to acknowledge it first (Ideas); on Waiting only being tagged does. */ newAsks?: boolean;
    onOpen: (id: number | null) => void; onPut: (detail: Detail) => void;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const acknowledged = detail ? acknowledgedBy(detail) : [];
    const seen = detail ? seenOnlyBy(detail) : [];
    const waiting = waitingOn(detail, team);
    const by = detail ? droppedBy(detail) : null;
    const mine = (people: Person[]) => me != null && people.some(person => person.id === me);
    const media = detail?.media ?? [];
    const icon = media.some(file => file.kind === 'IMAGE') ? Picture : media.length ? Video : Inbox;
    const tone = mine(waiting) ? 'var(--gk-warning)' : detail && isNewFor(detail, me) ? 'var(--gk-accent)' : 'var(--gk-text-3)';
    const words = state ?? (waiting.length ? copy(`Waiting for ${namesOf(copy, waiting, me)}`, `ელოდება: ${namesOf(copy, waiting, me)}`)
        : acknowledged.length ? copy(`Acknowledged by ${namesOf(copy, acknowledged, me)}`, `გაითვალისწინა: ${namesOf(copy, acknowledged, me)}`)
        : copy('Not acknowledged yet', 'ჯერ არავინ გაითვალისწინა'));
    // When it waits on you, your next step is to acknowledge it; otherwise the page's own (push it on, make it a task).
    const yours = detail != null && !mine(acknowledged) && (mine(waiting) || (newAsks && isNewFor(detail, me)));
    const about = detail?.item.description ?? item.description;
    const toggle = () => onOpen(open ? null : item.id);
    const note = async (update: string) => {
        if (!detail) return;
        setBusy(true); setError('');
        try { onPut(await changeWork(item.id, { version: detail.item.version, update })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <>
        <FixtureRow tone="neutral" time={time} day={day} icon={icon} iconColor={tone}
            title={<span className="tw-finding__name" title={item.title} data-fresh={fresh || undefined}>{item.title}</span>}
            meta={about ? about : detail?.comments[0] ? <MentionText text={detail.comments[0].body} team={team} me={me} /> : undefined}
            trail={<span className="tw-finding__trail">
                <span className="tw-finding__state">{by?.name && <span className="tw-finding__by">{by.name} · </span>}<span className="tw-finding__words" data-me={mine(waiting) || undefined}>{words}</span></span>
                {yours ? <Button size="sm" disabled={busy} title={copy('I’ll keep it in mind', 'გავითვალისწინებ')} onClick={() => void note(NOTE.acknowledged)}><Check aria-hidden="true" />{copy('Acknowledge', 'გავითვალისწინე')}</Button> : next}
                <button type="button" className="tw-icon-button tw-finding__toggle" tabIndex={-1} aria-hidden="true" onClick={toggle}>{open ? <ChevronDown /> : <ChevronRight />}</button>
            </span>}
            onClick={toggle} label={`${item.title}. ${words}`} />
        {error && <li className="tw-finding__error"><p className="gk-notice gk-notice--danger" role="alert">{error}</p></li>}
        {open && <li className="tw-finding__open" aria-label={item.title}>
            {!detail ? <p className="gk-muted" role="status">{copy('Loading…', 'იტვირთება…')}</p> : <>
                <div className="tw-finding__facts">
                    {line}
                    <span>{[by?.name, ago(copy, item.createdAt)].filter(Boolean).join(' · ')}</span>
                    {acknowledged.length > 0 && <span className="tw-finding__ok"><Check aria-hidden="true" />{copy(`Acknowledged by ${namesOf(copy, acknowledged, me)}`, `გაითვალისწინა: ${namesOf(copy, acknowledged, me)}`)}</span>}
                    {seen.length > 0 && <span><Eye aria-hidden="true" />{copy(`Seen by ${namesOf(copy, seen, me)}`, `ნახა: ${namesOf(copy, seen, me)}`)}</span>}
                    <span className="tw-row-actions tw-finding__actions">
                        {!mine(acknowledged) && !mine(seen) && by?.id !== me && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void note(NOTE.seen)}><Eye aria-hidden="true" />{copy('Seen', 'ვნახე')}</Button>}
                        {!mine(acknowledged) && !yours && <Button size="sm" variant="ghost" disabled={busy} title={copy('I’ll keep it in mind', 'გავითვალისწინებ')} onClick={() => void note(NOTE.acknowledged)}><Check aria-hidden="true" />{copy('Acknowledge', 'გავითვალისწინე')}</Button>}
                    </span>
                </div>
                <div className="tw-finding__top"><WorkMediaList itemId={item.id} media={detail.media} onChanged={onPut} /><About detail={detail} onPut={onPut} /></div>
                <WorkComments itemId={item.id} comments={detail.comments} team={team} me={me} onChanged={comments => onPut({ ...detail, comments })} />
            </>}
        </li>}
    </>;
}
