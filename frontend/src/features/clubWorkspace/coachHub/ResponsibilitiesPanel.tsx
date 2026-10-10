import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, Field, List, ListRow, Panel, Section } from '../../../design/primitives';
import { AppointmentSummary } from '../../clubOperations/AppointmentSummary';
import { appointmentScope, label, moduleNames, post, root, scopePayload } from '../../clubOperations/api';
import type { StaffScopeSelection } from '../../clubOperations/StaffScopePicker';
import { rolesRoot, type RolesWorkspace, type StaffRole } from '../../clubOperations/useWorkspaceRoles';
import { focusTabs, type ResponsibilityFocus } from '../../clubOperations/workspaceStructure';
import { useClubEditorClose } from '../../clubOperations/useClubEditorClose';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { viewScope } from './coachData';
import { ScopeChips } from '../ScopeChips';

const access = (permissions: string[]) => permissions.map(p => `${moduleNames[p.split(':')[0]] ?? label(p.split(':')[0])}${p.endsWith(':WRITE') ? '' : ' (view)'}`).join(', ');
const requestStatus: Record<string, { tone: 'accent' | 'warning' | 'danger' | 'neutral'; text: string }> = {
    PENDING: { tone: 'warning', text: 'Awaiting approval' }, APPROVED: { tone: 'accent', text: 'Approved' },
    DECLINED: { tone: 'danger', text: 'Declined' }, WITHDRAWN: { tone: 'neutral', text: 'Withdrawn' },
};

/**
 * Your responsibilities: which approved ones shape your workspace (a personal preference),
 * and asking the club for another one (a request a club admin approves; nothing is granted here).
 */
