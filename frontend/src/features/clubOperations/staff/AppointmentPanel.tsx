import { Flag, ShieldCheck } from 'lucide-react';
import { Badge, Button, List, ListRow, Panel } from '../../../design/primitives';
import { appointmentScope, label, moduleNames, type Appointment, type Bootstrap } from '../api';
import { appointmentBadge, appointmentDates } from './appointmentLabels';

/**
 * One staff appointment: the role, where it applies, its terms and the workspace access it gives.
 * Leadership can change it or end it; ending asks first (see the page's confirmation).
 */
export function AppointmentPanel({ appointment: a, boot, onChange, onEnd }: { appointment: Appointment; boot: Bootstrap; onChange?: () => void; onEnd?: () => void }) {
    const badge = appointmentBadge(a);
    const referee = a.specialisations.includes('REFEREE');
    const editable = boot.leadership && ['ACTIVE', 'INVITED'].includes(a.status);
    return <Panel as="article" flush className="st-appointment" title={<span className="st-appointment__title">{referee ? <Flag aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{a.title}</span>}
        action={<Badge tone={badge.tone}>{badge.text}</Badge>}
        footer={editable && (onChange || onEnd) ? <div className="gk-row st-appointment__actions">
            {onChange && <Button size="sm" onClick={onChange}>Change appointment</Button>}
            {onEnd && <Button size="sm" variant="ghost" className="st-danger" onClick={onEnd}>{a.status === 'INVITED' ? 'Cancel invitation' : 'End appointment'}</Button>}
        </div> : undefined}>
        <dl className="rec-facts">
            {a.specialisations.length > 0 && <div><dt>Responsibilities</dt><dd>{a.specialisations.map(label).join(', ')}</dd></div>}
            <div><dt>Teams</dt><dd>{appointmentScope(a, boot.squads)}</dd></div>
            <div><dt>Engagement</dt><dd>{label(a.engagement)}</dd></div>
            <div><dt>Dates</dt><dd>{appointmentDates(a)}</dd></div>
            <div><dt>Public profile</dt><dd>{a.published ? 'Shown by the staff member' : 'Not shown'}</dd></div>
        </dl>
        {a.unavailable_reason && <p className="gk-notice gk-notice--warning st-note">{a.unavailable_reason}</p>}
        {referee && <p className="gk-notice st-note">Choose this referee when arranging a friendly. They receive the match invitation in their referee workspace and confirm each fixture.</p>}
        <details className="rec-disclosure">
            <summary>Workspace access <span className="gk-faint gk-num">{a.permissions.length}</span></summary>
            {a.permissions.length ? <List label={`Workspace access for ${a.title}`}>{a.permissions.map(permission => <ListRow key={permission}
                title={moduleNames[permission.split(':')[0]] ?? label(permission.split(':')[0])} trail={permission.endsWith(':WRITE') ? 'View and manage' : 'View only'} />)}</List>
                : <p className="rec-disclosure__body gk-muted">No club workspace access on this appointment.</p>}
        </details>
    </Panel>;
}
