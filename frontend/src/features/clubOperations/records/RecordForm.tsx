import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, PageHeader, Panel } from '../../../design/primitives';
import { FacilityCard } from '../../clubs/ClubPlaceCard';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { label, post, put, root, type Bootstrap, type Definition, type Field as FieldDefinition, type OperationRecord } from '../api';
import { editorDescription, fieldGroups } from '../editorPresentation';
import { FacilityFields } from '../FacilityFields';
import { useClubEditorClose } from '../useClubEditorClose';
import { LegacyIsland } from './LegacyIsland';
import { PlainField, RecordField } from './recordFields';
import './records.css';
import { appLanguage } from '../../../utils/formatting';

// Records about one person, and records that hang off another record.
const subjects = new Set(['STAFF_AVAILABILITY', 'CREDENTIAL', 'CONSENT', 'COLLECTION', 'EMERGENCY_CONTACT', 'ATTENDANCE', 'MEDICAL_APPOINTMENT', 'CLINICAL_NOTE', 'RESTRICTION', 'GOAL', 'OBSERVATION', 'REVIEW', 'EDUCATION_ABSENCE', 'EDUCATION_CONTACT', 'REGISTRATION', 'INSTALMENT', 'FINANCIAL_SUPPORT', 'PASSENGER', 'DEPARTURE', 'EQUIPMENT_ISSUE']);
const relatedKinds: Record<string, string> = { EQUIPMENT_ISSUE: 'ASSET', MAINTENANCE: 'ASSET', PASSENGER: 'TRIP', EMERGENCY_PLAN: 'FACILITY', MATCH_PREPARATION: 'EMERGENCY_PLAN' };
const numberOrNull = (value: string) => value ? Number(value) : null;

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return <section className="rec-form__group"><div className="rec-form__group-head"><h3>{title}</h3>{description && <p>{description}</p>}</div>{children}</section>;
}

/**
 * One page for creating or editing any club record: the details, who is responsible, then save.
 * Unsaved work is kept until the person saves or confirms discarding it.
 */
