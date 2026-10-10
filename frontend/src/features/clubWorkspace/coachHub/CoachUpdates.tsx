import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar, ButtonLink, Count, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { DataTable, EMPTY_CELL, FilterSelect, ListToolbar, PrimaryCell, Status, type Column, type RowGroup } from '../../../design/DataTable';
import { AnnouncementComposer } from '../../announcements/AnnouncementComposer';
import { isPinned } from '../../announcements/pinning';
import * as squadApi from '../../squadCommunication/api';
import { dayLabel, isToday, timeLabel } from '../fixtures';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

interface UpdateRow { squad: number; squadName: string; families: number; update: squadApi.SquadMessage }

/** Who has read an important update and who hasn't, loaded when its row opens. */
function Readers({ row }: { row: UpdateRow }) {
    const [list, setList] = useState<squadApi.Receipt[] | null | 'error'>(null);
    useEffect(() => {
        let alive = true;
        squadApi.receipts(row.squad, row.update.id).then(value => { if (alive) setList(value); }).catch(() => { if (alive) setList('error'); });
        return () => { alive = false; };
    }, [row.squad, row.update.id]);
    const open = <ButtonLink size="sm" variant="ghost" to={`/squads/${row.squad}`}>Open in {row.squadName}</ButtonLink>;
    if (!row.update.important) return <div className="ch-details"><p className="ch-quiet">Families were not asked to confirm this one.</p>{open}</div>;
    if (list === null) return <div className="ch-details" role="status"><Skeleton height={16} width="60%" /></div>;
    if (list === 'error') return <div className="ch-details"><p className="ch-quiet">Who has read it could not be loaded.</p>{open}</div>;
    const missing = list.filter(item => !item.acknowledged_at), read = list.filter(item => item.acknowledged_at);
    return <div className="ch-details">
        <p><strong>{missing.length ? `Not read yet (${missing.length})` : 'Everyone has read it'}</strong>{missing.length > 0 && <> · {missing.map(item => item.full_name).join(', ')}</>}</p>
        {read.length > 0 && <p className="ch-quiet">Read: {read.map(item => item.full_name).join(', ')}</p>}
        {open}
    </div>;
}

/**
 * Coach updates: write one to one or several squads, see which are still pinned and who has read the
 * important ones, and answer families' private messages.
 */
export function CoachUpdates({ data }: { data: CoachData }) {
    const [params, setParams] = useSearchParams();
    const squadFilter = data.mine.some(squad => String(squad.id) === params.get('squad')) ? Number(params.get('squad')) : null;
    const { now, names } = data;
    const setSquad = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('squad', value); else next.delete('squad'); next.delete('compose'); setParams(next, { replace: true }); };

    const rows = useMemo(() => (data.squads ?? []).flatMap(squad => squad.updates.map((update): UpdateRow => ({
        squad: squad.id, squadName: names.get(squad.id) ?? '', families: squad.overview?.threads.length ?? 0, update,
    }))).sort((a, b) => b.update.created_at.localeCompare(a.update.created_at)), [data.squads, names]);
    const shown = rows.filter(row => squadFilter === null || row.squad === squadFilter);
    const groups: RowGroup<UpdateRow>[] = [
        { key: 'pinned', label: 'Pinned now', rows: shown.filter(row => isPinned(row.update, now)) },
        { key: 'earlier', label: 'Earlier', rows: shown.filter(row => !isPinned(row.update, now)) },
    ];
    const columns: Column<UpdateRow>[] = [
        { id: 'update', label: 'Update', width: 'minmax(260px, 3fr)', render: row => <PrimaryCell title={row.update.title ?? 'Update'} subtitle={row.update.body.split('\n')[0]} /> },
        { id: 'squad', label: 'Squad', width: 'minmax(100px, 1fr)', render: row => row.squadName },
        { id: 'posted', label: 'Posted', width: '110px', render: row => <span className="gk-dt-date">{dayLabel(row.update.created_at, now)}{isToday(row.update.created_at, now) ? ` ${timeLabel(row.update.created_at)}` : ''}</span> },
        { id: 'read', label: 'Read', width: 'minmax(130px, 1fr)', render: row => {
            if (!row.update.important) return <span className="gk-dt-muted">Not asked</span>;
            if (!row.families) return EMPTY_CELL;
            const read = Math.min(row.update.acknowledged_by?.length ?? 0, row.families);
            return <Status tone={read >= row.families ? 'accent' : isPinned(row.update, now) ? 'warning' : 'neutral'}>{read} of {row.families} families</Status>;
        } },
        { id: 'comments', label: 'Comments', width: '100px', render: row => row.update.comment_count ? `${row.update.comment_count}` : EMPTY_CELL },
    ];

    const threads = (data.squads ?? []).flatMap(squad => (squad.overview?.threads ?? []).filter(thread => thread.unread_count > 0).map(thread => ({ ...thread, squad: squad.id })))
        .sort((a, b) => b.unread_count - a.unread_count);

    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Updates" subtitle="What you tell families and players, who has read it, and what they tell you." />
        <div className="gk-grid gk-grid--split">
            <div className="gk-stack">
                <AnnouncementComposer key={`${params.get('compose') ?? ''}:${squadFilter ?? ''}`} spaces={data.mine} initialSquads={squadFilter ? [squadFilter] : undefined}
                    startOpen={params.get('compose') === '1'} onPosted={data.refresh} />
                <Section title="Sent updates">
                    <div className="gk-stack gk-stack--tight">
                        {data.mine.length > 1 && <ListToolbar count={`${shown.length} ${shown.length === 1 ? 'update' : 'updates'}`}>
                            <FilterSelect label="Squad" allLabel="All" value={squadFilter ? String(squadFilter) : ''} onChange={setSquad} options={data.mine.map(squad => ({ value: String(squad.id), label: squad.name }))} />
                        </ListToolbar>}
                        {!data.squads ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading updates">{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
                            : shown.length ? <DataTable label="Sent updates" columns={columns} groups={groups} rowKey={row => `${row.squad}-${row.update.id}`} details={row => <Readers row={row} />} />
                                : <Panel><EmptyNote title="No updates yet">Updates you post to your squads appear here with who has read them.</EmptyNote></Panel>}
                    </div>
                </Section>
            </div>
            <div className="gk-stack">
                <Section boxed title="Messages from families" hint={threads.length ? `${threads.reduce((total, thread) => total + thread.unread_count, 0)} unread` : undefined}>
                    <Panel flush>
                        {!data.squads ? <div className="cw-skeleton-rows" role="status" aria-label="Loading messages">{[0, 1].map(i => <Skeleton key={i} height={40} />)}</div>
                            : threads.length ? <List label="Messages from families">{threads.map(thread => <ListRow key={`${thread.squad}-${thread.user_id}`}
                                to={`/messages?squadId=${thread.squad}&channel=coach&thread=${thread.user_id}`} lead={<Avatar name={thread.full_name} size={28} />}
                                title={thread.full_name} meta={names.get(thread.squad)} trail={<><Count value={thread.unread_count} /><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />)}</List>
                                : <EmptyNote title="No new messages">Private messages from families appear here.</EmptyNote>}
                        <div className="gk-panel__foot ch-links">{data.mine.map(squad => <span key={squad.id}>
                            <Link className="cw-text-button" to={`/messages?squadId=${squad.id}&channel=coach`}>{squad.name}: families</Link>
                            <Link className="cw-text-button" to={`/messages?squadId=${squad.id}`}>squad chat</Link>
                        </span>)}</div>
                    </Panel>
                </Section>
            </div>
        </div>
    </PageFrame>;
}
