import type { ReactNode } from 'react';
import { FileText, Film, Folder, Lightbulb, MessageSquare, Sparkles, UserRound } from 'lucide-react';
import { useMediaSource } from '../../hooks/useMediaSource';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WorkStatus } from '../teamWork/api';
import { ago, statusName } from '../teamWork/teamWorkWords';
import { StatusDot } from '../teamWork/WorkBits';
import type { SearchFile, SearchHit, SearchMark } from './api';
import { fileName, kindName, planStatusName, when, whyLabel } from './searchWords';

type Copy = ReturnType<typeof useJourneyCopy>;
const TASKS = new Set(['TASK', 'STEP', 'IDEA', 'WAITING']);

/** The words with the matched ones marked. */
export function Marked({ text, marks }: { text: string; marks: SearchMark[] }) {
    const parts: ReactNode[] = [];
    let at = 0;
    for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
        if (mark.start < at || mark.end > text.length || mark.end <= mark.start) continue;
        if (mark.start > at) parts.push(text.slice(at, mark.start));
        parts.push(<mark key={mark.start}>{text.slice(mark.start, mark.end)}</mark>);
        at = mark.end;
    }
    if (at < text.length) parts.push(text.slice(at));
    return <>{parts}</>;
}

/** A picture's small copy, fetched with the person's sign-in (team files only); other files by their kind. */
function Thumb({ file }: { file: SearchFile }) {
    const src = useMediaSource(file.kind === 'IMAGE' ? file.thumbUrl ?? file.url : undefined);
    if (file.kind === 'IMAGE') return <span className="tw-search-row__thumb" aria-hidden="true">{src && <img src={src} alt="" />}</span>;
    return <span className="tw-search-row__thumb tw-search-row__thumb--icon" aria-hidden="true">{file.kind === 'VIDEO' ? <Film aria-hidden="true" /> : <FileText aria-hidden="true" />}</span>;
}

function Icon({ hit }: { hit: SearchHit }) {
    if (hit.file) return <Thumb file={hit.file} />;
    const icon = hit.kind === 'PLAN' ? <Folder aria-hidden="true" /> : hit.kind === 'NOW' ? <UserRound aria-hidden="true" />
        : hit.kind === 'MESSAGE' ? <MessageSquare aria-hidden="true" /> : hit.kind === 'IDEA' || hit.kind === 'WAITING' ? <Lightbulb aria-hidden="true" /> : null;
    if (icon) return <span className="tw-search-row__icon" aria-hidden="true">{icon}</span>;
    // The status is said in words on the line below; the dot only shows it.
    return <span className="tw-search-row__icon" aria-hidden="true">{hit.where.status && <StatusDot status={hit.where.status as WorkStatus} />}</span>;
}

/** Where it is, in one quiet line: key, status and plan; the task of a step; the chat, who and when. */
function whereParts(copy: Copy, hit: SearchHit): ReactNode[] {
    const where = hit.where, parts: ReactNode[] = [];
    const about = where.tasks?.[0];
    if (TASKS.has(hit.kind)) {
        if (where.key) parts.push(<span key="key" className="tw-key-chip gk-num" data-marked={hit.why?.field === 'KEY' || undefined}>{where.key}</span>);
        if (where.status) parts.push(statusName(copy, where.status as WorkStatus));
        if (hit.kind === 'STEP' && where.parent) parts.push(copy(`step of ${where.parent.key} ${where.parent.title}`, `ნაბიჯი: ${where.parent.key} ${where.parent.title}`));
        if (hit.kind === 'IDEA' || hit.kind === 'WAITING') parts.push(kindName(copy, hit.kind));
        if (where.person && (hit.kind === 'IDEA' || hit.kind === 'WAITING')) parts.push(copy(`dropped by ${where.person.name}`, `დაამატა ${where.person.name}`));
        if (where.plan) parts.push(copy(`plan ${where.plan.name}`, `გეგმა ${where.plan.name}`));
    } else if (hit.kind === 'PLAN') {
        parts.push(kindName(copy, 'PLAN'));
        const status = planStatusName(copy, where.status);
        if (status) parts.push(status);
        if (where.openTasks != null) parts.push(copy(`${where.openTasks} open`, `${where.openTasks} ღია`));
    } else if (hit.kind === 'NOW') {
        parts.push(copy('Now note', 'ახლა რას აკეთებს'));
        if (where.at) parts.push(ago(copy, where.at));
    } else {
        if (hit.kind === 'TASK_FILE' && about) parts.push(copy(`on ${about.key} ${about.title}`, `საქმეზე ${about.key} ${about.title}`));
        if (where.chat) parts.push(where.chat.name === 'Team chat' ? copy('Team chat', 'გუნდის ჩატი') : where.chat.name ?? copy('Chat', 'ჩატი'));
        if (where.person && hit.kind !== 'MESSAGE') parts.push(where.person.name);
        const at = when(copy, where.at);
        if (at) parts.push(at);
        if (hit.kind !== 'TASK_FILE' && about) parts.push(copy(`about ${about.key} ${about.title}`, `${about.key} ${about.title}`));
    }
    return parts;
}

/**
 * One result, in the order the team reads it: the short name first, then why it matched (the matched words marked),
 * then where it is.
 */
export function SearchRow({ hit, id, active, onOpen, onHover }: { hit: SearchHit; id: string; active: boolean; onOpen: () => void; onHover: () => void }) {
    const copy = useJourneyCopy();
    const why = hit.why;
    const named = why && (why.field === 'NAME' || why.field === 'KEY');
    const title = hit.file ? fileName(copy, hit.file, hit.title) : hit.kind === 'NOW' ? copy(`${hit.title ?? ''}’s Now note`, `${hit.title ?? ''} — ახლა`) : hit.title ?? '—';
    const label = why && !named ? whyLabel(copy, why) : null;
    const parts = whereParts(copy, hit);
    return <li id={id} role="option" aria-selected={active} className="tw-search-row" data-active={active || undefined} onClick={onOpen} onMouseMove={onHover}>
        <Icon hit={hit} />
        <span className="tw-search-row__text">
            <span className="tw-search-row__title">{why?.field === 'NAME' ? <Marked text={why.text} marks={why.marks} /> : title}</span>
            {why && !named && (why.field === 'MEANING'
                ? <span className="tw-search-row__why tw-search-row__why--meaning"><Sparkles aria-hidden="true" />{copy('Picked by meaning, not by the words', 'შერჩეულია აზრით, არა სიტყვებით')}</span>
                : <span className="tw-search-row__why">{label && <span className="tw-search-row__label">{label}: </span>}<Marked text={why.text} marks={why.marks} /></span>)}
            {parts.length > 0 && <span className="tw-search-row__where">{parts.map((part, index) => <span key={index}>{part}</span>)}</span>}
        </span>
    </li>;
}
