import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, LayoutGrid, Shield } from 'lucide-react';
import { Button, ButtonLink, PageFrame, PageHeader } from '../../../design/primitives';
import * as squadSpaces from '../../squadCommunication/api';
import { Tabs } from '../../../design/Tabs';
import { useUrlTab } from '../../../design/useUrlTab';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace, ResponsibilityFocus } from '../../clubOperations/workspaceStructure';
import { guardWorkspaceNavigation } from '../../clubOperations/workspaceGuard';
import { canReadSquad } from '../../clubOperations/squadAccess';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { isToday, squadAgenda } from '../fixtures';
import { CoachWeek } from './CoachWeek';
import { CoachSquads } from './CoachSquads';
import { CoachPlayers } from './CoachPlayers';
import { MyTasks, PlayersAttention } from './PlayersAttention';
import { OtherWork } from './OtherWork';
import { ResponsibilitiesPanel } from './ResponsibilitiesPanel';
import { mySquadIds } from './coachData';
import { useNow } from '../useNow';
import '../club-workspace.css';

const views = ['work', 'players', 'responsibilities'] as const;
export type HubView = typeof views[number];

/**
 * The personal view of the workspace: my squads, my sessions, my players and my responsibilities.
 * It follows the responsibilities switched on in Responsibilities; a squad whose responsibility is off
 * leaves the hub (never the person's access) until it is switched back on.
 */
export function CoachHub({ page, clubId, roles, boot, focus, events, legacyHub, onOpenCalendar, onOpenEvent, onOpen, onChanged }: {
    /** Shown as its own page (My squads) rather than inside the workspace. */
    page?: { clubName: string; workspace: boolean };
    clubId: number; roles: RolesWorkspace; boot: Bootstrap | null; focus: ResponsibilityFocus; events: ScheduleEventOccurrence[];
    /** The hub tab an old personal link (my-role, my-people) stands for, until the address is rewritten. */
    legacyHub?: string;
    onOpenCalendar: () => void; onOpenEvent: (event: ScheduleEventOccurrence) => void; onOpen: OpenWorkspace; onChanged: () => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const fallback = (views as readonly string[]).includes(legacyHub ?? '') ? legacyHub as HubView : 'work';
    // Switching tabs unmounts a half-written request, so open editors are asked first.
    const [view, setView] = useUrlTab('hub', views, fallback, guardWorkspaceNavigation);
    const squads = mySquadIds(focus.selectedViews);
    const hiddenSquads = mySquadIds(focus.available).filter(id => !squads.includes(id));
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const now = useNow();
    const agenda = squadAgenda(roles.sessions, events, mine, now - 3 * 3_600_000, now + 7 * 86_400_000);
    const register = agenda.find(entry => entry.session && isToday(entry.startsAt) && canReadSquad(boot, 'ATTENDANCE', entry.squadId));
    const responsibilities = focus.selectedViews.filter(v => v.id !== 'club').map(v => v.label);
    const subtitle = [responsibilities.join(', ') || (roles.leadership ? copy('clubAdministration') : null), mine.map(s => s.name).join(', ')].filter(Boolean).join(' · ') || copy('emptySubtitle');
    const waiting = roles.invitations.length + roles.requests.filter(r => r.status === 'PENDING' && r.user_id === roles.actorId).length;
    const players = new Set(roles.people.filter(p => squads.includes(p.squad_id)).map(p => p.id)).size;
    const takeOn = () => setView('responsibilities');
    // Unread family messages per squad, from the squad spaces coaches and families share.
    const [families, setFamilies] = useState<Map<number, number>>(new Map());
    useEffect(() => {
        const abort = new AbortController();
        squadSpaces.spaces(abort.signal).then(list => setFamilies(new Map(list.map(space => [space.id, space.unread_count])))).catch(() => undefined);
        return () => abort.abort();
    }, []);
    const roleOf = (squadId: number) => focus.available.filter(v => !v.clubWide && v.squadIds.includes(squadId)).map(v => v.label).join(", ") || (roles.leadership ? copy('clubAdministration') : "");
    const header = page
        ? { title: copy('mySquads'), subtitle: <><Link className="cw-hub-club" to={`/clubs/${clubId}`}>{page.clubName}</Link>{responsibilities.length > 0 && <> · {responsibilities.join(", ")}</>}</>,
            links: <><ButtonLink variant="ghost" to={`/clubs/${clubId}`}><Shield aria-hidden="true" />{copy('clubPage')}</ButtonLink>{page.workspace && <ButtonLink variant="ghost" to={`/clubs/${clubId}/workspace`}><LayoutGrid aria-hidden="true" />{copy('clubWorkspace')}</ButtonLink>}</> }
        : { title: copy('title'), subtitle, links: null };

    return <PageFrame className="cw-page">
        <PageHeader title={header.title} subtitle={header.subtitle} actions={register
            ? <>{header.links}<Button onClick={onOpenCalendar}><CalendarDays aria-hidden="true" />{copy('calendar')}</Button><Button variant="primary" onClick={() => onOpen('attendance', { squad: String(register.squadId), session: String(register.session!.id) })}><ClipboardCheck aria-hidden="true" />{copy('takeAttendance')}</Button></>
            : <>{header.links}<Button variant="primary" onClick={onOpenCalendar}><CalendarDays aria-hidden="true" />{copy('openCalendar')}</Button></>} />
        <Tabs label={copy('title')} value={view} onChange={setView} items={[
            { id: 'work', label: copy('tabWeek') },
            { id: 'players', label: copy('tabPlayers'), count: players || undefined },
            { id: 'responsibilities', label: copy('tabResponsibilities'), count: waiting || undefined },
        ]} />
        <div className="cw-tab-body">
            {view === 'responsibilities' ? <ResponsibilitiesPanel clubId={clubId} roles={roles} focus={focus} onChanged={onChanged} />
                : view === 'players' ? <CoachPlayers roles={roles} boot={boot} squads={squads} hidden={hiddenSquads.length > 0} onShowAll={focus.showAll} onOpen={onOpen} />
                    : <div className="gk-grid gk-grid--split">
                        <div className="gk-stack">
                            <CoachSquads title={page ? copy('yourSquads') : undefined} roleOf={roleOf} families={families} roles={roles} boot={boot} squads={squads} hidden={hiddenSquads.length > 0} onShowAll={focus.showAll} onOpen={onOpen} onTakeOn={takeOn} />
                            {mine.length > 0 && <CoachWeek agenda={agenda} boot={boot} onOpen={onOpen} onOpenEvent={onOpenEvent} />}
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
