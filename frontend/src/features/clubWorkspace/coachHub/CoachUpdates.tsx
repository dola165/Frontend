import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, MessageCircle, Pin, Plus, Trash2, Users } from 'lucide-react';
import { Avatar, ButtonLink, Count, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { FaceStack, ProgressRing } from '../../../design/visuals';
import { AnnouncementComposer } from '../../announcements/AnnouncementComposer';
import { isPinned } from '../../announcements/pinning';
import * as squadApi from '../../squadCommunication/api';
import { UpdateInteractions } from '../../squadCommunication/UpdateInteractions';
import { SquadNotificationToggle } from '../../squadCommunication/SquadNotificationToggle';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { dayLabel, isToday, timeLabel } from '../fixtures';
import { SquadSwitch } from './CoachVisuals';
import { MessageParentsDialog } from './MessageParentsDialog';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

interface UpdateRow { squad: number; squadName: string; families: number; update: squadApi.SquadMessage; space: squadApi.SquadOverview }

/** Who hasn't read an important update yet, as faces with names, loaded when asked for. */
function Readers({ row }: { row: UpdateRow }) {
    const [list, setList] = useState<squadApi.Receipt[] | null | 'error'>(null);
    useEffect(() => {
        let alive = true;
        squadApi.receipts(row.squad, row.update.id).then(value => { if (alive) setList(value); }).catch(() => { if (alive) setList('error'); });
        return () => { alive = false; };
    }, [row.squad, row.update.id]);
    if (list === null) return <div className="ch-update__readers" role="status"><Skeleton height={26} width="50%" /></div>;
    if (list === 'error') return <p className="ch-update__readers ch-quiet">Who has read it could not be loaded.</p>;
    const missing = list.filter(item => !item.acknowledged_at);
    return <div className="ch-update__readers">{missing.length
        ? <><FaceStack people={missing.map(item => ({ id: item.user_id, name: item.full_name, tone: 'warning' as const }))} max={10} size={26} label="Not read yet" />
            <span className="ch-quiet">Not read yet: {missing.map(item => item.full_name).join(', ')}</span></>
        : <span className="ch-quiet">Every parent or guardian has read it.</span>}</div>;
}

/** One update as a card: who posted it where and when, what it says, how many families have read it, reactions and comments. */
function UpdateCard({ row, now, onChanged }: { row: UpdateRow; now: number; onChanged: () => void }) {
    const [open, setOpen] = useState(false), [removing, setRemoving] = useState(false), [error, setError] = useState('');
    const own = row.update.author_id === row.space.viewer_id;
    const remove = async () => {
        if (removing || !window.confirm('Delete this update for every parent and guardian?')) return;
        setRemoving(true); setError('');
        try { await squadApi.removeMessage(row.squad, row.update.id); onChanged(); }
        catch (cause) { setError(extractApiErrorMessage(cause, 'The update could not be deleted.')); setRemoving(false); }
    };
    const { update } = row, read = Math.min(update.acknowledged_by?.length ?? 0, row.families), pinned = isPinned(update, now);
    return <article className="ch-update">
        <header className="ch-update__head">
            <Avatar name={update.author_name} size={34} />
            <span className="ch-update__who"><strong>{update.author_name}</strong><span>{row.squadName} · {dayLabel(update.created_at, now)}{isToday(update.created_at, now) ? ` ${timeLabel(update.created_at)}` : ''}</span></span>
            {pinned && <span className="ch-update__pin"><Pin aria-hidden="true" />Pinned</span>}
        </header>
        {update.title && <h3 className="ch-update__title">{update.title}</h3>}
        <p className="ch-update__body">{update.body}</p>
        <footer className="ch-update__foot">
            {update.important && row.families ? <button type="button" className="ch-update__reads" aria-expanded={open} onClick={() => setOpen(value => !value)}>
                <ProgressRing value={read} total={row.families} tone={read >= row.families ? 'accent' : pinned ? 'warning' : 'neutral'} />
                <span><strong>{read} of {row.families}</strong> parents read it</span>
            </button> : <span className="ch-quiet">No read confirmation asked</span>}
            {own && <button type="button" className="ch-update__delete" disabled={removing} onClick={() => void remove()}><Trash2 aria-hidden="true" />Delete</button>}
        </footer>
        {open && <Readers row={row} />}
        <UpdateInteractions space={row.space} message={update} onChanged={onChanged} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </article>;
}

/** Coach updates as a feed: write one to one or several squads, see who has read them, and answer families' private messages. */
export function CoachUpdates({ data, embedded }: { data: CoachData; embedded?: boolean }) {
    const [params] = useSearchParams();
    const [writing, setWriting] = useState(false);
    const { now, names } = data;
    const squads = data.squads?.filter(squad => data.shown.includes(squad.id)) ?? null;
    const rows = (squads ?? []).flatMap(squad => squad.overview ? squad.updates.map((update): UpdateRow => ({ squad: squad.id, squadName: names.get(squad.id) ?? '', families: squad.overview!.threads.length, update, space: squad.overview! })) : [])
        .sort((a, b) => b.update.created_at.localeCompare(a.update.created_at));
    const threads = (squads ?? []).flatMap(squad => (squad.overview?.threads ?? []).filter(thread => thread.unread_count > 0).map(thread => ({ ...thread, squad: squad.id })))
        .sort((a, b) => b.unread_count - a.unread_count);

    // The grid alone serves the squad page; on its own tab it gets the frame, the title and the switcher.
    const body = <>
        <div className="gk-grid gk-grid--split">
            <div className="gk-stack">
                <AnnouncementComposer key={`${params.get('compose') ?? ''}:${data.focus ?? ''}`} spaces={data.mine.filter(squad => data.shown.includes(squad.id))}
                    initialSquads={data.focus ? [data.focus] : undefined} startOpen={params.get('compose') === '1'} onPosted={data.refresh} />
                {!squads ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading updates">{[0, 1].map(i => <Skeleton key={i} height={140} />)}</div></Panel>
                    : rows.length ? <ul className="ch-feed">{rows.map(row => <li key={`${row.squad}-${row.update.id}`}><UpdateCard row={row} now={now} onChanged={data.refresh} /></li>)}</ul>
                        : <Panel><EmptyNote title="No updates yet">Your first announcement to parents and guardians appears here.</EmptyNote></Panel>}
            </div>
            <div className="gk-stack">
                <Section boxed title="Messages from parents & guardians" hint={threads.length ? `${threads.reduce((total, thread) => total + thread.unread_count, 0)} new` : undefined}
                    action={<button type="button" className="gk-section__action cw-text-button" onClick={() => setWriting(true)}>+ Message several parents</button>}>
                    <Panel flush>
                        {!squads ? <div className="cw-skeleton-rows" role="status" aria-label="Loading messages">{[0, 1].map(i => <Skeleton key={i} height={40} />)}</div>
                            : threads.length ? <List label="Messages from parents and guardians">{threads.map(thread => <ListRow key={`${thread.squad}-${thread.user_id}`}
                                to={`/messages?squadId=${thread.squad}&channel=coach&thread=${thread.user_id}`} lead={<Avatar name={thread.full_name} size={32} />}
                                title={thread.full_name} meta={names.get(thread.squad)} trail={<><Count value={thread.unread_count} /><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />)}</List>
                                : <EmptyNote title="All answered">New messages from parents and guardians appear here.</EmptyNote>}
                    </Panel>
                </Section>
                {/* Each squad has two places to talk: a private line to every family, and one chat for everyone. */}
                <Section boxed title="Chats" hint="Where your squads talk">
                    <Panel flush><List label="Chats">{(squads ?? []).flatMap(squad => squad.overview ? [
                        <ListRow key={`${squad.id}-families`} to={`/messages?squadId=${squad.id}&channel=coach`} lead={<span className="ch-chat ch-chat--families"><MessageCircle aria-hidden="true" /></span>}
                            title={`${names.get(squad.id)} parents & guardians`} meta="Private: each parent writes to you alone" trail={<ChevronRight className="cw-chevron" aria-hidden="true" />} />,
                        <ListRow key={`${squad.id}-squad`} to={`/messages?squadId=${squad.id}`} lead={<span className="ch-chat ch-chat--squad"><Users aria-hidden="true" /></span>}
                            title={`${names.get(squad.id)} squad chat`} meta="Everyone together: players, parents and coaches"
                            trail={<><span onClick={event => event.stopPropagation()} className="ch-chat__notify"><SquadNotificationToggle id={squad.id} enabled={squad.overview.notify_chat} onSaved={data.refresh} label="Notify me" quiet /></span><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />,
                    ] : [])}</List></Panel>
                </Section>
            </div>
        </div>
        {writing && <MessageParentsDialog data={data} onClose={() => setWriting(false)} />}
    </>;
    if (embedded) return body;
    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Updates" actions={<ButtonLink variant="primary" to={data.link('updates', { compose: '1' })}><Plus aria-hidden="true" />New announcement</ButtonLink>} />
        <SquadSwitch data={data} />
        {body}
    </PageFrame>;
}
