import { useEffect, useId, useRef, useState } from 'react';
import { Check, MoreHorizontal } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchDetail, type Detail, type Person, type PlanStatus, type RoadmapView, type WorkNode } from './api';
import { planAsText } from './planAsText';
import type { Who } from './planPeople';
import { StatusDot } from './WorkBits';
import { ago, endWords } from './teamWorkWords';

/** All, the whole team, or one person: names only, one choice at a time. */
export function NameFilter({ team, who, allLabel, onChange }: { team: Person[]; who: Who; allLabel: string; onChange: (who: Who) => void }) {
    const copy = useJourneyCopy();
    if (team.length === 0) return null;
    const option = (value: Who, label: string) => <button key={String(value)} type="button" aria-pressed={who === value} onClick={() => onChange(value)}>{label}</button>;
    return <div className="tw-names" role="group" aria-label={copy('Show work for', 'ვისი საქმეები')}>
        {option(null, allLabel)}
        {option('team', copy('Whole team', 'მთელი გუნდი'))}
        {team.flatMap(person => person.id == null ? [] : [option(person.id, person.name ?? '—')])}
    </div>;
}

/**
 * The plan step by step: its top-level pieces in order as cards joined by a line, swiped or scrolled sideways.
 * Done steps are solid, the current one stands out, later ones are quiet; a card opens its piece above.
 */
export function StepStrip({ nodes, numbers, onOpen }: { nodes: WorkNode[]; numbers: Map<number, number>; onOpen: (id: number) => void }) {
    const copy = useJourneyCopy();
    const track = useRef<HTMLOListElement>(null);
    const current = nodes.find(node => node.item.status === 'IN_PROGRESS') ?? nodes.find(node => node.item.status !== 'FINISHED');
    useEffect(() => {
        const card = track.current?.querySelector<HTMLElement>('[data-state="current"]');
        if (track.current && card) track.current.scrollLeft = Math.max(0, card.offsetLeft - 16);
    }, [current?.item.id]);
    if (nodes.length === 0) return null;
    return <section className="tw-steps" aria-labelledby="tw-steps-title">
        <h2 id="tw-steps-title" className="tw-section__title">{copy('Step by step', 'ნაბიჯ-ნაბიჯ')}</h2>
        <ol ref={track} className="tw-steps__track">{nodes.map(node => {
            const item = node.item;
            const state = item.status === 'FINISHED' ? 'done' : node === current ? 'current' : 'later';
            return <li key={item.id} data-state={state} data-status={item.status}>
                <button type="button" onClick={() => onOpen(item.id)} aria-current={state === 'current' ? 'step' : undefined}>
                    <span className="tw-steps__top"><span className="tw-steps__number gk-num">{state === 'done' ? <Check aria-hidden="true" /> : numbers.get(item.id)}</span><StatusDot status={item.status} /><span className="gk-num tw-steps__percent">{item.percent}%</span></span>
                    <span className="tw-steps__name">{item.title}</span>
                    <span className="tw-steps__bar"><span style={{ width: `${item.percent}%` }} /></span>
                    <span className="tw-steps__when">{state === 'done' ? copy('done', 'დასრულდა') : item.end.kind === 'UNKNOWN' ? copy('end not set', 'ვადა არ არის') : `${copy('ends', 'დასრულება')} ${endWords(copy, item.end)}`}</span>
                </button>
            </li>;
        })}</ol>
    </section>;
}

const STATUSES: [PlanStatus, string, string][] = [['NOW', 'Working on it now', 'ახლა ვმუშაობთ'], ['LATER', 'Later', 'მოგვიანებით'], ['FINISHED', 'Finished', 'დასრულებული']];

