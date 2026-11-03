import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Check, Megaphone } from 'lucide-react';
import { Avatar, Button, Section, Skeleton } from '../../../design/primitives';
import { MessageText } from '../../../components/chat/MessageText';
import { relativeTime } from '../../../utils/relativeTime';
import * as api from '../../squadCommunication/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useMarkSeen, useNoticeLines } from '../../squadCommunication/notices/useNoticeLines';
import type { JoiningChild } from '../api';
import { firstName } from './childFacts';
import { childPath } from './childParams';
import { squadTag } from './familyEvents';
import './parent-hub.css';

type Update = { squad: api.SquadOverview; message: api.SquadMessage };
/** An update or a Notify line, in one list by time. */
type Item = { kind: 'update'; at: number; update: Update } | { kind: 'notice'; at: number; squad: api.SquadOverview; notice: api.NoticeLine };
/** On the page: what waits for "I've read it" first, then the newest, three in all. */
const SHOWN = 3;

/**
 * From the coaches: the updates of every squad the child plays in and the coaches' Notify lines sent to this parent
 * (M12), newest first, each marked with its squad. Where the coach asked, the one action is "I've read it"; a family's
 * answer counts on the coach's update. A Notify line shown here counts as seen for its sender. A long update shows its
 * first lines with "Read more"; `all` lists every one in full, and an old link to one update (`#squad-update-12`)
 * opens on it. "All updates" is always there once there is one.
 */
export function CoachUpdates({ squads, child, all = false }: { squads: api.SquadOverview[]; child: JoiningChild; all?: boolean }) {
    const copy = useJourneyCopy();
    const [state, setState] = useState<{ key: string; updates: Update[]; error: boolean } | null>(null);
    const [revision, setRevision] = useState(0);
    const key = `${squads.map(squad => squad.id).join(',')}:${revision}`;
    useEffect(() => {
        const abort = new AbortController();
        void Promise.allSettled(squads.map(async squad => (await api.messages(squad.id, 'ANNOUNCEMENT', null, abort.signal)).map(message => ({ squad, message }))))
            .then(results => {
                if (abort.signal.aborted) return;
                const updates = results.flatMap(r => r.status === 'fulfilled' ? r.value : []).sort((a, b) => Date.parse(b.message.created_at) - Date.parse(a.message.created_at));
                setState({ key, updates, error: results.some(r => r.status === 'rejected') });
            });
        return () => abort.abort();
    }, [key, squads]);
    const notices = useNoticeLines(squads.map(squad => squad.id), revision);
    const first = firstName(child);
    const waiting = (u: Update) => u.message.acknowledgement_requested && !u.message.acknowledged_at;
    const bySquad = new Map(squads.map(squad => [squad.id, squad]));
    const items: Item[] = [
        ...(state?.updates ?? []).map((update): Item => ({ kind: 'update', at: Date.parse(update.message.created_at), update })),
        ...notices.lines.flatMap(({ squadId, notice }): Item[] => bySquad.has(squadId) ? [{ kind: 'notice', at: Date.parse(notice.createdAt), squad: bySquad.get(squadId)!, notice }] : []),
    ].sort((a, b) => b.at - a.at);
    const isWaiting = (item: Item) => item.kind === 'update' && waiting(item.update);
    const ordered = [...items.filter(isWaiting), ...items.filter(item => !isWaiting(item))];
    const shown = all ? items : ordered.slice(0, SHOWN);
    useMarkSeen(shown.flatMap(item => item.kind === 'notice' ? [{ squadId: item.squad.id, notice: item.notice }] : []));
    const { hash } = useLocation();
    const ready = state?.key === key && !notices.loading;
    useEffect(() => { if (all && ready && hash.startsWith('#squad-update-')) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }); }, [all, ready, hash]);
    return <Section boxed icon={Megaphone} tone="accent" title={copy('From the coaches', 'მწვრთნელებისგან')} className="ph-section ph-updates" id="updates"
        action={!all && items.length > 0 ? <Link className="gk-section__action" to={childPath(child.playerId, { view: 'updates' })}>{copy('All updates ›', 'ყველა განახლება ›')}</Link> : undefined}>
        {!ready ? <Skeleton height={110} />
            : shown.length ? <ul className="ph-updates__list">{shown.map(item => item.kind === 'update'
                ? <UpdateRow key={`u:${item.update.squad.id}:${item.update.message.id}`} update={item.update} several={squads.length > 1} full={all} onChanged={() => setRevision(n => n + 1)} />
                : <NoticeRow key={`n:${item.notice.id}`} squad={item.squad} notice={item.notice} several={squads.length > 1} />)}</ul>
            : <p className="ph-quiet">{copy(`No updates for ${first}’s squads yet.`, `${first}-ს გუნდებისთვის განახლებები ჯერ არ არის.`)}</p>}
        {(state?.error || notices.error) && <p className="ph-quiet" role="alert">{copy('Some updates couldn’t load.', 'ზოგი განახლება ვერ ჩაიტვირთა.')} <button type="button" className="ph-link" onClick={() => setRevision(n => n + 1)}>{copy('Try again', 'ხელახლა ცდა')}</button></p>}
    </Section>;
}

