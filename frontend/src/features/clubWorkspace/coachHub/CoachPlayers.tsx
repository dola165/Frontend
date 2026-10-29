import { useMemo, useState, type ReactNode } from 'react';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Goal, HeartPulse, LayoutGrid, List as ListIcon, PenLine, Trash2, UserPlus } from 'lucide-react';
import { removePlayerFromSquad } from '../../clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Avatar, Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton } from '../../../design/primitives';
import { RosterDialog } from './RosterDialog';
import { Segmented } from '../../../design/Tabs';
import { DataTable, EMPTY_CELL, ListToolbar, PrimaryCell, ViewTabs, type Column } from '../../../design/DataTable';
import { nextSort, sortRows, type TableSort } from '../../../design/tableSort';
import type { OperationRecord } from '../../clubOperations/api';
import type { SquadRosterPlayer } from '../../../components/squads/SquadRosterTable';
import { positionCode, squadLabel } from '../../../components/squads/squadLabels';
import { WorkspacePlayerPanel } from '../../clubOperations/WorkspacePlayerPanel';
import { withoutScope } from '../../clubOperations/scopedParams';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { PlayerCard } from '../squads/PlayerCard';
import { dueWords } from '../fixtures';
import { SquadSwitch } from './CoachVisuals';
import { WantToJoin } from './WantToJoin';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

interface PlayerRow { player: SquadRosterPlayer; group: string; squad: number; restriction?: OperationRecord; consent?: OperationRecord; review?: OperationRecord }

const GROUPS = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards'];
const FILTERS: { id: string; label: 'filterEveryone' | 'filterRestricted' | 'filterTrial' | 'filterConsent'; test: (row: PlayerRow) => boolean }[] = [
    { id: 'all', label: 'filterEveryone', test: () => true },
    { id: 'restricted', label: 'filterRestricted', test: row => Boolean(row.restriction) },
    { id: 'trial', label: 'filterTrial', test: row => row.player.status === 'TRIALIST' },
    { id: 'consent', label: 'filterConsent', test: row => Boolean(row.consent) },
];

/**
 * My squads' players: who wants to join on top (for those who decide it, step 3), then the squad as football cards, by
 * position: photo, shirt number, position, age and the signs a coach plans around (a restriction, consent waiting on a
 * parent, a development review). Who's coming belongs to a planned session, so it is shown there, not here. A card
 * opens the player's notes and tools.
 */