export function RecordForm({ boot, definition, record, backLabel, onSaved, onCancel }: { boot: Bootstrap; definition: Definition; record?: OperationRecord; backLabel: string; onSaved: () => Promise<void>; onCancel: () => void }) {
    const formId = useId();
    const form = useRef<HTMLFormElement>(null);
    const [title, setTitle] = useState(record?.title ?? '');
    const [squad, setSquad] = useState(record?.squad_id?.toString() ?? boot.defaultSquadId?.toString() ?? '');
    const [subject, setSubject] = useState(record?.subject_user_id?.toString() ?? boot.defaultSubjectId?.toString() ?? '');
    const [assignee, setAssignee] = useState(record?.assigned_user_id?.toString() ?? '');
    const [event, setEvent] = useState(record?.event_id?.toString() ?? '');
    const [session, setSession] = useState(record?.session_id?.toString() ?? (['ATTENDANCE', 'CONSENT', 'DUTY'].includes(definition.kind) ? boot.defaultSessionId?.toString() : undefined) ?? '');
    const [related, setRelated] = useState(record?.related_record_id?.toString() ?? '');
    const [due, setDue] = useState(record?.due_on?.slice(0, 10) ?? '');
    const [data, setData] = useState<Record<string, string>>(record?.data ?? (boot.settings.currency && definition.fields.some(f => f.key === 'currency') ? { currency: boot.settings.currency } : {}));
    const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
    const [saved, setSaved] = useState<OperationRecord | null>(null);
    const saving = useRef(false);
    const ka = appLanguage() === 'ka';
    const facility = definition.kind === 'FACILITY';
    const draft = JSON.stringify({ title, squad, subject, assignee, event, session, related, due, data });
    const initial = useRef(draft);
    const { requestClose, confirmation } = useClubEditorClose(!saved && draft !== initial.current, busy || uploading, onCancel);
    const permission = boot.modules.find(m => m.id === definition.module);
    const guardianDecision = ['CONSENT', 'COLLECTION'].includes(definition.kind);
    const playerSubject = subjects.has(definition.kind) && !['STAFF_AVAILABILITY', 'CREDENTIAL'].includes(definition.kind);
    const people = boot.people.filter(p => !playerSubject || !squad || !boot.peopleBySquad || boot.peopleBySquad.some(link => link.id === p.id && link.squad_id === Number(squad)) || record?.subject_user_id === p.id);
    const staff = guardianDecision ? boot.guardians.filter(g => g.child_id === Number(subject)) : boot.staff;
    const change = (key: string, value: string) => setData(previous => ({ ...previous, [key]: value }));
    const groups = fieldGroups(definition);
    const [main, ...rest] = groups[0]?.title === 'Main details' ? groups : [{ title: 'Main details', description: '', fields: [] as FieldDefinition[] }, ...groups];
    const dates = rest.find(g => g.title === 'Dates & times');
    const others = rest.filter(g => g !== dates);
    const renderField = (field: FieldDefinition) => <RecordField key={field.key} definition={definition} field={field} value={data[field.key] ?? ''} onChange={value => change(field.key, value)} boot={boot} />;

    // Fields inside a closed disclosure cannot show the browser's message, so open it first.
    const firstInvalid = () => {
        const controls = Array.from(form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? []);
        const invalid = controls.find(control => control.willValidate && !control.validity.valid);
        if (!invalid) return false;
        for (let parent = invalid.parentElement; parent && parent !== form.current; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
        requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
        return true;
    };
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (saving.current || uploading) return;
        if (saved) { await refreshSaved(); return; }
        if (firstInvalid()) return;
        if (facility && Boolean(data.latitude?.trim()) !== Boolean(data.longitude?.trim())) { setError('Enter both entrance coordinates, or remove the pin in Place & location.'); return; }
        setBusy(true); setError('');
        try {
            const body = { kind: definition.kind, title, squadId: numberOrNull(squad), subjectUserId: numberOrNull(subject), assignedUserId: numberOrNull(assignee), eventId: numberOrNull(event), sessionId: numberOrNull(session), relatedRecordId: numberOrNull(related), dueOn: due || null, data, revision: record?.revision ?? null };
            if (record) await put(`${root(boot.clubId)}/records/${record.id}`, body); else await post(`${root(boot.clubId)}/records`, body);
            await onSaved();
        } catch (failure) { setError(extractApiErrorMessage(failure, 'Could not save this record. Your changes are still here.')); }
        finally { setBusy(false); }
    };

    const responsibility = <Group title={facility ? 'Responsibility & scope' : 'Responsibility'} description={facility ? 'Who uses this place and who keeps its information up to date.' : 'Who is involved, and the event or session it belongs to.'}>
        <div className="rec-fields">
            <PlainField id={`${formId}-squad`} label="Squad" hint={permission?.globalWrite ? 'Leave as club-wide when it is not about one squad.' : undefined}>
                <select id={`${formId}-squad`} className="gk-input" required={!permission?.globalWrite} value={squad} onChange={e => { setSquad(e.target.value); if (playerSubject && !record) setSubject(''); if (!record) setSession(''); }}>
                    <option value="">Club-wide</option>{boot.squads.filter(s => permission?.globalWrite || permission?.writeSquads.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </PlainField>
            <PlainField id={`${formId}-assignee`} label={guardianDecision ? 'Guardian who decides' : 'Responsible staff member'} optional={!guardianDecision && definition.kind !== 'DUTY'} hint={guardianDecision ? 'Only the confirmed guardian can give or withdraw this permission.' : undefined}>
                <select id={`${formId}-assignee`} className="gk-input" required={guardianDecision || definition.kind === 'DUTY'} value={assignee} onChange={e => setAssignee(e.target.value)}>
                    <option value="">{guardianDecision ? 'Choose confirmed guardian' : 'Unassigned'}</option>{staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </PlainField>
            {!['FACILITY', 'ASSET', 'CREDENTIAL', 'EDUCATION_CONTACT', 'BUDGET', 'FINANCIAL_SUPPORT'].includes(definition.kind) && <PlainField id={`${formId}-event`} label="Related event" optional={!(definition.kind === 'MATCH_PREPARATION' || definition.kind === 'ATTENDANCE' && !session)}>
                <select id={`${formId}-event`} className="gk-input" required={definition.kind === 'MATCH_PREPARATION' || definition.kind === 'ATTENDANCE' && !session} disabled={Boolean(record) || Boolean(session)} value={event} onChange={e => setEvent(e.target.value)}>
                    <option value="">No event</option>{boot.events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} · {ev.starts_at.slice(0, 10)}</option>)}
                </select>
            </PlainField>}
            {['ATTENDANCE', 'CONSENT', 'DUTY'].includes(definition.kind) && <PlainField id={`${formId}-session`} label="Training session" optional>
                <select id={`${formId}-session`} className="gk-input" disabled={Boolean(record) || Boolean(event)} value={session} onChange={e => setSession(e.target.value)}>
                    <option value="">No training session</option>{boot.sessions.filter(s => !squad || !s.squad_id || s.squad_id === Number(squad)).map(s => <option key={s.id} value={s.id}>{s.title} · {s.squad_name} · {s.starts_at.slice(0, 10)}</option>)}
                </select>
            </PlainField>}
            <PlainField id={`${formId}-due`} label="Next action or review date" optional hint="A reminder to follow up. It does not schedule an event.">
                <input id={`${formId}-due`} className="gk-input" type="date" value={due} onChange={e => setDue(e.target.value)} />
            </PlainField>
        </div>
    </Group>;

    const verb = record ? 'Edit' : 'New';
    return <div className="rec-page">
        <div className="rec-back"><Button variant="ghost" size="sm" disabled={busy} onClick={requestClose}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
        <PageHeader title={`${verb} ${definition.label.toLowerCase()}`} subtitle={editorDescription(definition)} />
        <form id={formId} ref={form} noValidate className="rec-form" aria-label={`${verb} ${definition.label.toLowerCase()}`} onSubmit={e => { void submit(e); }}
            onKeyDown={e => { if (e.key === 'Escape' && !busy && !e.defaultPrevented) { e.preventDefault(); requestClose(); } }}>
            {saved && <div className="gk-notice gk-notice--success" role="status">{ka ? `შენახულია: ${saved.title} · #${saved.id}` : `Saved: ${saved.title} · #${saved.id}`}</div>}
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
            <fieldset disabled={busy || uploading || Boolean(saved)}>
                <Panel flush>
                    <Group title={facility ? 'Place & location' : definition.label} description={facility ? 'A playing venue or a supporting facility, and how the club uses it.' : undefined}>
                        <div className="rec-fields">
                            <PlainField id={`${formId}-title`} label={facility ? 'Location name' : 'Title'} wide>
                                <input id={`${formId}-title`} className="gk-input" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} />
                            </PlainField>
                            {subjects.has(definition.kind) && <PlainField id={`${formId}-person`} label="Person" optional={definition.kind === 'EQUIPMENT_ISSUE'}>
                                <select id={`${formId}-person`} className="gk-input" required={definition.kind !== 'EQUIPMENT_ISSUE'} disabled={Boolean(record)} value={subject} onChange={e => { setSubject(e.target.value); if (guardianDecision) setAssignee(''); }}>
                                    <option value="">Choose a person</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </PlainField>}
                            {relatedKinds[definition.kind] && <PlainField id={`${formId}-related`} label={`Related ${label(relatedKinds[definition.kind]).toLowerCase()}`}>
                                <select id={`${formId}-related`} className="gk-input" required disabled={Boolean(record)} value={related} onChange={e => setRelated(e.target.value)}>
                                    <option value="">Choose</option>{boot.links.filter(l => l.kind === relatedKinds[definition.kind]).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                                </select>
                            </PlainField>}
                            {!facility && definition.fields.filter(f => main.fields.includes(f) || dates?.fields.includes(f)).map(renderField)}
                        </div>
                        {facility && <FacilityFields mode="place" boot={boot} definition={definition} data={data} change={values => setData(previous => ({ ...previous, ...values }))} renderField={renderField} onUploading={setUploading} />}
                    </Group>
                    {facility && <Group title="Visitor information" description="Optional photos and practical details for players, families and visiting teams.">
                        <FacilityFields mode="visitors" boot={boot} definition={definition} data={data} change={values => setData(previous => ({ ...previous, ...values }))} renderField={renderField} onUploading={setUploading} />
                    </Group>}
                    {responsibility}
                    {!facility && others.map(group => <Group key={group.title} title={group.title} description={group.description}><div className="rec-fields">{group.fields.map(renderField)}</div></Group>)}
                </Panel>
            </fieldset>
            {facility && <Panel padded title="Public page preview"><LegacyIsland className="club-public"><FacilityCard clubId={boot.clubId} facility={{ id: record?.id ?? 0, title: title || 'Location name', details: data, squadId: squad ? Number(squad) : null, squadName: boot.squads.find(s => String(s.id) === squad)?.name }} /></LegacyIsland></Panel>}
            <div className="rec-actions">
                <Button type="submit" variant="primary" disabled={busy || uploading}>{saved ? busy ? (ka ? 'ახლდება…' : 'Refreshing…') : (ka ? 'შენახული ჩანაწერის განახლება' : 'Refresh saved record') : busy ? 'Saving…' : record ? 'Save changes' : `Save ${definition.label.toLowerCase()}`}</Button>
                <Button variant="ghost" disabled={busy} onClick={requestClose}>{saved ? (ka ? 'დახურვა' : 'Close') : 'Cancel'}</Button>
                <p className="rec-actions__note">{facility ? 'New venues and facilities are saved as drafts. Publish from the saved record when the information is ready.'
                    : definition.module === 'FINANCE' ? 'Saving or approving this record does not transfer money.' : 'Documents can be attached after saving.'}</p>
            </div>
            {confirmation}
        </form>
    </div>;
}
