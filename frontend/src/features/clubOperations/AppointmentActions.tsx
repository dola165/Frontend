import { useEffect, useState } from 'react';
import { Badge, Button, List, ListRow, Panel } from '../../design/primitives';
import { get, root, appointmentStatus, type Appointment } from './api';
import { formatDate } from '../../utils/formatting';

/** Staff appointments waiting for the person's answer or ending within 30 days. */
export function AppointmentActions({ club, onOpen }: { club: number; onOpen: () => void }) {
  const [items, setItems] = useState<Appointment[]>([]), [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    void get<Appointment[]>(`${root(club)}/appointments`, c.signal).then(r => { if (!c.signal.aborted) setItems(r); }).catch(() => { if (!c.signal.aborted) setError('Staff appointment actions could not be loaded.'); });
    return () => c.abort();
  }, [club]);
  const [upcoming] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const actions = items.filter(a => a.status === 'INVITED' || a.status === 'ACTIVE' && a.ends_on && a.ends_on <= upcoming);
  if (error) return <div className="gk-notice gk-notice--danger" role="alert">{error}</div>;
  if (!actions.length) return null;
  return <Panel flush title="Staff appointments needing attention" action={<Button size="sm" onClick={onOpen}>Manage appointments</Button>}>
    <List label="Staff appointments needing attention">{actions.map(a => <ListRow key={a.id} title={`${a.name} · ${a.title}`}
      meta={a.ends_on ? `Ends ${formatDate(a.ends_on.slice(0, 10))}` : 'Awaiting the person’s decision'} trail={<Badge tone={a.status === 'INVITED' ? 'warning' : 'neutral'}>{appointmentStatus(a)}</Badge>} />)}</List>
  </Panel>;
}
