import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Eye, Inbox, MessageSquare, Play } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useMediaSource } from '../../hooks/useMediaSource';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeWork, type Detail, type Person, type WorkItem } from './api';
import { acknowledgedBy, droppedBy, isNewFor, NOTE, seenOnlyBy, taggedIn } from './findings';
import { MentionText } from './MentionInput';
import { WorkComments } from './WorkComments';
import { WorkMediaList } from './WorkMedia';
import { ago } from './teamWorkWords';

type Copy = ReturnType<typeof useJourneyCopy>;
const namesOf = (copy: Copy, people: Person[], me: number | null) => people.map(person => person.id === me ? copy('you', 'თქვენ') : person.name ?? '—').join(', ');

/** The finding's first file as its face: the picture, or a play mark for a video. */
function Face({ detail }: { detail: Detail | undefined }) {
    const first = detail?.media.find(media => media.kind === 'IMAGE') ?? detail?.media[0];
    const src = useMediaSource(first?.kind === 'IMAGE' ? first.url : undefined);
    const more = (detail?.media.length ?? 0) - 1;
    return <span className="tw-finding__face">
        {src ? <img src={src} alt="" /> : first?.kind === 'VIDEO' ? <Play aria-hidden="true" /> : <Inbox aria-hidden="true" />}
        {more > 0 && <span className="tw-finding__more gk-num">+{more}</span>}
    </span>;
}

/** A short menu behind one button: "Make it a task" on its own or in a project. */
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
 * A finding: its picture, name, who dropped it and the first comment, then where it stands: who acknowledged it
 * (they keep it in mind), who was tagged and has not yet, who only looked. Anyone can mark it seen, acknowledge it
 * or comment; the page adds its own next step. Opened, it shows every file and the whole thread.
 */
export function FindingCard({ item, detail, team, me, open, line, next, onOpen, onPut }: {
    item: WorkItem; detail?: Detail; team: Person[]; me: number | null; open: boolean; line?: ReactNode; next?: ReactNode;
    onOpen: (id: number | null) => void; onPut: (detail: Detail) => void;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const acknowledged = detail ? acknowledgedBy(detail) : [];
    const seen = detail ? seenOnlyBy(detail) : [];
    const waiting = (detail ? taggedIn(detail, team) : []).filter(person => !acknowledged.some(other => other.id === person.id));
    const by = detail ? droppedBy(detail) : null;
    const mine = (people: Person[]) => me != null && people.some(person => person.id === me);
    const note = async (update: string) => {
        if (!detail) return;
        setBusy(true); setError('');
        try { onPut(await changeWork(item.id, { version: detail.item.version, update })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <li className="tw-finding" data-new={(detail && isNewFor(detail, me)) || undefined} data-open={open || undefined}>
        <button type="button" className="tw-finding__main" aria-expanded={open} onClick={() => onOpen(open ? null : item.id)}>
            <Face detail={detail} />
            <span className="tw-finding__text">
                <span className="tw-finding__name">{item.title}</span>
                <span className="tw-finding__who">{[by?.name, ago(copy, item.createdAt)].filter(Boolean).join(' · ')}</span>
                {detail?.comments[0] && <span className="tw-finding__comment"><MentionText text={detail.comments[0].body} team={team} me={me} /></span>}
            </span>
        </button>
        <div className="tw-finding__state">
            {line}
            {acknowledged.length > 0 && <span className="tw-finding__ok"><Check aria-hidden="true" />{copy(`Acknowledged by ${namesOf(copy, acknowledged, me)}`, `გაითვალისწინა: ${namesOf(copy, acknowledged, me)}`)}</span>}
            {waiting.length > 0 ? <span className="tw-finding__wait" data-me={mine(waiting) || undefined}><span className="tw-dot" aria-hidden="true" />{copy(`Waiting for ${namesOf(copy, waiting, me)}`, `ელოდება: ${namesOf(copy, waiting, me)}`)}</span>
                : acknowledged.length === 0 && <span className="tw-finding__wait"><span className="tw-dot" aria-hidden="true" />{copy('Not acknowledged yet', 'ჯერ არავინ გაითვალისწინა')}</span>}
            {seen.length > 0 && <span className="tw-finding__seen"><Eye aria-hidden="true" />{copy(`Seen by ${namesOf(copy, seen, me)}`, `ნახა: ${namesOf(copy, seen, me)}`)}</span>}
        </div>
        <div className="tw-finding__actions">
            {detail && !mine(acknowledged) && !mine(seen) && by?.id !== me && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void note(NOTE.seen)}><Eye aria-hidden="true" />{copy('Seen', 'ვნახე')}</Button>}
            {detail && !mine(acknowledged) && <Button size="sm" variant="ghost" disabled={busy} title={copy('I’ll keep it in mind', 'გავითვალისწინებ')} onClick={() => void note(NOTE.acknowledged)}><Check aria-hidden="true" />{copy('Acknowledge', 'გავითვალისწინე')}</Button>}
            <Button size="sm" variant="ghost" aria-expanded={open} aria-label={detail?.comments.length ? copy(`Comments: ${detail.comments.length}`, `კომენტარები: ${detail.comments.length}`) : undefined}
                onClick={() => onOpen(open ? null : item.id)}><MessageSquare aria-hidden="true" />{detail?.comments.length ? <span className="gk-num">{detail.comments.length}</span> : copy('Comment', 'კომენტარი')}</Button>
            {next && <span className="tw-finding__next">{next}</span>}
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open && detail && <div className="tw-finding__open">
            <WorkMediaList itemId={item.id} media={detail.media} onChanged={onPut} />
            <WorkComments itemId={item.id} comments={detail.comments} team={team} me={me} onChanged={comments => onPut({ ...detail, comments })} />
        </div>}
    </li>;
}
