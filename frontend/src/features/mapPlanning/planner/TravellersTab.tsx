import { useEffect, useId, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { Avatar, Badge, Button, EmptyNote, Field, List, Section, StatTile } from '../../../design/primitives';
import type { Plan, PlanContext, PlanDraft, PlanVehicle } from '../api';
import { TravelDay } from './TravelDay';
import { replyOf, REPLY_LABEL } from './replies';

interface StaffMember { userId: number; fullName: string; avatarUrl?: string | null; title?: string | null }

function useClubStaff(clubId: number) {
    const [state, setState] = useState<{ club: number; staff: StaffMember[]; error: boolean }>();
    useEffect(() => {
        if (!clubId) return;
        const controller = new AbortController();
        void apiClient.get<StaffMember[]>(`/clubs/${clubId}/staff`, { signal: controller.signal })
            .then(response => setState({ club: clubId, staff: response.data, error: false }))
            .catch(() => { if (!controller.signal.aborted) setState({ club: clubId, staff: [], error: true }); });
        return () => controller.abort();
    }, [clubId]);
    return state?.club === clubId ? state : null;
}

function Check({ checked, onChange, disabled, name, detail, avatar, trail }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; name: string; detail?: string; avatar?: string | null; trail?: ReactNode }) {
    return (
        <li>
            <label className="gk-list-row gk-plan-person">
                <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
                <Avatar src={avatar} name={name} size={32} />
                <span className="gk-list-row__main"><span className="gk-list-row__title">{name}</span>{detail && <span className="gk-list-row__meta">{detail}</span>}</span>
                {trail && <span className="gk-list-row__trail">{trail}</span>}
            </label>
        </li>
    );
}

function VehicleForm({ onAdd }: { onAdd: (vehicle: PlanVehicle) => void }) {
    const labelId = useId(), driverId = useId(), seatsId = useId();
    const [vehicle, setVehicle] = useState({ label: '', driver: '', seats: 4 });
    return (
        <form className="gk-plan-vehicle-form" onSubmit={event => { event.preventDefault(); if (!vehicle.label.trim()) return; onAdd({ key: crypto.randomUUID(), label: vehicle.label.trim(), driver: vehicle.driver.trim(), seats: Math.max(1, vehicle.seats) }); setVehicle({ label: '', driver: '', seats: 4 }); }}>
            <Field label="Vehicle" htmlFor={labelId}><input id={labelId} className="gk-input" maxLength={80} value={vehicle.label} placeholder="Minibus, or a parent’s car" onChange={event => setVehicle({ ...vehicle, label: event.target.value })} /></Field>
            <Field label="Driver" htmlFor={driverId}><input id={driverId} className="gk-input" maxLength={80} value={vehicle.driver} placeholder="Name" onChange={event => setVehicle({ ...vehicle, driver: event.target.value })} /></Field>
            <Field label="Passenger seats" htmlFor={seatsId}><input id={seatsId} className="gk-input" type="number" min={1} max={80} value={vehicle.seats} onChange={event => setVehicle({ ...vehicle, seats: Number(event.target.value) || 1 })} /></Field>
            <Button type="submit" disabled={!vehicle.label.trim()}><Plus aria-hidden="true" />Add vehicle</Button>
        </form>
    );
}

/**
 * Who travels: the squad's players, the staff going with them, and the vehicles that
 * carry everyone. Replies from families appear beside each player once the plan is shared.
 */
