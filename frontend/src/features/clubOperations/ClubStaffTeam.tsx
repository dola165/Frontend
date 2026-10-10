import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Flag, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton } from '../../design/primitives';
import { Dialog } from '../../design/Dialog';
import type { ClubManagedMember } from '../clubs/domain';
import { clubRoleLabel } from '../clubs/domain';
import type { StaffRole } from './useWorkspaceRoles';
import { StaffAppointmentForm } from './StaffAppointmentForm';
import { get, post, root, label, appointmentStatus, appointmentScope, type Appointment, type Bootstrap, type Choice } from './api';
import { AppointmentPanel, appointmentBadge, appointmentDates } from './staff/AppointmentPanel';
import { extractApiErrorMessage } from '../../utils/apiError';
import './records/records.css';
import './staff/staff.css';
import '../clubWorkspace/club-workspace.css';

interface Person { id: number; name: string; member?: ClubManagedMember; appointments: Appointment[] }
const isCurrent = (a: Appointment) => ['Active', 'Upcoming', 'Invited'].includes(appointmentStatus(a));
const isReferee = (appointments: Appointment[]) => appointments.some(a => a.specialisations.includes('REFEREE'));

/**
 * The club's staff, one person per row: their football appointments (role, squads, tools) and any management
 * membership. Leadership invites, changes and ends appointments here; `mode="invites"` shows what is still awaiting
 * an answer. Nothing grants access until the person accepts, and ending an appointment asks first.
 */
