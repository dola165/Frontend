import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, Field, List, ListRow, Panel, Section } from '../../../design/primitives';
import { AppointmentSummary } from '../../clubOperations/AppointmentSummary';
import { appointmentScope, label, post, root, scopePayload } from '../../clubOperations/api';
import type { StaffScopeSelection } from '../../clubOperations/StaffScopePicker';
import { rolesRoot, type RolesWorkspace, type StaffRole } from '../../clubOperations/useWorkspaceRoles';
import { focusTabs, type ResponsibilityFocus } from '../../clubOperations/workspaceStructure';
import { useClubEditorClose } from '../../clubOperations/useClubEditorClose';
import { accessSummary, requestBadge } from '../../clubOperations/roleAccess';
import { ScopeChips } from '../../clubOperations/ScopeChips';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { responsibilitiesEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { viewSquads } from './coachData';
import '../club-workspace.css';

/**
 * Your responsibilities: which approved ones put their tools first (a personal preference that never
 * changes access), and asking the club for another one (a request a club admin approves; nothing is granted here).
 */
export function ResponsibilitiesPanel({ clubId, roles, focus, onChanged }: { clubId: number; roles: RolesWorkspace; focus: ResponsibilityFocus; onChanged: () => void }) {
    const copy = useCopy('responsibilities', responsibilitiesEn);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState('');
    const [form, setForm] = useState<{ role: StaffRole; scope: StaffScopeSelection; note: string; replace: string } | null>(null);
    const initial = useRef('');
    const dirty = Boolean(form) && JSON.stringify(form) !== initial.current;
    const { requestClose, confirmation } = useClubEditorClose(dirty, busy, () => setForm(null));
    const mine = roles.requests.filter(r => r.user_id === roles.actorId);
    const pending = mine.find(r => r.status === 'PENDING');
    const replaceable = focus.available.filter(v => v.appointmentId);
    const family = (role: StaffRole) => role.family ?? copy('familyFallback');

    const run = async (work: () => Promise<unknown>, done: string) => {
        if (busy) return;
        setBusy(true); setError(''); setSent('');
        try { await work(); setForm(null); setSent(done); onChanged(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('updateError'))); }
        finally { setBusy(false); }
    };
    const open = (role: StaffRole) => { const next = { role, scope: { clubWide: false, squadIds: [] }, note: '', replace: '' }; initial.current = JSON.stringify(next); setError(''); setSent(''); setForm(next); };
    const submit = () => {
        if (!form) return;
        if (!form.scope.clubWide && !form.scope.squadIds.length) { setError(copy('chooseScope')); return; }
        const original = focus.available.find(v => String(v.appointmentId) === form.replace);
        void run(() => post(`${rolesRoot(clubId)}/requests`, { roleKey: form.role.key, ...scopePayload(form.scope), replaceAppointmentId: original?.appointmentId ?? null, replaceRevision: original?.revision ?? null, note: form.note || null }),
            copy('sent', { name: form.role.title.toLowerCase() }));
    };
    const families = [...new Set(roles.catalog.map(family))];

    return <div className="gk-stack">
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        {sent && <div className="gk-notice cw-notices__success" role="status">{sent}</div>}

        <Section title={copy('focusTitle')} hint={copy('focusHint')}>
            <Panel flush>{focus.available.length ? <List label={copy('approved')}>{focus.available.map(view => {
                const on = focus.selected.includes(view.id), last = on && focus.selected.length === 1;
                const tools = focusTabs([view]);
                const where = viewSquads(view, roles);
                return <li key={view.id}><label className="gk-list-row cw-switch-row">
                    <span className="gk-list-row__main">
                        <span className="gk-list-row__title">{view.label}</span>
                        <span className="gk-list-row__meta">{where === 'club' ? copy('wholeClub') : where ?? copy('noSquadsAssigned')} · {tools === 'all' ? copy('everyTool') : copy('tools', { count: tools.size })}{!view.appointmentId && view.id === 'club' ? ` · ${copy('leadership')}` : ''}</span>
                        {last && focus.available.length > 1 && <span className="gk-list-row__meta" id={`cw-last-${view.id}`}>{copy('keepOne')}</span>}
                    </span>
                    <input type="checkbox" role="switch" className="gk-switch" checked={on} disabled={last} onChange={() => focus.toggle(view.id)}
                        aria-label={copy('showFirst', { name: view.label })} aria-describedby={`cw-focus-hint${last ? ` cw-last-${view.id}` : ''}`} />
                </label></li>;
            })}</List> : <EmptyNote title={copy('noneApproved')}>{copy('noneApprovedHint')}</EmptyNote>}
                <p className="gk-panel__foot cw-muted" id="cw-focus-hint">{copy('focusFoot')}</p>
            </Panel>
        </Section>

        {roles.invitations.length > 0 && <Section title={copy('waitingAnswer')}>
            <div className="gk-stack gk-stack--tight">{roles.invitations.map(a => <AppointmentSummary key={a.id} appointment={a} squads={roles.requestSquads}>
                <Link className="appointment-summary__primary" to={`/club-operations?appointmentId=${a.id}`}>{copy('reviewAccept')}</Link>
                <button type="button" className="appointment-summary__quiet" disabled={busy} onClick={() => void run(() => post(`${root(clubId)}/appointments/${a.id}/transition`, { status: 'DECLINED', revision: a.revision }), copy('declined'))}>{copy('decline')}</button>
            </AppointmentSummary>)}</div>
        </Section>}

        <Section title={copy('takeOn')} hint={pending ? copy('oneAtATime') : copy('adminApproves')}>
            <div className="cw-families">{families.map(name => <Panel flush key={name} title={name}>
                <List label={name}>{roles.catalog.filter(r => family(r) === name).map(role => {
                    const request = mine.find(r => r.role_key === role.key && ['PENDING', 'APPROVED'].includes(r.status));
                    const editing = form?.role.key === role.key;
                    const badge = request && requestBadge(request.status);
                    return <li key={role.key}>
                        <div className="gk-list-row cw-role-row">
                            <span className="gk-list-row__main"><span className="gk-list-row__title">{role.title}</span><span className="cw-role-row__text">{role.description}</span></span>
                            <span className="gk-list-row__trail">{badge ? <Badge tone={badge.tone}>{badge.text}</Badge>
                                : <Button size="sm" disabled={busy || Boolean(pending) || (Boolean(form) && !editing)} aria-expanded={editing} onClick={() => editing ? requestClose() : open(role)}>{editing ? copy('cancel') : copy('askFor')}</Button>}</span>
                        </div>
                        {editing && form && <form className="cw-request" aria-label={copy('askForName', { name: role.title })} onSubmit={event => { event.preventDefault(); submit(); }}>
                            <p className="cw-muted"><strong>{copy('includes')}</strong> {accessSummary(role.permissions) || copy('noTools')}.</p>
                            <ScopeChips squads={roles.requestSquads} value={form.scope} disabled={busy} onChange={scope => setForm({ ...form, scope })} />
                            {replaceable.length > 0 && <Field label={copy('replaceLabel')} htmlFor={`cw-replace-${role.key}`}>
                                <select id={`cw-replace-${role.key}`} className="gk-input" value={form.replace} disabled={busy} onChange={event => setForm({ ...form, replace: event.target.value })}>
                                    <option value="">{copy('alongside')}</option>
                                    {replaceable.map(v => <option key={v.id} value={String(v.appointmentId)}>{copy('replace', { name: v.label })}</option>)}
                                </select>
                            </Field>}
                            <Field label={copy('messageLabel')} htmlFor={`cw-note-${role.key}`}>
                                <textarea id={`cw-note-${role.key}`} className="gk-input" rows={2} maxLength={1000} placeholder={copy('messagePlaceholder')} value={form.note} disabled={busy} onChange={event => setForm({ ...form, note: event.target.value })} />
                            </Field>
                            {confirmation}
                            <div className="gk-row"><Button type="submit" variant="primary" disabled={busy}>{busy ? copy('sending') : copy('send')}</Button><Button variant="ghost" disabled={busy} onClick={requestClose}>{copy('cancel')}</Button></div>
                            <p className="gk-field__hint">{copy('sendHint')}</p>
                        </form>}
                    </li>;
                })}</List>
            </Panel>)}</div>
        </Section>

        <Section title={copy('yourRequests')}>
            <Panel flush>{mine.length ? <List label={copy('yourRequests')}>{mine.map(r => {
                const badge = requestBadge(r.effective_status ?? r.status);
                return <ListRow key={r.id}
                    title={roles.catalog.find(c => c.key === r.role_key)?.title ?? label(r.role_key)}
                    meta={[appointmentScope({ squad_id: r.squad_id ?? null, ...r }, roles.requestSquads), r.review_note && copy('adminReply', { text: r.review_note }), r.unavailable_reason].filter(Boolean).join(' · ')}
                    trail={<>{r.status === 'PENDING' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`${rolesRoot(clubId)}/requests/${r.id}`, { status: 'WITHDRAWN', revision: r.revision }), copy('withdrawn'))}>{copy('withdraw')}</Button>}
                        <Badge tone={badge.tone}>{badge.text}</Badge></>} />;
            })}</List>
                : <EmptyNote title={copy('noRequests')}>{copy('noRequestsHint')}</EmptyNote>}</Panel>
        </Section>
    </div>;
}
