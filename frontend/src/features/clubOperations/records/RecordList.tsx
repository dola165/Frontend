import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { Avatar, SearchInput } from '../../../design/primitives';
import { DataTable, EMPTY_CELL, FilterSelect, ListToolbar, PrimaryCell, Status, ViewTabs, type Column, type RowGroup } from '../../../design/DataTable';
import { sortRows, type TableSort } from '../../../design/tableSort';
import { formatDate } from '../../../utils/formatting';
import { label, moduleNames, type Bootstrap, type Definition, type OperationRecord } from '../api';
import { operationTabs } from '../workspaceNavigation';
import { useNow } from '../../clubWorkspace/useNow';
import { daysFromToday } from '../../clubWorkspace/fixtures';
import { isFinished, statusTone } from './recordStatus';

/** Whose records a list shows: everything the person may see, only open ones, or the ones assigned to them. */
export type RecordView = 'all' | 'open' | 'mine';

const dateOf = (record: OperationRecord) => record.attentionDate ?? record.due_on;
const moduleIcon = (module: string) => operationTabs.find(tab => tab.module === module)?.icon ?? ClipboardList;
const noon = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);

/** Open work by how soon it is due, then finished records; the order inside each group is the list's sort. */
const GROUPS = [
    { key: 'late', label: 'Overdue', tone: 'danger' }, { key: 'today', label: 'Today', tone: 'warning' }, { key: 'week', label: 'Next 7 days' },
    { key: 'later', label: 'Later' }, { key: 'none', label: 'No date' }, { key: 'done', label: 'Finished' },
] as const;
function groupOf(record: OperationRecord, now: number): typeof GROUPS[number]['key'] {
    if (isFinished(record.status)) return 'done';
    const days = daysFromToday(dateOf(record), now);
    return days === null ? 'none' : days < 0 ? 'late' : days === 0 ? 'today' : days <= 7 ? 'week' : 'later';
}

/** The next date in words that scan down a column: "3 days overdue", "Today", "Tomorrow", "Thu 16", "24 Oct". */
function DueCell({ value, now, finished }: { value: string | null | undefined; now: number; finished: boolean }) {
    const days = daysFromToday(value, now);
    if (days === null || !value) return EMPTY_CELL;
    const date = noon(value), full = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const text = finished || days > 6 ? formatDate(date, { day: 'numeric', month: 'short' })
        : days < 0 ? `${-days} ${days === -1 ? 'day' : 'days'} overdue` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatDate(date, { weekday: 'short', day: 'numeric' });
    return <span className={`gk-dt-date${!finished && days < 0 ? ' gk-dt-date--late' : !finished && days === 0 ? ' gk-dt-date--soon' : ''}`} title={full}>{text}</span>;
}

/**
 * Records as a table: what it is (and in the work queue, which tool it belongs to), the squad, who is responsible,
 * the status and the next date. Open work is grouped by urgency; finished records follow. Each title is a link to the
 * record, and a click anywhere on the row opens it too.
 */