export function ClubStaffTeam({ boot, members = [], roles, mode = 'staff', renderAdministration, onChanged, children }: {
    boot: Bootstrap; members?: ClubManagedMember[]; roles?: StaffRole[]; mode?: 'staff' | 'invites';
    renderAdministration?: (member: ClubManagedMember) => ReactNode; onChanged?: () => void; children?: ReactNode;
}) {
    const [items, setItems] = useState<Appointment[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const [personId, setPersonId] = useState<number | null>(null), [query, setQuery] = useState(''), [filter, setFilter] = useState<'current' | 'all'>('current');
    const [editor, setEditor] = useState<{ appointment?: Appointment; person?: Choice } | null>(null), [ending, setEnding] = useState<Appointment | null>(null);
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    useEffect(() => {
        const controller = new AbortController(); setLoading(true); setError('');
        void get<Appointment[]>(`${root(boot.clubId)}/appointments`, controller.signal).then(rows => { if (!controller.signal.aborted) setItems(rows); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, 'Could not load the staff team.')); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [boot.clubId, revision]);
    const people = useMemo(() => {
        const rows = new Map<number, Person>();
        for (const member of members) rows.set(member.userId, { id: member.userId, name: member.fullName || member.username, member, appointments: [] });
        for (const a of items) { if (!rows.has(a.user_id)) rows.set(a.user_id, { id: a.user_id, name: a.name ?? `Staff #${a.user_id}`, appointments: [] }); rows.get(a.user_id)!.appointments.push(a); }
        return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [members, items]);
    const selected = people.find(p => p.id === personId);
    const pending = items.filter(a => appointmentStatus(a) === 'Invited');
    const needle = query.toLowerCase();
    const visible = people.filter(p => (filter === 'all' || p.member || p.appointments.some(isCurrent))
        && `${p.name} ${p.appointments.map(a => `${a.title} ${a.specialisations.map(label).join(' ')} ${appointmentScope(a, boot.squads)}`).join(' ')}`.toLowerCase().includes(needle));
    const refresh = () => { setRevision(v => v + 1); onChanged?.(); };
    const end = async () => {
        if (!ending || busy) return;
        setBusy(true); setError('');
        try {
            await post(`${root(boot.clubId)}/appointments/${ending.id}/transition`, { status: 'ENDED', revision: ending.revision, note: ending.status === 'INVITED' ? 'Invitation cancelled by club leadership.' : 'Appointment ended by club leadership.' });
            setNotice(ending.status === 'INVITED' ? 'Invitation cancelled.' : 'Appointment ended. Its access has ended.'); setEnding(null); refresh();
        } catch (failure) { setError(extractApiErrorMessage(failure, 'Could not close this appointment.')); }
        finally { setBusy(false); }
    };

    if (editor) return <PageFrame className="cw-page"><StaffAppointmentForm boot={boot} roles={roles} appointment={editor.appointment} initialPerson={editor.person} onCancel={() => setEditor(null)}
        onSaved={() => { setEditor(null); setNotice('Invitation sent. The person reviews it in Coach Hub › Responsibilities before any access starts.'); refresh(); }} /></PageFrame>;

    const notices = <>
        {notice && <p role="status" className="gk-notice cw-notices__success">{notice}</p>}
        {error && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => setRevision(v => v + 1)}>Try again</Button></div>}
    </>;
    const loadingRows = <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading staff">{[0, 1, 2].map(i => <Skeleton key={i} height={48} />)}</div></Panel>;
    const confirmEnd = <Dialog open={ending !== null} role="alertdialog" size="sm" onClose={() => setEnding(null)}
        title={ending?.status === 'INVITED' ? 'Cancel this invitation?' : 'End this appointment and its access?'}
        description={ending ? `${ending.name ?? 'The person'} · ${ending.title}. Their other appointments and any management membership stay as they are.` : undefined}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(null)}>Keep appointment</Button>
            <Button variant="danger" disabled={busy} onClick={() => void end()}>{ending?.status === 'INVITED' ? 'Cancel invitation' : 'End appointment'}</Button></>} />;

    if (selected && mode === 'staff') {
        const current = selected.appointments.filter(isCurrent);
        return <PageFrame className="cw-page st-page">
            <div className="rec-back"><Button variant="ghost" size="sm" onClick={() => { setPersonId(null); setEnding(null); }}><ArrowLeft aria-hidden="true" />All staff</Button></div>
            <PageHeader title={selected.name} subtitle={current.map(a => a.title).join(' · ') || selected.member?.publicTitle || (selected.member ? clubRoleLabel(selected.member.role) : 'Past staff member')}
                actions={boot.leadership && <Button variant="primary" onClick={() => setEditor({ person: { id: selected.id, name: selected.name } })}><UserPlus aria-hidden="true" />Add responsibility</Button>} />
            <div className="gk-stack">
                {notices}
                {loading ? loadingRows : selected.appointments.length
                    ? <Section title="Football appointments" hint={String(selected.appointments.length)}><div className="gk-stack gk-stack--tight">{selected.appointments.map(a => <AppointmentPanel key={a.id} appointment={a} boot={boot}
                        onChange={() => setEditor({ appointment: a })} onEnd={() => setEnding(a)} />)}</div></Section>
                    : <Panel><EmptyNote title="No football appointment yet">{boot.leadership ? 'Add a responsibility to give them squads and specialist tools.' : 'Club leadership adds responsibilities.'}</EmptyNote></Panel>}
                {selected.member && renderAdministration && <Section title="Club membership" hint={clubRoleLabel(selected.member.role)}><Panel padded>{renderAdministration(selected.member)}</Panel></Section>}
            </div>
            {confirmEnd}
        </PageFrame>;
    }

    if (mode === 'invites') return <PageFrame className="cw-page st-page">
        <PageHeader title="Invitations" subtitle="Staff appointments and management memberships waiting for an answer. Recipients accept in Coach Hub › Responsibilities; nothing is granted before that."
            actions={boot.leadership && <Button variant="primary" onClick={() => setEditor({})}><UserPlus aria-hidden="true" />Invite staff</Button>} />
        <div className="gk-stack">
            {notices}
            <Section title="Staff appointments awaiting acceptance" hint={pending.length ? String(pending.length) : undefined}>
                {loading ? loadingRows : <Panel flush>{pending.length ? <List label="Staff appointments awaiting acceptance">{pending.map(a => <li key={a.id}><div className="gk-list-row st-invite">
                    <Avatar name={a.name ?? a.title} size={36} />
                    <span className="gk-list-row__main"><span className="gk-list-row__title">{a.name ?? `Staff #${a.user_id}`} · {a.title}</span>
                        <span className="gk-list-row__meta">{[appointmentScope(a, boot.squads), label(a.engagement), appointmentDates(a), `${a.permissions.length} ${a.permissions.length === 1 ? 'tool' : 'tools'}`].join(' · ')}</span></span>
                    {boot.leadership && <span className="gk-list-row__trail st-invite__actions"><Button size="sm" onClick={() => setEditor({ appointment: a })}>Change</Button>
                        <Button size="sm" variant="ghost" className="st-danger" onClick={() => setEnding(a)}>Cancel invitation</Button></span>}
                </div></li>)}</List> : <EmptyNote title="No staff invitations waiting">{boot.leadership ? 'Invite a coach, referee or specialist with a clear role, squads and tools.' : 'Invitations club leadership sends appear here.'}</EmptyNote>}</Panel>}
            </Section>
            {children}
        </div>
        {confirmEnd}
    </PageFrame>;

    return <PageFrame className="cw-page st-page">
        <PageHeader title="Staff" subtitle="Coaches, specialists, referees and club leadership. Open a person to see or change their responsibilities."
            actions={boot.leadership && <Button variant="primary" onClick={() => setEditor({})}><UserPlus aria-hidden="true" />Invite staff</Button>} />
        <div className="gk-stack">
            {notices}
            <div className="rec-toolbar">
                <SearchInput className="rec-toolbar__search" aria-label="Find staff" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, responsibility or squad" />
                <select className="gk-input" aria-label="Show" value={filter} onChange={event => setFilter(event.target.value as 'current' | 'all')}>
                    <option value="current">Current team and invitations</option><option value="all">Including past appointments</option>
                </select>
                <span className="rec-toolbar__count" role="status">{visible.length} {visible.length === 1 ? 'person' : 'people'}</span>
            </div>
            {loading ? loadingRows : visible.length ? <Panel flush><List label="Club staff">{visible.map(p => {
                const current = p.appointments.filter(isCurrent);
                const invited = current.find(a => a.status === 'INVITED');
                const scope = current.length ? [...new Set(current.map(a => appointmentScope(a, boot.squads)))].join(' · ') : p.member ? 'Club management' : 'Appointment history';
                const badge = invited ? appointmentBadge(invited) : p.member || current.some(a => appointmentStatus(a) === 'Active') ? { text: 'Active', tone: 'accent' as const } : current.length ? { text: 'Upcoming', tone: 'info' as const } : { text: 'Past', tone: 'neutral' as const };
                return <ListRow key={p.id} onClick={() => { setPersonId(p.id); setNotice(''); }}
                    lead={isReferee(current) ? <span className="st-referee" aria-hidden="true"><Flag /></span> : <Avatar name={p.name} size={40} />}
                    title={p.name} meta={current.map(a => a.title).join(' · ') || p.member?.publicTitle || (p.member ? clubRoleLabel(p.member.role) : 'Past staff member')}
                    trail={<><span className="st-scope" title={scope}>{scope}</span><Badge tone={badge.tone}>{badge.text}</Badge></>} />;
            })}</List></Panel>
                : <Panel><EmptyNote title={query ? 'No staff match this search' : 'Your team starts here'}
                    action={!query && boot.leadership ? <Button size="sm" onClick={() => setEditor({})}><UserPlus aria-hidden="true" />Invite staff</Button> : undefined}>
                    {query ? 'Try a name, responsibility or squad.' : 'Invite a person and choose their football responsibilities.'}</EmptyNote></Panel>}
        </div>
    </PageFrame>;
}
