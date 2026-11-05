import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar, SearchInput } from '../../../design/primitives';
import { DataTable, EMPTY_CELL, FilterSelect, ListToolbar, PrimaryCell, Status, ViewTabs, type Column, type RowGroup } from '../../../design/DataTable';
import { sortRows, type TableSort } from '../../../design/tableSort';
import { formatDate } from '../../../utils/formatting';
import { label, type Bootstrap, type Definition, type OperationRecord } from '../api';
import { useNow } from '../../clubWorkspace/useNow';
import { daysFromToday, dueWords } from '../../clubWorkspace/fixtures';
import { isFinished, statusTone } from './recordStatus';
import { clubRecordsEn } from '../../../locales/clubRecords';
import { useCopy } from '../../../locales/useCopy';

/** Whose records a list shows: everything the person may see, only open ones, or the ones assigned to them. */
export type RecordView = 'all' | 'open' | 'mine';

const dateOf = (record: OperationRecord) => record.attentionDate ?? record.due_on;

/** Open work by how soon it is due, then finished records; the order inside each group is the list's sort. */
const GROUPS = [
    { key: 'late', label: 'groupLate', tone: 'danger' }, { key: 'today', label: 'groupToday', tone: 'warning' }, { key: 'week', label: 'groupWeek' },
    { key: 'later', label: 'groupLater' }, { key: 'none', label: 'groupNone' }, { key: 'done', label: 'groupDone' },
] as const;
function groupOf(record: OperationRecord, now: number): typeof GROUPS[number]['key'] {
    if (isFinished(record.status)) return 'done';
    const days = daysFromToday(dateOf(record), now);
    return days === null ? 'none' : days < 0 ? 'late' : days === 0 ? 'today' : days <= 7 ? 'week' : 'later';
}