export function ResponsibilitiesPanel({ clubId, roles, focus, onChanged }: { clubId: number; roles: RolesWorkspace; focus: ResponsibilityFocus; onChanged: () => void }) {
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState('');
    const [form, setForm] = useState<{ role: StaffRole; scope: StaffScopeSelection; note: string; replace: string } | null>(null);
    const initial = useRef('');
    const dirty = Boolean(form) && JSON.stringify(form) !== initial.current;
    const { requestClose, confirmation } = useClubEditorClose(dirty, busy, () => setForm(null));
    const mine = roles.requests.filter(r => r.user_id === roles.actorId);
    const pending = mine.find(r => r.status === 'PENDING');
    const replaceable = focus.available.filter(v => v.appointmentId);

    const run = async (work: () => Promise<unknown>, done: string) => {
        if (busy) return;
        setBusy(true); setError(''); setSent('');
        try { await work(); setForm(null); setSent(done); onChanged(); }
        catch (failure) { setError(extractApiErrorMessage(failure, 'Could not update your responsibilities.')); }
        finally { setBusy(false); }
    };
    const open = (role: StaffRole) => { const next = { role, scope: { clubWide: false, squadIds: [] }, note: '', replace: '' }; initial.current = JSON.stringify(next); setError(''); setSent(''); setForm(next); };
    const submit = () => {
        if (!form) return;
        if (!form.scope.clubWide && !form.scope.squadIds.length) { setError('Choose the whole club or at least one squad.'); return; }
        const original = focus.available.find(v => String(v.appointmentId) === form.replace);
        void run(() => post(`${rolesRoot(clubId)}/requests`, { roleKey: form.role.key, ...scopePayload(form.scope), replaceAppointmentId: original?.appointmentId ?? null, replaceRevision: original?.revision ?? null, note: form.note || null }),
            `Your request for ${form.role.title.toLowerCase()} was sent. A club admin will review it.`);
    };
    const families = [...new Set(roles.catalog.map(r => r.family ?? 'Staff responsibilities'))];

    return <div className="gk-stack">
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        {sent && <div className="gk-notice cw-notices__success" role="status">{sent}</div>}

        <Section title="Shown in your workspace" hint="A personal view. It never changes your access.">
            <Panel flush>{focus.available.length ? <List label="Your approved responsibilities">{focus.available.map(view => {
                const on = focus.selected.includes(view.id), last = on && focus.selected.length === 1;
                const tools = focusTabs([view]);
                return <li key={view.id}><label className="gk-list-row cw-switch-row">
                    <span className="gk-list-row__main">
                        <span className="gk-list-row__title">{view.label}</span>
                        <span className="gk-list-row__meta">{viewScope(view, roles)} · {tools === 'all' ? 'every club tool' : `${tools.size} tools`}{view.appointmentId ? '' : view.id === 'club' ? ' · club leadership' : ''}</span>
                    </span>
                    <input type="checkbox" role="switch" className="cw-switch" checked={on} disabled={last} onChange={() => focus.toggle(view.id)} aria-describedby="cw-focus-hint" />
                    <span className="gk-visually-hidden">Show {view.label} first</span>
                </label></li>;
            })}</List> : <EmptyNote title="No approved responsibilities yet">Ask for one below. A club admin approves it before any tools change.</EmptyNote>}
                <p className="gk-panel__foot cw-muted" id="cw-focus-hint">Tools for the responsibilities you switch on come first in your navigation. Everything else stays under More tools and All tools.</p>
            </Panel>
        </Section>

        {roles.invitations.length > 0 && <Section title="Waiting for your answer">
            <div className="gk-stack gk-stack--tight">{roles.invitations.map(a => <AppointmentSummary key={a.id} appointment={a} squads={roles.requestSquads}>
                <Link className="appointment-summary__primary" to={`/club-operations?appointmentId=${a.id}`}>Review &amp; accept role</Link>
                <button type="button" className="appointment-summary__quiet" disabled={busy} onClick={() => void run(() => post(`${root(clubId)}/appointments/${a.id}/transition`, { status: 'DECLINED', revision: a.revision }), 'Invitation declined.')}>Decline</button>
            </AppointmentSummary>)}</div>
        </Section>}

        <Section title="Take on another responsibility" hint={pending ? 'One request at a time: wait for your current request, or withdraw it.' : 'A club admin approves each request before access changes.'}>
            <div className="cw-families">{families.map(family => <Panel flush key={family} title={family}>
                <List label={family}>{roles.catalog.filter(r => (r.family ?? 'Staff responsibilities') === family).map(role => {
                    const request = mine.find(r => r.role_key === role.key && ['PENDING', 'APPROVED'].includes(r.status));
                    const editing = form?.role.key === role.key;
                    return <li key={role.key}>
                        <div className="gk-list-row cw-role-row">
                            <span className="gk-list-row__main"><span className="gk-list-row__title">{role.title}</span><span className="cw-role-row__text">{role.description}</span></span>
                            <span className="gk-list-row__trail">{request ? <Badge tone={requestStatus[request.status].tone}>{requestStatus[request.status].text}</Badge>
                                : <Button size="sm" disabled={busy || Boolean(pending) || (Boolean(form) && !editing)} aria-expanded={editing} onClick={() => editing ? requestClose() : open(role)}>{editing ? 'Cancel' : 'Ask for this'}</Button>}</span>
                        </div>
                        {editing && form && <form className="cw-request" aria-label={`Ask for ${role.title}`} onSubmit={event => { event.preventDefault(); submit(); }}>
                            <p className="cw-muted"><strong>Includes:</strong> {access(role.permissions) || 'no club workspace tools'}.</p>
                            <ScopeChips squads={roles.requestSquads} value={form.scope} disabled={busy} onChange={scope => setForm({ ...form, scope })} />
                            {replaceable.length > 0 && <Field label="Change an existing role" htmlFor={`cw-replace-${role.key}`}>
                                <select id={`cw-replace-${role.key}`} className="gk-input" value={form.replace} disabled={busy} onChange={event => setForm({ ...form, replace: event.target.value })}>
                                    <option value="">Add it alongside your current responsibilities</option>
                                    {replaceable.map(v => <option key={v.id} value={String(v.appointmentId)}>Replace {v.label}</option>)}
                                </select>
                            </Field>}
                            <Field label="Message to your club admin (optional)" htmlFor={`cw-note-${role.key}`}>
                                <textarea id={`cw-note-${role.key}`} className="gk-input" rows={2} maxLength={1000} placeholder="What will you be helping with?" value={form.note} disabled={busy} onChange={event => setForm({ ...form, note: event.target.value })} />
                            </Field>
                            <div className="gk-row"><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : 'Send for approval'}</Button><Button variant="ghost" disabled={busy} onClick={requestClose}>Cancel</Button></div>
                            <p className="gk-field__hint">Sending confirms you accept these responsibilities. Your current access stays as it is until a club admin approves.</p>
                            {confirmation}
                        </form>}
                    </li>;
                })}</List>
            </Panel>)}</div>
        </Section>

        <Section title="Your requests">
            <Panel flush>{mine.length ? <List label="Your requests">{mine.map(r => <ListRow key={r.id}
                title={roles.catalog.find(c => c.key === r.role_key)?.title ?? label(r.role_key)}
                meta={[appointmentScope({ squad_id: r.squad_id ?? null, ...r }, roles.requestSquads), r.review_note && `Admin reply: ${r.review_note}`, r.unavailable_reason].filter(Boolean).join(' · ')}
                trail={<>{r.status === 'PENDING' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`${rolesRoot(clubId)}/requests/${r.id}`, { status: 'WITHDRAWN', revision: r.revision }), 'Request withdrawn.')}>Withdraw</Button>}
                    <Badge tone={(requestStatus[r.effective_status ?? r.status] ?? requestStatus[r.status] ?? { tone: 'neutral' }).tone}>{(requestStatus[r.effective_status ?? r.status] ?? { text: label(r.effective_status ?? r.status) }).text}</Badge></>} />)}</List>
                : <EmptyNote title="No requests yet">When you ask for a responsibility, follow its review here.</EmptyNote>}</Panel>
        </Section>
    </div>;
}