/** The plan's extras behind "…": where it stands, Copy for AI, a new version, a new name, its history. */
export function PlanMenu({ status, onStatus, onCopyForAi, onCopy, onRename, onHistory }: {
    status: PlanStatus; onStatus: (status: PlanStatus) => void; onCopyForAi: () => void; onCopy: () => void; onRename: () => void; onHistory: () => void;
}) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const menuId = useId();
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
    }, [open]);
    const choose = (action: () => void) => () => { setOpen(false); action(); };
    return <div className="tw-menu" ref={box}>
        <Button size="sm" iconOnly variant="ghost" aria-label={copy('More for this plan', 'მეტი ამ გეგმისთვის')} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}><MoreHorizontal aria-hidden="true" /></Button>
        {open && <div className="tw-menu__list" id={menuId} role="menu">
            {STATUSES.map(([value, en, ka]) => <button key={value} type="button" role="menuitemradio" aria-checked={status === value} onClick={choose(() => { if (status !== value) onStatus(value); })}>
                <span className="tw-menu__check">{status === value && <Check aria-hidden="true" />}</span>{copy(en, ka)}
            </button>)}
            <hr />
            <button type="button" role="menuitem" onClick={choose(onCopyForAi)}><span className="tw-menu__check" />{copy('Copy for AI', 'კოპირება AI-სთვის')}</button>
            <button type="button" role="menuitem" onClick={choose(onCopy)}><span className="tw-menu__check" />{copy('Copy as new version', 'ასლი ახალ ვერსიად')}</button>
            <button type="button" role="menuitem" onClick={choose(onRename)}><span className="tw-menu__check" />{copy('Rename', 'სახელის შეცვლა')}</button>
            <button type="button" role="menuitem" onClick={choose(onHistory)}><span className="tw-menu__check" />{copy('Plan history', 'გეგმის ისტორია')}</button>
        </div>}
    </div>;
}

/** The plan as text for Claude or Codex, copied on open and shown so nobody wonders what went to the clipboard. */
export function CopyForAiDialog({ view, onClose }: { view: RoadmapView; onClose: () => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [text, setText] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        const ids = view.pieces.flatMap(node => [node.item.id, ...node.parts.map(part => part.id)]);
        let live = true;
        Promise.all(ids.map(item => fetchDetail(item).then(detail => [item, detail] as const).catch(() => null)))
            .then(found => {
                if (!live) return;
                const next = planAsText(view, new Map(found.filter((entry): entry is readonly [number, Detail] => entry !== null)));
                setText(next);
                void navigator.clipboard?.writeText(next).then(() => { if (live) setCopied(true); }).catch(() => undefined);
            });
        return () => { live = false; };
    }, [view]);
    return <Dialog open size="lg" className="tw-dialog" title={copy('Copy for AI', 'კოპირება AI-სთვის')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy('The plan in the Paste from AI format, with percents, dates, people, the last comments and file names. Give it to Claude or Codex, then paste their answer back: pieces match by name, so nothing doubles.',
            'გეგმა „ჩასმა AI-დან“ ფორმატში: პროცენტები, თარიღები, ხალხი, ბოლო კომენტარები და ფაილების სახელები. მიეცით Claude-ს ან Codex-ს და მათი პასუხი ისევ ჩასვით: საქმეები სახელით ემთხვევა, ასე რომ არაფერი გაორმაგდება.')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>
            <Button variant="primary" disabled={!text} onClick={() => { if (text) void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }}>{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button></>}>
        <label htmlFor={id} className="gk-visually-hidden">{copy('The plan as text', 'გეგმა ტექსტად')}</label>
        <textarea id={id} className="gk-input tw-paste__text" readOnly rows={14} value={text ?? copy('Gathering the plan…', 'გეგმა გროვდება…')} onFocus={event => event.target.select()} />
    </Dialog>;
}

/** Everything that happened to the plan: added, removed, reordered, renamed, pasted, moved between now and later. */
export function PlanHistoryDialog({ view, onClose }: { view: RoadmapView; onClose: () => void }) {
    const copy = useJourneyCopy();
    return <Dialog open size="md" className="tw-dialog" title={copy('Plan history', 'გეგმის ისტორია')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        <ol className="tw-history">{view.changes.map(change => <li key={change.id} className="tw-history__line">
            <span className="tw-history__who">{change.author?.name ?? copy('Someone', 'ვიღაც')} · {ago(copy, change.at)}</span>
            <span className="tw-history__message">{change.message}</span>
        </li>)}</ol>
    </Dialog>;
}