/** The next date in words that scan down a column: "3 days overdue", "Today", "Tomorrow", "Thu 16", "24 Oct". */
function DueCell({ value, now, finished }: { value: string | null | undefined; now: number; finished: boolean }) {
    const due = dueWords(value, now);
    if (!due) return EMPTY_CELL;
    const full = formatDate(due.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (finished) return <span className="gk-dt-date" title={full}>{formatDate(due.date, { day: 'numeric', month: 'short' })}</span>;
    return <span className={`gk-dt-date${due.late ? ' gk-dt-date--late' : due.today ? ' gk-dt-date--soon' : ''}`} title={full}>{due.text}</span>;
}

/**
 * Records as a table: what it is (and in the work queue, which tool it belongs to), the squad, who is responsible,
 * the status and the next date. Open work is grouped by urgency; finished records follow. Each title is a link to the
 * record, and a click anywhere on the row opens it too.
 */
export function RecordTable({ records, boot, sort, onSort, hrefFor, onOpen, footer }: {
    records: OperationRecord[]; boot: Bootstrap; sort: TableSort | null; onSort: (by: string) => void;
    hrefFor: (record: OperationRecord) => string; onOpen: (record: OperationRecord) => void; footer?: ReactNode;
}) {
    const now = useNow();
    const copy = useCopy('clubRecords', clubRecordsEn);
    const squad = (record: OperationRecord) => record.squad_id ? boot.squads.find(s => s.id === record.squad_id)?.name ?? `Squad #${record.squad_id}` : null;
    const responsible = (record: OperationRecord) => boot.staff.find(s => s.id === record.assigned_user_id)?.name ?? boot.guardians.find(g => g.id === record.assigned_user_id)?.name ?? null;
    const kinds = new Set(records.map(record => record.kind));
    const subtitle = (record: OperationRecord) => kinds.size > 1 ? boot.definitions.find(d => d.kind === record.kind)?.label : undefined;

    const columns: Column<OperationRecord>[] = [
        { id: 'title', label: copy('colRecord'), width: 'minmax(240px, 3fr)', sortable: true, render: record => <PrimaryCell
            title={<Link className="gk-dt-primary__title" to={hrefFor(record)}>{record.title}</Link>} subtitle={subtitle(record)} /> },
        { id: 'squad', label: copy('colSquad'), width: 'minmax(110px, 1fr)', sortable: true, render: record => squad(record) ?? <span className="gk-dt-muted">{copy('clubWide')}</span> },
        { id: 'responsible', label: copy('colResponsible'), width: 'minmax(150px, 1.3fr)', sortable: true, render: record => {
            const name = responsible(record);
            return name ? <span className="gk-dt-person"><span aria-hidden="true"><Avatar name={name} size={22} /></span><span>{name}</span></span> : <span className="gk-dt-muted">{copy('unassigned')}</span>;
        } },
        { id: 'status', label: copy('colStatus'), width: 'minmax(120px, 1fr)', sortable: true, render: record => <Status tone={statusTone(record)}>
            {record.expired ? <>{copy('expired')}<span className="gk-dt-muted"> · {label(record.status)}</span></> : label(record.status)}
        </Status> },
        // Lists without deadlines (attendance, inventory) show when each record last changed instead.
        records.some(dateOf)
            ? { id: 'due', label: copy('colNextDate'), width: '120px', sortable: true, render: record => <DueCell value={dateOf(record)} now={now} finished={isFinished(record.status)} /> }
            : { id: 'updated', label: copy('colUpdated'), width: '120px', sortable: true, render: record => <span className="gk-dt-date" title={formatDate(record.updated_at, { dateStyle: 'full', timeStyle: 'short' })}>{formatDate(record.updated_at, { day: 'numeric', month: 'short' })}</span> },
    ];
    const value = (record: OperationRecord, by: string) => by === 'title' ? record.title.toLowerCase() : by === 'squad' ? squad(record) ?? ''
        : by === 'responsible' ? responsible(record) ?? '￿' : by === 'status' ? label(record.status) : by === 'updated' ? record.updated_at : dateOf(record) ?? '9999';
    const sorted = sortRows(records, sort, value);
    const groups: RowGroup<OperationRecord>[] = GROUPS.map(group => ({ key: group.key, label: copy(group.label), tone: 'tone' in group ? group.tone : undefined, rows: sorted.filter(record => groupOf(record, now) === group.key) }));

    return <DataTable label={copy('records')} columns={columns} groups={groups} rowKey={record => record.id} onOpen={onOpen} sort={sort} onSort={onSort} footer={footer}
        actions={() => <ChevronRight className="gk-dt__chevron gk-dt__keep" aria-hidden="true" />} />;
}

interface Filters { search: string; squad: string; kind: string }

/** Views, search and filters for a records list. Every change goes to the server, so results cover all matching records. */
export function RecordToolbar({ boot, module, definitions, view, filters, count, loading, page, onView, onChange, onClear }: {
    boot: Bootstrap; module: string; definitions: Definition[]; view: RecordView; filters: Filters; count: number; loading: boolean; page: number;
    onView: (view: RecordView) => void; onChange: (key: string, value: string) => void; onClear: () => void;
}) {
    const copy = useCopy('clubRecords', clubRecordsEn);
    const permission = boot.modules.find(m => m.id === module);
    const squads = boot.squads.filter(s => permission?.globalRead || permission?.readSquads?.includes(s.id));
    const views: { id: RecordView; label: string }[] = [{ id: 'all', label: copy('viewAll') }, { id: 'open', label: copy('viewOpen') }, { id: 'mine', label: copy('viewMine') }];
    const counted = page ? copy('showing', { from: page * 100 + 1, to: page * 100 + count }) : copy('count', { count });
    return <div className="gk-stack gk-stack--tight">
        <ViewTabs label={copy('show')} views={views} value={view} onChange={id => onView(id as RecordView)} />
        <ListToolbar count={loading ? copy('updating') : counted} onClear={filters.search || filters.squad || filters.kind ? onClear : undefined}>
            <SearchInput aria-label={copy('search')} value={filters.search} maxLength={160} onChange={e => onChange('q', e.target.value)} placeholder={copy('search')} />
            <FilterSelect label={copy('filterSquad')} allLabel={copy('filterAll')} value={filters.squad} onChange={value => onChange('squad', value)} options={squads.map(s => ({ value: String(s.id), label: s.name }))} />
            {definitions.length > 1 && <FilterSelect label={copy('filterType')} allLabel={copy('filterAll')} value={filters.kind} onChange={value => onChange('kind', value)}
                options={definitions.map(d => ({ value: d.kind, label: d.label }))} />}
        </ListToolbar>
    </div>;
}