/** A coach's Notify line: one line, who sent it and when. No replies (a later step). */
function NoticeRow({ squad, notice, several }: { squad: api.SquadOverview; notice: api.NoticeLine; several: boolean }) {
    return <li className="ph-update ph-update--notice" id={`squad-notice-${notice.id}`}>
        <header className="ph-update__head"><span className="ph-update__bell" aria-hidden="true"><Bell /></span>
            <span><strong>{notice.line}</strong><small>{notice.authorName} · {relativeTime(notice.createdAt)}</small></span>
            {several && <span className="ph-tag" title={squad.name}>{squadTag(squad.name)}</span>}
        </header>
    </li>;
}

/** One update; `full`: shown whole (the full list), else its first lines with "Read more" when there is more. */
function UpdateRow({ update, several, full, onChanged }: { update: Update; several: boolean; full: boolean; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const { squad, message } = update;
    const id = useId();
    const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
    const [open, setOpen] = useState(full), [clipped, setClipped] = useState(false);
    const body = useRef<HTMLParagraphElement>(null);
    useLayoutEffect(() => {
        const element = body.current;
        if (!element || open) return;
        const measure = () => setClipped(element.scrollHeight > element.clientHeight + 1);
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(element);
        return () => observer?.disconnect();
    }, [open, message.body]);
    const read = async () => {
        setBusy(true); setFailed(false);
        try { await api.acknowledge(squad.id, message.id); onChanged(); } catch { setFailed(true); } finally { setBusy(false); }
    };
    return <li className="ph-update" id={`squad-update-${message.id}`}>
        <header className="ph-update__head"><Avatar name={message.author_name} size={28} />
            <span><strong>{message.title || message.author_name}</strong><small>{message.title ? `${message.author_name} · ` : ''}{relativeTime(message.created_at)}</small></span>
            {several && <span className="ph-tag" title={squad.name}>{squadTag(squad.name)}</span>}
        </header>
        <p ref={body} id={`${id}-body`} className="ph-update__body" data-open={open || undefined}><MessageText text={message.body} /></p>
        {!full && (clipped || open) && <button type="button" className="ph-link ph-update__more" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(value => !value)}>
            {open ? copy('Show less', 'ნაკლების ჩვენება') : copy('Read more', 'სრულად წაკითხვა')}</button>}
        {message.acknowledgement_requested && <footer className="ph-update__foot">
            {message.acknowledged_at ? <span className="ph-done"><Check aria-hidden="true" />{copy('You’ve read it', 'წაკითხულია')}</span>
                : <Button size="sm" variant="primary" disabled={busy} onClick={() => void read()} data-guide="read-it"><Check aria-hidden="true" />{copy('I’ve read it', 'წავიკითხე')}</Button>}
            {failed && <span className="ph-quiet" role="alert">{copy('Couldn’t save · Try again', 'ვერ შეინახა · სცადეთ ხელახლა')}</span>}
        </footer>}
    </li>;
}
