import { Badge, Chip, List, ListRow, SearchInput } from '../../../design/primitives';
import { label, moduleNames, type Bootstrap, type Definition, type OperationRecord } from '../api';
import { useNow } from '../../clubWorkspace/useNow';
import { dueText, statusTone } from './recordStatus';

/** Records as one list: what it is, where it applies and who is responsible, then its status and next date. */
export function RecordList({ records, boot, home, onOpen }: { records: OperationRecord[]; boot: Bootstrap; home: boolean; onOpen: (record: OperationRecord) => void }) {
    const now = useNow();
    return <List label="Records">{records.map(r => {
        const due = dueText(r.attentionDate ?? r.due_on, now);
        const responsible = boot.staff.find(s => s.id === r.assigned_user_id)?.name ?? boot.guardians.find(g => g.id === r.assigned_user_id)?.name;
        const meta = [home ? moduleNames[r.module] : boot.definitions.find(d => d.kind === r.kind)?.label,
            r.squad_id ? boot.squads.find(s => s.id === r.squad_id)?.name ?? `Squad #${r.squad_id}` : 'Club-wide', responsible ?? 'Unassigned'].filter(Boolean).join(' · ');
        return <ListRow key={r.id} onClick={() => onOpen(r)} title={r.title} meta={meta}
            trail={<><Badge tone={statusTone(r)}>{r.expired ? 'Expired · ' : ''}{label(r.status)}</Badge><span className={`rec-row__due${due?.late ? ' rec-row__due--late' : ''}`}>{due?.text ?? '—'}</span></>} />;
    })}</List>;
}

interface Filters { search: string; squad: string; kind: string; state: string; mine: boolean }

/** Search and filters for a records list. Every change goes to the server, so results cover all matching records. */
export function RecordFilters({ boot, module, definitions, filters, count, loading, page, onChange }: {
    boot: Bootstrap; module: string; definitions: Definition[]; filters: Filters; count: number; loading: boolean; page: number; onChange: (key: string, value: string) => void;
}) {
    const permission = boot.modules.find(m => m.id === module);
    const squads = boot.squads.filter(s => module === 'HOME' ? boot.modules.some(m => m.globalRead || m.readSquads?.includes(s.id)) : permission?.globalRead || permission?.readSquads?.includes(s.id));
    return <div className="rec-toolbar">
        <SearchInput className="rec-toolbar__search" aria-label="Search records" value={filters.search} maxLength={160} onChange={e => onChange('q', e.target.value)} placeholder="Search records" />
        <select className="gk-input" aria-label="Record squad" value={filters.squad} onChange={e => onChange('squad', e.target.value)}>
            <option value="">All accessible squads</option>{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {definitions.length > 1 && <select className="gk-input" aria-label="Record type" value={filters.kind} onChange={e => onChange('kind', e.target.value)}>
            <option value="">All record types</option>{definitions.map(d => <option value={d.kind} key={d.kind}>{d.label}</option>)}
        </select>}
        <div className="gk-chips" role="group" aria-label="Show">
            {module !== 'HOME' && <Chip pressed={filters.state === 'open'} onClick={() => onChange('state', filters.state === 'open' ? '' : 'open')}>Open only</Chip>}
            <Chip pressed={filters.mine} onClick={() => onChange('mine', filters.mine ? '' : 'true')}>Assigned to me</Chip>
        </div>
        <span className="rec-toolbar__count" role="status">{loading ? 'Updating…' : `${count} ${count === 1 ? 'record' : 'records'}${page ? ` · page ${page + 1}` : ''}`}</span>
    </div>;
}
