import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyNote, Field, Panel, Section } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { AppointmentSummary } from '../../clubOperations/AppointmentSummary';
import { appointmentScope, label, post, root, scopePayload } from '../../clubOperations/api';
import type { StaffScopeSelection } from '../../clubOperations/StaffScopePicker';
import { rolesRoot, type RolesWorkspace, type StaffRole } from '../../clubOperations/useWorkspaceRoles';
import { focusableViews } from '../../clubOperations/workspaceStructure';
import { useClubEditorClose } from '../../clubOperations/useClubEditorClose';
import { accessSummary, requestBadge } from '../../clubOperations/roleAccess';
import { ScopeChips } from '../../clubOperations/ScopeChips';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { responsibilitiesEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import '../club-workspace.css';
import './coach-hub.css';

interface Draft { role: string; scope: StaffScopeSelection; note: string; replace: string }
const EMPTY: Draft = { role: '', scope: { clubWide: false, squadIds: [] }, note: '', replace: '' };
const toneOf = (tone: string) => (['danger', 'warning', 'info'].includes(tone) ? tone : tone === 'accent' ? 'accent' : 'neutral');

/**
 * Asking the club for another responsibility: pick it from the club's jobs (chips by family), say for which
 * squads, send. Then every request already made, in the dot-and-word language. Nothing is granted here: a
 * club admin approves each request before access changes.
 */
export function ResponsibilityRequests({ open, clubId, roles, onClose, onChanged }: { open: boolean; clubId: number; roles: RolesWorkspace; onClose: () => void; onChanged: () => void }) {
    const copy = useCopy('responsibilities', responsibilitiesEn);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState('');
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const { requestClose, confirmation } = useClubEditorClose(JSON.stringify(draft) !== JSON.stringify(EMPTY), busy, () => { setDraft(EMPTY); setError(''); setSent(''); onClose(); });
    const mine = roles.requests.filter(r => r.user_id === roles.actorId);
    const pending = mine.find(r => r.status === 'PENDING');
    const replaceable = focusableViews(roles.views).filter(v => v.appointmentId);
    const family = (role: StaffRole) => role.family ?? copy('familyFallback');
    const families = [...new Set(roles.catalog.map(family))];
    const role = roles.catalog.find(item => item.key === draft.role);
    const taken = (key: string) => mine.some(r => r.role_key === key && ['PENDING', 'APPROVED'].includes(r.status));

    const run = async (work: () => Promise<unknown>, done: string) => {
        if (busy) return;
        setBusy(true); setError(''); setSent('');
        try { await work(); setDraft(EMPTY); setSent(done); onChanged(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('updateError'))); }
        finally { setBusy(false); }
    };
    const submit = () => {
        if (!role) return;
        if (!draft.scope.clubWide && !draft.scope.squadIds.length) { setError(copy('chooseScope')); return; }
        const original = replaceable.find(v => String(v.appointmentId) === draft.replace);
        void run(() => post(`${rolesRoot(clubId)}/requests`, { roleKey: role.key, ...scopePayload(draft.scope), replaceAppointmentId: original?.appointmentId ?? null, replaceRevision: original?.revision ?? null, note: draft.note || null }),
            copy('sent', { name: role.title.toLowerCase() }));
    };

    return <Dialog open={open} size="lg" title={copy('takeOn')} description={copy('adminApproves')} onClose={requestClose}>
        <div className="gk-stack">
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
            {sent && <div className="gk-notice cw-notices__success" role="status">{sent}</div>}
            {roles.invitations.length > 0 && <Section title={copy('waitingAnswer')}>
                <div className="gk-stack gk-stack--tight">{roles.invitations.map(a => <AppointmentSummary key={a.id} appointment={a} squads={roles.requestSquads}>
                    <Link className="appointment-summary__primary" to={`/club-operations?appointmentId=${a.id}`}>{copy('reviewAccept')}</Link>
                    <button type="button" className="appointment-summary__quiet" disabled={busy} onClick={() => void run(() => post(`${root(clubId)}/appointments/${a.id}/transition`, { status: 'DECLINED', revision: a.revision }), copy('declined'))}>{copy('decline')}</button>
                </AppointmentSummary>)}</div>
            </Section>}
            {pending ? <p className="gk-notice" role="status">{copy('oneAtATime')}</p>
                : <form className="gk-stack" onSubmit={event => { event.preventDefault(); submit(); }}>
                    {/* The club's jobs as chips, a line per family; one is chosen at a time. */}
                    <div className="ch-roles" role="radiogroup" aria-label="Responsibility">{families.map(name => <div key={name} className="ch-roles__family">
                        <span className="ch-roles__name">{name}</span>
                        <span className="ch-roles__chips">{roles.catalog.filter(item => family(item) === name).map(item => <button key={item.key} type="button" role="radio" className="gk-chip" aria-checked={draft.role === item.key} aria-pressed={draft.role === item.key}
                            disabled={busy || taken(item.key)} title={taken(item.key) ? copy('yourRequests') : undefined} onClick={() => setDraft({ ...draft, role: item.key })}>{item.title}</button>)}</span>
                    </div>)}</div>
                    {role && <>
                        <p className="cw-muted">{role.description} <strong>{copy('includes')}</strong> {accessSummary(role.permissions) || copy('noTools')}.</p>
                        <ScopeChips squads={roles.requestSquads} value={draft.scope} disabled={busy} onChange={scope => setDraft({ ...draft, scope })} />
                        {replaceable.length > 0 && <div className="ch-roles__family">
                            <span className="ch-roles__name">{copy('replaceLabel')}</span>
                            <span className="ch-roles__chips">
                                <button type="button" className="gk-chip" aria-pressed={draft.replace === ''} disabled={busy} onClick={() => setDraft({ ...draft, replace: '' })}>{copy('alongside')}</button>
                                {replaceable.map(v => <button key={v.id} type="button" className="gk-chip" aria-pressed={draft.replace === String(v.appointmentId)} disabled={busy} onClick={() => setDraft({ ...draft, replace: String(v.appointmentId) })}>{copy('replace', { name: v.label })}</button>)}
                            </span>
                        </div>}
                        <Field label={copy('messageLabel')} htmlFor="ch-note">
                            <textarea id="ch-note" className="gk-input" rows={2} maxLength={1000} placeholder={copy('messagePlaceholder')} value={draft.note} disabled={busy} onChange={event => setDraft({ ...draft, note: event.target.value })} />
                        </Field>
                        <div className="gk-row"><Button type="submit" variant="primary" disabled={busy}>{busy ? copy('sending') : copy('send')}</Button><span className="gk-field__hint">{copy('sendHint')}</span></div>
                    </>}
                </form>}
            {confirmation}
            <Section boxed title={copy('yourRequests')} hint={mine.length ? `${mine.length}` : undefined}>
                <Panel flush>{mine.length ? <ul className="ch-requests" aria-label={copy('yourRequests')}>{mine.map(r => {
                    const badge = requestBadge(r.effective_status ?? r.status), tone = toneOf(badge.tone);
                    return <li key={r.id} className="ch-request">
                        <span className={`cw-dot cw-dot--${tone}`} aria-hidden="true" />
                        <span className="ch-request__text">
                            <strong>{roles.catalog.find(c => c.key === r.role_key)?.title ?? label(r.role_key)}</strong>
                            <span>{appointmentScope({ squad_id: r.squad_id ?? null, ...r }, roles.requestSquads)}</span>
                            {(r.review_note || r.unavailable_reason) && <span className="ch-request__reply">{r.review_note ? copy('adminReply', { text: r.review_note }) : r.unavailable_reason}</span>}
                        </span>
                        {r.status === 'PENDING' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`${rolesRoot(clubId)}/requests/${r.id}`, { status: 'WITHDRAWN', revision: r.revision }), copy('withdrawn'))}>{copy('withdraw')}</Button>}
                        <span className={`cw-status cw-status--${tone}`}>{badge.text}</span>
                    </li>;
                })}</ul> : <EmptyNote title={copy('noRequests')}>{copy('noRequestsHint')}</EmptyNote>}</Panel>
            </Section>
        </div>
    </Dialog>;
}
