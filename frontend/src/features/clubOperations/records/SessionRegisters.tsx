import { Badge, ButtonLink, EmptyNote, FixtureRow, List, Panel, Section } from '../../../design/primitives';
import type { Bootstrap } from '../api';
import { dayLabel, timeLabel } from '../../clubWorkspace/fixtures';
import { useNow } from '../../clubWorkspace/useNow';

type Session = Bootstrap['sessions'][number];

/** The next training sessions this person may take a register for, each one tap from its register. */
export function SessionRegisters({ boot, squad, onOpen }: { boot: Bootstrap; squad: string; onOpen: (session: Session) => void }) {
    const now = useNow();
    const permission = boot.modules.find(m => m.id === 'ATTENDANCE');
    const sessions = boot.sessions.filter(s => s.squad_id && (permission?.globalRead || permission?.readSquads?.includes(s.squad_id)) && (!squad || String(s.squad_id) === squad)
        && new Date(s.starts_at).getTime() >= now - 3 * 3_600_000).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 5);
    return <Section id="rec-registers" title="Take a register" hint={boot.settings.timezone ? `Times in ${boot.settings.timezone.replaceAll('_', ' ')}` : undefined}
        action={<ButtonLink size="sm" variant="ghost" to={`/calendar?clubId=${boot.clubId}`}>Open calendar</ButtonLink>}>
        <Panel flush>{sessions.length ? <List label="Upcoming sessions">{sessions.map(s => <FixtureRow key={s.id} tone="training" time={timeLabel(s.starts_at)} day={dayLabel(s.starts_at)}
            title={s.title} meta={s.squad_name} onClick={() => onOpen(s)} label={`Open the register for ${s.title}, ${s.squad_name}`} trail={<Badge tone="info">Register</Badge>} />)}</List>
            : <EmptyNote title="No upcoming training sessions">Sessions you can take a register for appear here. Plan training from the calendar.</EmptyNote>}</Panel>
    </Section>;
}
