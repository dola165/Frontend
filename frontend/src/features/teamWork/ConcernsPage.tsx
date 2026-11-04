import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable, PrimaryCell, Status, ViewTabs, type Column } from '../../design/DataTable';
import { EmptyNote, PageHeader } from '../../design/primitives';
import { Crest } from '../../design/visuals';
import { formatDate } from '../../utils/formatting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ConcernList, ConcernRow } from './concernsApi';

const CLOSED = 'CLOSED';

/**
 * GrassKickZ's copies of confidential concerns: Open first, then Closed, with counts. The club, the date and the status,
 * never the words: reading them happens on the concern's own page, where every read is on the record. The view is in the
 * address (`state=closed`).
 */
export function ConcernsPage({ list }: { list: ConcernList }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const state = params.get('state') === 'closed' ? 'closed' : 'open';
    const page = (row: ConcernRow) => `/clubs/${row.clubId}/concerns/${row.id}`;
    const rows = list.rows.filter(row => (row.status === CLOSED) === (state === 'closed'));
    const columns: Column<ConcernRow>[] = [
        { id: 'club', label: copy('Club', 'კლუბი'), width: 'minmax(0, 2fr)', render: row => <PrimaryCell lead={<Crest name={row.clubName} size={28} />} title={<Link to={page(row)}>{row.clubName}</Link>} /> },
        { id: 'date', label: copy('Raised', 'თარიღი'), width: '140px', narrowLabel: copy('Raised', 'თარიღი'), render: row => formatDate(row.createdAt) },
        { id: 'status', label: copy('Status', 'სტატუსი'), width: '120px', render: row => row.status === CLOSED
            ? <Status tone="neutral">{copy('Closed', 'დახურული')}</Status>
            : <Status tone="warning">{row.status === 'OPEN' ? copy('Open', 'ღია') : copy('In progress', 'მიმდინარე')}</Status> },
    ];
    const show = (next: string) => setParams(current => { const after = new URLSearchParams(current); if (next === 'closed') after.set('state', 'closed'); else after.delete('state'); return after; }, { replace: true });
    return <>
        <PageHeader title={copy('Concerns', 'შეტყობინებები')} subtitle={copy('They reached GrassKickZ because they name a club’s owner, or the club has nobody else. Only you see these.', 'ისინი GrassKickZ-ს მიუვიდა, რადგან კლუბის მფლობელს ასახელებს ან კლუბში სხვა არავინაა. ამას მხოლოდ თქვენ ხედავთ.')} />
        <ViewTabs label={copy('Show', 'ჩვენება')} value={state} onChange={show}
            views={[{ id: 'open', label: copy('Open', 'ღია'), count: list.open }, { id: 'closed', label: copy('Closed', 'დახურული'), count: list.closed }]} />
        {rows.length
            ? <DataTable label={copy('Concerns', 'შეტყობინებები')} columns={columns} rows={rows} rowKey={row => row.id} onOpen={row => navigate(page(row))} />
            : <EmptyNote title={state === 'open' ? copy('Nothing open', 'ღია არაფერია') : copy('Nothing closed yet', 'დახურული ჯერ არაფერია')} />}
    </>;
}
