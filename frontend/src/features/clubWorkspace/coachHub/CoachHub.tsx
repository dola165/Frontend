import { CalendarDays, ClipboardCheck } from 'lucide-react';
import { Button, PageFrame, PageHeader } from '../../../design/primitives';
import { Tabs, useUrlTab } from '../../../design/Tabs';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace, ResponsibilityFocus } from '../../clubOperations/workspaceStructure';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { isToday, squadAgenda } from '../fixtures';
import { CoachWeek } from './CoachWeek';
import { CoachSquads } from './CoachSquads';
import { CoachPlayers } from './CoachPlayers';
import { MyTasks, PlayersAttention } from './PlayersAttention';
import { OtherWork } from './OtherWork';
import { ResponsibilitiesPanel } from './ResponsibilitiesPanel';
import { canReadSquad, mySquadIds } from './coachData';
import { useNow } from '../useNow';
import '../club-workspace.css';

const views = ['work', 'players', 'responsibilities'] as const;

/** The personal view of the workspace: my squads, my sessions, my players and my responsibilities. */
export function CoachHub({ clubId, roles, boot, focus, events, onOpenCalendar, onOpenEvent, onOpen, onChanged }: {
    clubId: number; roles: RolesWorkspace; boot: Bootstrap | null; focus: ResponsibilityFocus; events: ScheduleEventOccurrence[];
    onOpenCalendar: () => void; onOpenEvent: (event: ScheduleEventOccurrence) => void; onOpen: OpenWorkspace; onChanged: () => void;
}) {
    const [view, setView] = useUrlTab('hub', views, 'work');
    const squads = mySquadIds(roles);
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const now = useNow();
    const agenda = squadAgenda(roles.sessions, events, mine, now - 3 * 3_600_000, now + 7 * 86_400_000);
    const register = agenda.find(entry => entry.session && isToday(entry.startsAt) && canReadSquad(boot, 'ATTENDANCE', entry.squadId));
    const responsibilities = focus.available.filter(v => v.id !== 'club').map(v => v.label);
    const subtitle = [responsibilities.join(', ') || (roles.leadership ? 'Club administration' : null), mine.map(s => s.name).join(', ')].filter(Boolean).join(' · ') || 'Take on a responsibility to fill your hub.';
    const waiting = roles.invitations.length + roles.requests.filter(r => r.status === 'PENDING' && r.user_id === roles.actorId).length;
    const players = new Set(roles.people.filter(p => squads.includes(p.squad_id)).map(p => p.id)).size;

    return <PageFrame className="cw-page">
        <PageHeader title="Coach Hub" subtitle={subtitle} actions={register
            ? <><Button onClick={onOpenCalendar}><CalendarDays aria-hidden="true" />Calendar</Button><Button variant="primary" onClick={() => onOpen('attendance', { squad: String(register.squadId), session: String(register.session!.id) })}><ClipboardCheck aria-hidden="true" />Take attendance</Button></>
            : <Button variant="primary" onClick={onOpenCalendar}><CalendarDays aria-hidden="true" />Open calendar</Button>} />
        <Tabs label="Coach Hub" value={view} onChange={setView} items={[
            { id: 'work', label: 'My week' },
            { id: 'players', label: 'My players', count: players || undefined },
            { id: 'responsibilities', label: 'Responsibilities', count: waiting || undefined },
        ]} />
        <div className="cw-tab-body">
            {view === 'responsibilities' ? <ResponsibilitiesPanel clubId={clubId} roles={roles} focus={focus} onChanged={onChanged} />
                : view === 'players' ? <CoachPlayers roles={roles} boot={boot} squads={squads} onOpen={onOpen} />
                    : <div className="gk-grid gk-grid--split">
                        <div className="gk-stack">
                            {mine.length > 0 && <CoachWeek agenda={agenda} boot={boot} onOpen={onOpen} onOpenEvent={onOpenEvent} />}
                            <CoachSquads roles={roles} boot={boot} squads={squads} onOpen={onOpen} onTakeOn={() => setView('responsibilities')} />
                        </div>
                        <div className="gk-stack">
                            <PlayersAttention clubId={clubId} roles={roles} boot={boot} squads={squads} onOpen={onOpen} />
                            <MyTasks clubId={clubId} roles={roles} onOpen={onOpen} />
                            <OtherWork />
                        </div>
                    </div>}
        </div>
    </PageFrame>;
}
