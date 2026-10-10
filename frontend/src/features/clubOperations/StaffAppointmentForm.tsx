import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Avatar, Button, Chip, Field, GkRoot, List, ListRow, PageHeader, Panel, SearchInput } from '../../design/primitives';
import { useClubEditorClose } from './useClubEditorClose';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, put, root, label, appointmentScope, appointmentSquads, moduleNames, dateOnly, clubToday, scopePayload, type Bootstrap, type Appointment, type Choice } from './api';
import type { StaffScopeSelection } from './StaffScopePicker';
import type { StaffRole } from './useWorkspaceRoles';
import { ScopeChips } from './ScopeChips';
import './records/records.css';

const specialisationFor = (key: string) => key === 'TRAVEL_COORDINATOR' ? 'TEAM_MANAGER' : key === 'FACILITIES_COORDINATOR' ? 'OTHER' : key;

/** Inviting a staff member, or changing an appointment, on one page: who, which role and squads, which tools. */
export function StaffAppointmentForm({ boot, appointment, initialPerson, roles = [], onSaved, onCancel }: {
  boot: Bootstrap; appointment?: Appointment; initialPerson?: Choice; roles?: StaffRole[]; onSaved: () => void; onCancel: () => void;
}) {
  const [person, setPerson] = useState<Choice | null>(appointment ? { id: appointment.user_id, name: appointment.name ?? 'Staff member' } : initialPerson ?? null);
  const [query, setQuery] = useState(''), [matches, setMatches] = useState<Choice[]>([]), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const [title, setTitle] = useState(appointment?.title ?? ''), [specialisations, setSpecialisations] = useState(appointment?.specialisations ?? []);
  const [permissions, setPermissions] = useState<Record<string, string>>(Object.fromEntries(appointment?.permissions.map(p => p.split(':')) ?? []));
  const [engagement, setEngagement] = useState(appointment?.engagement ?? 'VOLUNTEER');
  const [scope, setScope] = useState<StaffScopeSelection>(appointment ? { clubWide: appointment.squad_id == null, squadIds: appointmentSquads(appointment) } : { clubWide: false, squadIds: [] });
  const [starts, setStarts] = useState(appointment ? dateOnly(appointment.starts_on) : clubToday(boot.settings.timezone || undefined)), [ends, setEnds] = useState(dateOnly(appointment?.ends_on));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const saving = useRef(false);
  const [preset, setPreset] = useState('');
  const availableRoles: StaffRole[] = roles.length ? roles : boot.specialisations.map(key => ({ key, title: label(key), description: 'Choose the workspace access this person needs.', permissions: key === 'REFEREE' ? ['FACILITIES:READ'] : [] }));
  useEffect(() => {
    const c = new AbortController(); setSearchError(''); setMatches([]);
    if (person || query.trim().length < 2) { setSearching(false); return () => c.abort(); }
    setSearching(true);
    const timer = setTimeout(() => { void get<Choice[]>(`${root(boot.clubId)}/staff-candidates?q=${encodeURIComponent(query.trim())}`, c.signal).then(rows => { if (!c.signal.aborted) setMatches(rows); }).catch(e => { if (!c.signal.aborted) setSearchError(extractApiErrorMessage(e, 'Could not find accounts.')); }).finally(() => { if (!c.signal.aborted) setSearching(false); }); }, 250);
    return () => { clearTimeout(timer); c.abort(); };
  }, [query, person, boot.clubId]);
  const draft = JSON.stringify({ person, title, specialisations, permissions, engagement, scope, starts, ends }), initial = useRef(draft);
  const { requestClose, confirmation } = useClubEditorClose(draft !== initial.current, busy, onCancel);
  const assigned = Object.entries(permissions).filter(([, v]) => v);
  const chooseRole = (key: string) => {
    setPreset(key); const role = availableRoles.find(r => r.key === key); if (!role) return;
    setTitle(role.title); setSpecialisations([specialisationFor(key)]); setPermissions(Object.fromEntries(role.permissions.map(p => p.split(':'))));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (saving.current) return;
    if (!person || !specialisations.length) { setError('Choose a person and at least one football responsibility.'); return; }
    if (!scope.clubWide && !scope.squadIds.length) { setError('Select at least one squad or choose the whole club.'); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      const payload = { userId: person.id, title, specialisations, engagement, ...scopePayload(scope), permissions: assigned.map(([m, v]) => `${m}:${v}`), startsOn: starts, endsOn: ends || null, revision: appointment?.revision };
      if (appointment) await put(`${root(boot.clubId)}/appointments/${appointment.id}`, payload); else await post(`${root(boot.clubId)}/appointments`, payload);
      onSaved();
    } catch (failure) { setError(extractApiErrorMessage(failure, 'Could not send this invitation.')); } finally { saving.current = false; setBusy(false); }
  };
  const confidential = assigned.filter(([m]) => ['MEDICAL', 'WELFARE'].includes(m));
  const description = availableRoles.find(r => r.key === preset)?.description;

  return <GkRoot className="rec-page">
    <div className="rec-back"><Button variant="ghost" size="sm" disabled={busy} onClick={requestClose}><ArrowLeft aria-hidden="true" />Back to staff</Button></div>
    <PageHeader title={appointment ? 'Change appointment' : 'Invite a staff member'} subtitle={appointment ? 'The person reviews the changes and accepts them before they apply.' : 'Choose their role, squads and the tools they need. They accept before any access starts.'} />
    <form className="rec-form" aria-label="Staff appointment" onSubmit={e => { void submit(e); }}>
      {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
      <fieldset disabled={busy}><Panel flush>
        <section className="rec-form__group"><div className="rec-form__group-head"><h3>Person</h3><p>An existing adult account. Several football responsibilities never make someone a club administrator.</p></div>
          {person ? <div className="gk-row"><Avatar name={person.name} size={40} /><div><strong>{person.name}</strong><p className="gk-muted">{appointment ? 'Person on this appointment' : 'Account selected'}</p></div>
            {!appointment && <Button size="sm" variant="ghost" onClick={() => { setPerson(null); setQuery(''); }}><X aria-hidden="true" />Change person</Button>}</div>
            : <Field label="Find an account" htmlFor="staff-person-search" hint={query.trim().length < 2 ? 'Enter at least two characters of a name or username.' : undefined}>
              <SearchInput id="staff-person-search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or username" maxLength={100} />
              <div aria-live="polite">{searchError ? <p role="alert" className="gk-field__error">{searchError}</p> : searching ? <p className="gk-field__hint">Finding accounts…</p>
                : query.trim().length >= 2 && !matches.length ? <p className="gk-field__hint">No eligible accounts found. The person needs a verified adult account.</p>
                  : matches.length > 0 && <Panel flush><List label="Matching accounts">{matches.map(m => <ListRow key={m.id} lead={<Avatar name={m.name} size={32} />} title={m.name} meta={`Account #${m.id}`} trail={<Check aria-hidden="true" />} onClick={() => setPerson(m)} />)}</List></Panel>}</div>
            </Field>}
        </section>
        <section className="rec-form__group"><div className="rec-form__group-head"><h3>Role and squads</h3>{description && <p>{description}</p>}</div>
          <div className="rec-fields">
            <Field label="Role" htmlFor="staff-role"><select id="staff-role" className="gk-input" value={preset} onChange={e => chooseRole(e.target.value)}><option value="">Choose a role</option>
              {[...new Set(availableRoles.map(r => r.family ?? 'Staff responsibilities'))].map(family => <optgroup key={family} label={family}>{availableRoles.filter(r => (r.family ?? 'Staff responsibilities') === family).map(r => <option key={r.key} value={r.key}>{r.title}</option>)}</optgroup>)}</select></Field>
            <Field label="Appointment title" htmlFor="staff-title"><input id="staff-title" className="gk-input" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="For example, U12 goalkeeper coach" /></Field>
            <div className="rec-wide"><ScopeChips squads={boot.squads} value={scope} onChange={setScope} disabled={busy} /></div>
            <Field label="Engagement" htmlFor="staff-engagement"><select id="staff-engagement" className="gk-input" value={engagement} onChange={e => setEngagement(e.target.value)}>{['VOLUNTEER', 'EMPLOYEE', 'CONTRACTOR', 'SHARED_STAFF'].map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
            <Field label="Starts" htmlFor="staff-starts" hint={`Dates use ${boot.settings.timezone || 'Asia/Tbilisi'}.`}><input id="staff-starts" className="gk-input" required type="date" value={starts} onChange={e => setStarts(e.target.value)} /></Field>
            <Field label={<>Ends <span className="rec-optional">(optional)</span></>} htmlFor="staff-ends"><input id="staff-ends" className="gk-input" type="date" min={starts} value={ends} onChange={e => setEnds(e.target.value)} /></Field>
          </div>
          <fieldset className="cw-scope"><legend className="gk-field__label">Football responsibilities</legend>
            <div className="gk-chips">{boot.specialisations.map(s => <Chip key={s} pressed={specialisations.includes(s)} onClick={() => setSpecialisations(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s])}>{label(s)}</Chip>)}</div>
          </fieldset>
        </section>
        <section className="rec-form__group"><div className="rec-form__group-head"><h3>Workspace access</h3><p>A role title alone never grants access. Review each tool.</p></div>
          {assigned.length ? <ul className="rec-switches">{assigned.map(([module, access]) => <li key={module}><div className="rec-switch">
            <span><strong>{moduleNames[module]}</strong></span>
            <span className="gk-row"><select className="gk-input" aria-label={`${moduleNames[module]} access`} value={access} onChange={e => setPermissions(p => ({ ...p, [module]: e.target.value }))}><option value="READ">View only</option><option value="WRITE">View and manage</option></select>
              <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${moduleNames[module]} access`} onClick={() => setPermissions(p => ({ ...p, [module]: '' }))}><X aria-hidden="true" /></Button></span>
          </div></li>)}</ul> : <p className="gk-muted">No club workspace access. A referee can still receive match invitations in their own workspace.</p>}
          <Field label="Add a tool" htmlFor="staff-add-module"><select id="staff-add-module" className="gk-input" value="" onChange={e => { if (e.target.value) setPermissions(p => ({ ...p, [e.target.value]: 'READ' })); }}><option value="">Choose a tool</option>{Object.entries(moduleNames).filter(([m]) => !permissions[m]).map(([m, name]) => <option key={m} value={m}>{name}</option>)}</select></Field>
          {confidential.length > 0 && <div className="gk-notice gk-notice--warning" role="status">This invitation includes confidential {confidential.map(([m]) => moduleNames[m].toLowerCase()).join(' and ')} records. Check that this is part of the person’s responsibilities.</div>}
          {appointment?.status === 'ACTIVE' && <div className="gk-notice gk-notice--warning" role="status">Sending this revision pauses the current access until the person accepts again.</div>}
        </section>
      </Panel></fieldset>
      <div className="rec-actions">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : appointment ? 'Send revised invitation' : 'Send invitation'}</Button>
        <Button variant="ghost" disabled={busy} onClick={requestClose}>Cancel</Button>
        <p className="rec-actions__note">{person ? `${person.name} · ` : ''}{title || 'No role yet'} · {scope.clubWide || scope.squadIds.length ? appointmentScope({ squad_id: scope.squadIds[0] ?? null, squad_ids: scope.clubWide ? [] : scope.squadIds }, boot.squads) : 'no squads selected'} · {assigned.length} {assigned.length === 1 ? 'tool' : 'tools'}</p>
      </div>
      {confirmation}
    </form>
  </GkRoot>;
}