export function RecordTable({ records, boot, home, sort, onSort, hrefFor, onOpen, footer }: {
    records: OperationRecord[]; boot: Bootstrap; home: boolean; sort: TableSort | null; onSort: (by: string) => void;
    hrefFor: (record: OperationRecord) => string; onOpen: (record: OperationRecord) => void; footer?: ReactNode;
}) {
    const now = useNow();
    const squad = (record: OperationRecord) => record.squad_id ? boot.squads.find(s => s.id === record.squad_id)?.name ?? `Squad #${record.squad_id}` : null;
    const responsible = (record: OperationRecord) => boot.staff.find(s => s.id === record.assigned_user_id)?.name ?? boot.guardians.find(g => g.id === record.assigned_user_id)?.name ?? null;
    const kinds = new Set(records.map(record => record.kind));
    const subtitle = (record: OperationRecord) => home ? moduleNames[record.module] : kinds.size > 1 ? boot.definitions.find(d => d.kind === record.kind)?.label : undefined;

    const columns: Column<OperationRecord>[] = [
        { id: 'title', label: 'Record', width: 'minmax(240px, 3fr)', sortable: true, render: record => {
            const Icon = moduleIcon(record.module);
            return <PrimaryCell lead={home ? <span className="gk-dt-icon"><Icon aria-hidden="true" /></span> : undefined}
                title={<Link className="gk-dt-primary__title" to={hrefFor(record)}>{record.title}</Link>} subtitle={subtitle(record)} />;
        } },
        { id: 'squad', label: 'Squad', width: 'minmax(110px, 1fr)', sortable: true, render: record => squad(record) ?? <span className="gk-dt-muted">Club-wide</span> },
        { id: 'responsible', label: 'Responsible', width: 'minmax(150px, 1.3fr)', sortable: true, render: record => {
            const name = responsible(record);
            return name ? <span className="gk-dt-person"><span aria-hidden="true"><Avatar name={name} size={22} /></span><span>{name}</span></span> : <span className="gk-dt-muted">Unassigned</span>;
        } },
        { id: 'status', label: 'Status', width: 'minmax(120px, 1fr)', sortable: true, render: record => <Status tone={statusTone(record)}>
            {record.expired ? <>Expired<span className="gk-dt-muted"> · {label(record.status)}</span></> : label(record.status)}
        </Status> },
        // Lists without deadlines (attendance, inventory) show when each record last changed instead.
        records.some(dateOf)
            ? { id: 'due', label: home ? 'Due' : 'Next date', width: '120px', sortable: true, render: record => <DueCell value={dateOf(record)} now={now} finished={isFinished(record.status)} /> }
            : { id: 'updated', label: 'Updated', width: '120px', sortable: true, render: record => <span className="gk-dt-date" title={formatDate(record.updated_at, { dateStyle: 'full', timeStyle: 'short' })}>{formatDate(record.updated_at, { day: 'numeric', month: 'short' })}</span> },
    ];
    const value = (record: OperationRecord, by: string) => by === 'title' ? record.title.toLowerCase() : by === 'squad' ? squad(record) ?? ''
        : by === 'responsible' ? responsible(record) ?? '￿' : by === 'status' ? label(record.status) : by === 'updated' ? record.updated_at : dateOf(record) ?? '9999';
    const sorted = sortRows(records, sort, value);
    const groups: RowGroup<OperationRecord>[] = GROUPS.map(group => ({ key: group.key, label: group.label, tone: 'tone' in group ? group.tone : undefined, rows: sorted.filter(record => groupOf(record, now) === group.key) }));

    return <DataTable label="Records" columns={columns} groups={groups} rowKey={record => record.id} onOpen={onOpen} sort={sort} onSort={onSort} footer={footer}
        actions={() => <ChevronRight className="gk-dt__chevron gk-dt__keep" aria-hidden="true" />} />;
}

interface Filters { search: string; squad: string; kind: string }

/** Views, search and filters for a records list. Every change goes to the server, so results cover all matching records. */
export function RecordToolbar({ boot, module, definitions, view, filters, count, loading, page, onView, onChange, onClear }: {
    boot: Bootstrap; module: string; definitions: Definition[]; view: RecordView; filters: Filters; count: number; loading: boolean; page: number;
    onView: (view: RecordView) => void; onChange: (key: string, value: string) => void; onClear: () => void;
}) {
    const home = module === 'HOME', permission = boot.modules.find(m => m.id === module);
    const squads = boot.squads.filter(s => home ? boot.modules.some(m => m.globalRead || m.readSquads?.includes(s.id)) : permission?.globalRead || permission?.readSquads?.includes(s.id));
    // The work queue gathers every tool, so its types are grouped by the tool they belong to.
    const types = home ? boot.definitions.filter(d => boot.modules.some(m => m.id === d.module)) : definitions;
    const views: { id: RecordView; label: string }[] = [{ id: 'all', label: 'All' }, ...(home ? [] : [{ id: 'open' as const, label: 'Open' }]), { id: 'mine', label: 'Assigned to me' }];
    const counted = page ? `Showing ${page * 100 + 1}–${page * 100 + count}` : `${count} ${count === 1 ? 'record' : 'records'}`;
    return <div className="gk-stack gk-stack--tight">
        <ViewTabs label="Show" views={views} value={view} onChange={id => onView(id as RecordView)} />
        <ListToolbar count={loading ? 'Updating…' : counted} onClear={filters.search || filters.squad || filters.kind ? onClear : undefined}>
            <SearchInput aria-label="Search records" value={filters.search} maxLength={160} onChange={e => onChange('q', e.target.value)} placeholder="Search records" />
            <FilterSelect label="Squad" allLabel="All" value={filters.squad} onChange={value => onChange('squad', value)} options={squads.map(s => ({ value: String(s.id), label: s.name }))} />
            {types.length > 1 && <FilterSelect label="Type" allLabel="All" value={filters.kind} onChange={value => onChange('kind', value)}
                options={types.map(d => ({ value: d.kind, label: d.label, group: home ? moduleNames[d.module] : undefined }))} />}
        </ListToolbar>
    </div>;
}