export function CoachPlayers({ data }: { data: CoachData }) {
    const { t } = useTranslation();
    const copy = useCopy('coachHub', coachHubEn);
    const [params, setParams] = useSearchParams();
    // "Add your players" on a squad with nobody yet opens the roster straight away (roster=1).
    const [roster, setRosterOpen] = useState(params.get('roster') === '1');
    const setRoster = (open: boolean) => {
        setRosterOpen(open);
        if (!open && params.has('roster')) setParams(current => { const next = new URLSearchParams(current); next.delete('roster'); return next; }, { replace: true });
    };
    const [removing, setRemoving] = useState<number | null>(null);
    const query = params.get('q') ?? '';
    const filter = FILTERS.find(item => item.id === params.get('view')) ?? FILTERS[0];
    const table = params.get('layout') === 'table';
    const sortBy = params.get('sort'), descending = params.get('dir') === 'desc';
    const sort = useMemo<TableSort | null>(() => sortBy ? { by: sortBy, descending } : null, [sortBy, descending]);
    const set = (changes: Record<string, string | null>, push = false) => {
        // A tool opened beside a player closes with the player.
        const next = 'player' in changes && !changes.player ? withoutScope(params, 'tool') : new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
        setParams(next, { replace: !push });
    };

    const rosters = data.rosters?.filter(roster => data.shown.includes(roster.id)) ?? null;
    const rows: PlayerRow[] = (rosters ?? []).flatMap(roster => (roster.groups ?? []).flatMap(group => group.players.map(player => {
        const about = data.records.rows.filter(record => record.subject_user_id === player.id);
        return { player, group: group.label, squad: roster.id,
            restriction: about.find(record => record.module === 'AVAILABILITY'), consent: about.find(record => record.module === 'GUARDIANS' && record.status === 'PENDING'),
            review: about.filter(record => record.module === 'DEVELOPMENT').sort((a, b) => (a.data.reviewOn ?? a.due_on ?? '9999').localeCompare(b.data.reviewOn ?? b.due_on ?? '9999'))[0] };
    })));
    const needle = query.trim().toLocaleLowerCase();
    const shown = rows.filter(row => filter.test(row) && (!needle || row.player.name.toLocaleLowerCase().includes(needle) || String(row.player.number ?? '') === needle));
    const several = data.shown.length > 1;
    const errors = rosters?.filter(roster => roster.error).map(roster => roster.error) ?? [];

    const signs = (row: PlayerRow) => {
        const due = row.review && dueWords(row.review.data.reviewOn ?? row.review.due_on, data.now);
        return <>
            {row.restriction && <span className="pc-sign pc-sign--injury" title={`${copy('filterRestricted')}: ${row.restriction.data.restrictions || row.restriction.title}`}><HeartPulse aria-hidden="true" /><span className="gk-visually-hidden">{copy('filterRestricted')}</span></span>}
            {row.consent && <span className="pc-sign pc-sign--consent" title={`${copy('consentAwaiting')}: ${row.consent.title}`}><PenLine aria-hidden="true" /><span className="gk-visually-hidden">{copy('consentAwaiting')}</span></span>}
            {row.review && <span className={`pc-sign${due?.late ? ' pc-sign--injury' : ''}`} title={`${row.review.title}${due ? ` · ${due.late ? due.text : copy('reviewOnDate', { date: due.text })}` : ''}`}><Goal aria-hidden="true" /><span className="gk-visually-hidden">{copy('developmentReview')}</span></span>}
        </>;
    };
    const openRow = (row: PlayerRow) => set({ player: `${row.squad}-${row.player.id}` }, true);
    const open = rows.find(row => `${row.squad}-${row.player.id}` === params.get('player'));
    // Taking a player out of a squad happens wherever the player is seen: the card, the sheet, the roster dialog.
    const canManage = data.roles.leadership;
    const remove = async (row: PlayerRow) => {
        if (removing || !window.confirm(copy('removeConfirm', { name: row.player.name, squad: data.names.get(row.squad) ?? '' }))) return;
        setRemoving(row.player.id);
        try { await removePlayerFromSquad(data.clubId, row.squad, row.player.id); if (open?.player.id === row.player.id) set({ player: null }); data.refresh(); }
        catch (cause) { window.alert(extractApiErrorMessage(cause, copy('removeFailed'))); }
        finally { setRemoving(null); }
    };
    const card = (row: PlayerRow) => <li key={`${row.squad}-${row.player.id}`}><PlayerCard player={row.player} crest={data.clubLogo} subtitle={several ? data.names.get(row.squad) : undefined}
        signs={signs(row)} onOpen={() => openRow(row)}
        actions={canManage ? <button type="button" className="pc-card__action" aria-label={copy('removeFrom', { name: row.player.name, squad: data.names.get(row.squad) ?? '' })} title={copy('removeFrom', { name: row.player.name, squad: data.names.get(row.squad) ?? '' })} disabled={removing === row.player.id}
            onClick={event => { event.stopPropagation(); void remove(row); }}><Trash2 aria-hidden="true" /></button> : undefined} /></li>;
    const grouped = [...GROUPS, ...new Set(shown.map(row => row.group).filter(group => !GROUPS.includes(group)))]
        .map(group => ({ group, rows: shown.filter(row => row.group === group).sort((a, b) => (a.player.number ?? 999) - (b.player.number ?? 999)) })).filter(item => item.rows.length);

    const columns: Column<PlayerRow>[] = [
        { id: 'name', label: copy('colPlayer'), width: 'minmax(220px, 2fr)', sortable: true, render: row => <PrimaryCell lead={<Avatar src={resolveMediaUrl(row.player.photoUrl) || null} name={row.player.name} size={32} />}
            title={<button type="button" className="gk-dt-primary__title" onClick={() => openRow(row)}>{row.player.name}</button>} subtitle={several ? data.names.get(row.squad) : undefined} /> },
        { id: 'number', label: copy('colNumber'), width: '64px', sortable: true, render: row => row.player.number ?? EMPTY_CELL },
        { id: 'position', label: copy('colPosition'), width: 'minmax(140px, 1.2fr)', sortable: true, render: row => row.player.position ? <span><strong className="ch-code">{positionCode(row.player.position)}</strong> {squadLabel(row.player.position, t)}</span> : EMPTY_CELL },
        { id: 'age', label: copy('colAge'), width: '70px', sortable: true, render: row => row.player.age ?? EMPTY_CELL },
        { id: 'signs', label: copy('colSigns'), width: 'minmax(110px, 1fr)', sortable: true, render: row => <span className="pc-card__signs">{signs(row)}</span> },
    ];
    const sorted = sortRows(shown, sort, (row, by) => ({ name: row.player.name.toLocaleLowerCase(), number: row.player.number ?? 999, position: GROUPS.indexOf(row.group) * 100 + (row.player.number ?? 99),
        age: row.player.age ?? 0, signs: row.restriction ? 0 : row.consent ? 1 : row.review ? 2 : 3 } as Record<string, string | number>)[by] ?? '');

    const body: ReactNode = !rosters ? <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('loadingPlayers')}><Skeleton height={220} /></div></Panel>
        : !shown.length ? <Panel><EmptyNote title={needle ? copy('noPlayersMatch') : filter.id === 'all' ? copy('noSquadsYet') : copy('nobodyFilter', { filter: copy(filter.label).toLowerCase() })}>{needle ? copy('tryAnotherName') : filter.id === 'all' ? copy('playersAppear') : copy('goodNews')}</EmptyNote></Panel>
            : table ? <DataTable label={copy('players')} columns={columns} rows={sorted} rowKey={row => `${row.squad}-${row.player.id}`} sort={sort}
                onSort={by => { const value = nextSort(sort, by); set({ sort: value?.by ?? null, dir: value?.descending ? 'desc' : null }); }}
                onOpen={openRow} actions={() => <ChevronRight className="gk-dt__chevron gk-dt__keep" aria-hidden="true" />} />
                : <div className="gk-stack">{grouped.map(item => <Section key={item.group} title={squadLabel(item.group, t)} hint={`${item.rows.length}`}><ul className="pc-grid">{item.rows.map(card)}</ul></Section>)}</div>;
    const panel = open && <WorkspacePlayerPanel key={`${open.squad}-${open.player.id}`} player={open.player} squad={open.squad} squadName={data.names.get(open.squad) ?? ''} boot={data.boot}
        onClose={() => set({ player: null })} onChanged={data.refresh} onRemove={canManage ? () => void remove(open) : undefined} />;

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={copy('players')} subtitle={copy('playersIn', { count: rows.length, where: several ? copy('inYourSquads') : data.names.get(data.shown[0]) ?? '' })} />
        <SquadSwitch data={data} />
        <div className="gk-stack">
            {(Boolean(data.joining.items?.length) || data.joining.failed) && <WantToJoin items={data.joining.items ?? []} failed={data.joining.failed} onRetry={data.joining.refresh} data={data} onChanged={data.refresh} />}
            {errors.length > 0 && <div className="gk-notice gk-notice--danger" role="alert">{errors[0]}</div>}
            <div className="gk-stack gk-stack--tight">
                <ViewTabs label={copy('show')} value={filter.id} onChange={id => set({ view: id === 'all' ? null : id })} views={FILTERS.map(item => ({ id: item.id, label: copy(item.label), count: rows.filter(item.test).length }))} />
                <ListToolbar>
                    <SearchInput aria-label={copy('findPlayer')} placeholder={copy('namePlaceholder')} value={query} onChange={event => set({ q: event.target.value })} />
                    <span className="ch-toolbar-end">
                        {/* Beside the list, not up in the header: the roster is managed right here, in a small dialog. */}
                        {data.roles.leadership && <Button size="sm" onClick={() => setRoster(true)}><UserPlus aria-hidden="true" />{copy('manageRoster')}</Button>}
                        <Segmented label={copy('layout')} value={table ? 'table' : 'cards'} onChange={value => set({ layout: value === 'table' ? 'table' : null })}
                            items={[{ id: 'cards', label: copy('cards'), icon: <LayoutGrid aria-hidden="true" /> }, { id: 'table', label: copy('table'), icon: <ListIcon aria-hidden="true" /> }]} />
                    </span>
                </ListToolbar>
            </div>
            {body}
        </div>
        {panel}
        {roster && <RosterDialog data={data} open onClose={() => setRoster(false)} />}
    </PageFrame>;
}