export function TravellersTab({ draft, plan, context, squad, canEdit, busy, change, command }: {
    draft: PlanDraft; plan: Plan | null; context?: PlanContext; squad: number; canEdit: boolean; busy: boolean;
    change: (patch: Partial<PlanDraft>) => void; command: (path: string, extra?: Record<string, unknown>) => Promise<boolean>;
}) {
    const contactId = useId();
    const roster = context?.participants.filter(person => person.squad_id === squad) ?? [];
    const available = new Set(roster.map(person => person.id));
    const unavailable = draft.participants.filter(id => !available.has(id));
    const staff = useClubStaff(context?.id ?? 0);
    const chosenStaff = draft.staff ?? [];
    const vehicles = draft.vehicles ?? [];
    const seats = vehicles.reduce((total, vehicle) => total + vehicle.seats, 0);
    const people = draft.participants.length + chosenStaff.length;
    const toggle = (list: number[], id: number, on: boolean) => on ? [...new Set([...list, id])] : list.filter(item => item !== id);
    return (
        <div className="gk-plan-body">
            <div className="gk-stats">
                <StatTile label="Players" value={draft.participants.length} hint={`of ${roster.length} in the squad`} />
                <StatTile label="Staff" value={chosenStaff.length} />
                <StatTile label="Seats" value={vehicles.length ? `${seats}` : '—'} hint={vehicles.length ? (seats >= people ? `${seats - people} spare` : `${people - seats} short`) : 'No vehicles yet'} tone={vehicles.length && seats < people ? 'attention' : undefined} />
            </div>
            <Section title="Players" action={canEdit && roster.length ? <div className="gk-row">
                <Button size="sm" variant="ghost" onClick={() => change({ participants: [...new Set([...draft.participants.filter(id => available.has(id)), ...roster.map(person => person.id)])] })}>Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => change({ participants: [] })}>Clear</Button>
            </div> : undefined}>
                {unavailable.length > 0 && (
                    <div className="gk-notice gk-notice--warning" role="status">
                        <span className="gk-world-grow">{unavailable.length === 1 ? 'One chosen player is' : `${unavailable.length} chosen players are`} no longer on this squad’s roster. Remove them before saving; everything else is kept.</span>
                        {canEdit && <Button size="sm" aria-label="Remove unavailable players" onClick={() => change({ participants: draft.participants.filter(id => available.has(id)) })}>Remove</Button>}
                    </div>
                )}
                {roster.length ? (
                    <List label="Players" className="gk-plan-list">
                        {roster.map(person => {
                            const reply = plan?.published_version ? replyOf(plan, person.id) : null;
                            return <Check key={person.id} name={person.name} checked={draft.participants.includes(person.id)} disabled={!canEdit}
                                onChange={on => change({ participants: toggle(draft.participants, person.id, on) })}
                                trail={reply && draft.participants.includes(person.id) ? <Badge tone={reply === 'GOING' ? 'accent' : reply === 'NOT_GOING' ? 'danger' : 'warning'}>{REPLY_LABEL[reply]}</Badge> : undefined} />;
                        })}
                    </List>
                ) : <EmptyNote title="No players on this squad’s roster">Players added to the squad appear here.</EmptyNote>}
                <p className="gk-faint">Families linked to these players receive the itinerary and any travel permission request when you publish.</p>
            </Section>
            <Section title="Staff travelling">
                {!staff ? <p className="gk-faint" role="status">Loading staff…</p> : staff.error ? <p className="gk-faint">Staff could not load.</p> : (
                    <List label="Staff" className="gk-plan-list">
                        {staff.staff.map(member => <Check key={member.userId} name={member.fullName} detail={member.title ?? undefined} avatar={member.avatarUrl} checked={chosenStaff.includes(member.userId)} disabled={!canEdit}
                            onChange={on => change({ staff: toggle(chosenStaff, member.userId, on) })} />)}
                    </List>
                )}
            </Section>
            <Section title="Vehicles and seats" hint={vehicles.length ? `${seats} seats for ${people} people` : undefined}>
                {vehicles.length > 0 && (
                    <List label="Vehicles" className="gk-plan-list">
                        {vehicles.map(vehicle => (
                            <li key={vehicle.key}><div className="gk-list-row">
                                <span className="gk-list-row__main"><span className="gk-list-row__title">{vehicle.label}</span><span className="gk-list-row__meta">{[vehicle.driver && `Driven by ${vehicle.driver}`, `${vehicle.seats} passenger ${vehicle.seats === 1 ? 'seat' : 'seats'}`].filter(Boolean).join(' · ')}</span></span>
                                {canEdit && <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${vehicle.label}`} onClick={() => change({ vehicles: vehicles.filter(item => item.key !== vehicle.key) })}><Trash2 aria-hidden="true" /></Button>}
                            </div></li>
                        ))}
                    </List>
                )}
                {canEdit && <VehicleForm onAdd={vehicle => change({ vehicles: [...vehicles, vehicle] })} />}
            </Section>
            <Field label="Supervision contact" htmlFor={contactId} hint="Shared with families: who to call on the day.">
                <input id={contactId} className="gk-input" maxLength={400} disabled={!canEdit} value={draft.supervisionContact} placeholder="Lead coach and phone number" onChange={event => change({ supervisionContact: event.target.value })} />
            </Field>
            {plan && plan.published_version > 0 && <TravelDay plan={plan} busy={busy} command={command} />}
        </div>
    );
}
