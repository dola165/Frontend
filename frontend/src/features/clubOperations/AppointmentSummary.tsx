import type { ReactNode } from 'react';
import { Building2, CalendarDays, Eye, EyeOff, Handshake, KeyRound, ShieldCheck, Users } from 'lucide-react';
import { RecordFacts } from '../../components/ui/RecordFacts';
import { appointmentScope, appointmentStatus, label, moduleNames, type Appointment, type Choice } from './api';
import './appointment-summary.css';

import {appointmentDate} from './appointmentDate';

/** Shared presentation only. The caller owns authority, decisions and confirmations. */
export function AppointmentSummary({ appointment: a, squads, showPerson = false, children }: {
    appointment: Appointment; squads?: Choice[]; showPerson?: boolean; children?: ReactNode;
}) {
    const state = appointmentStatus(a);
    const tone = state === 'Active' ? 'active' : state === 'Invited' || state === 'Upcoming' ? 'pending' : 'neutral';
    return <article className="appointment-summary" id={`staff-appointment-${a.id}`}>
        <header className="appointment-summary__header">
            <span className="appointment-summary__emblem" aria-hidden="true"><ShieldCheck size={25} strokeWidth={1.7} /></span>
            <div className="appointment-summary__identity"><p>{showPerson ? a.name : a.club_name}</p><h3>{a.title}</h3></div>
            <span className="appointment-summary__status" data-tone={tone}><span aria-hidden="true" />{state}</span>
        </header>
        <div className="appointment-summary__body">
            <div className="appointment-summary__terms">
                <RecordFacts items={[
                    { label: 'Teams', value: appointmentScope(a, squads), icon: Users },
                    { label: 'Appointment dates', value: <>{appointmentDate(a.starts_on)}<span className="appointment-summary__date-end">{a.ends_on ? `to ${appointmentDate(a.ends_on)}` : 'No end date set'}</span></>, icon: CalendarDays },
                    { label: 'Arrangement', value: label(a.engagement), icon: Handshake },
                ]} />
                {a.specialisations.length > 0 && <div className="appointment-summary__specialisms" aria-label="Responsibilities">{a.specialisations.map(s => <span key={s}>{label(s)}</span>)}</div>}
                {state === 'Upcoming' && <p className="appointment-summary__notice">Accepted. Your appointment starts on {appointmentDate(a.starts_on)} ({a.timezone || 'Asia/Tbilisi'}).</p>}
                {a.status === 'INVITED' && a.expires_at && <p className="appointment-summary__notice">Respond by {new Date(a.expires_at).toLocaleDateString()}.</p>}
            </div>
            <section className="appointment-summary__access" aria-label="Responsibilities and access">
                <h4><KeyRound size={16} aria-hidden="true" />Workspace access</h4>
                {a.permissions.length ? <ul>{a.permissions.map(p => <li key={p}><Building2 size={16} aria-hidden="true" /><div><strong>{moduleNames[p.split(':')[0]] || label(p.split(':')[0])}</strong><span>{p.endsWith(':WRITE') ? 'Read and manage' : 'Read only'}</span></div></li>)}</ul>
                    : <p>No club workspace access. Ask club leadership if you need tools for this responsibility.</p>}
            </section>
        </div>
        {a.unavailable_reason && <p className="appointment-summary__notice" role="alert">{a.unavailable_reason}</p>}
        <div className="appointment-summary__disclosure"><span>{a.published ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}{a.published ? 'Public appointment' : 'Private appointment'}</span><p>Recorded club responsibility. This does not verify qualifications or create an employment contract.</p></div>
        {children && <footer className="appointment-summary__actions">{children}</footer>}
    </article>;
}
