import { useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyNote, FixtureRow, List, ListRow, Panel, Section } from '../../design/primitives';
import { Tabs } from '../../design/Tabs';
import { SquadTrainingSchedule } from '../clubs/SquadTrainingSchedule';
import { SessionRegister } from './SessionRegister';
import type { RolesWorkspace } from './useWorkspaceRoles';
import type { Bootstrap } from './api';
import { operationTabs } from './workspaceNavigation';
import type { OpenWorkspace } from './workspaceStructure';
import { canReadSquad } from './squadAccess';
import { LegacyIsland } from './records/LegacyIsland';
import { dayLabel, timeLabel } from '../clubWorkspace/fixtures';
import './records/records.css';

type View = 'players' | 'training' | 'eligibility';
const HIDDEN = ['HOME', 'SETTINGS', 'MEDICAL', 'WELFARE', 'STAFF', 'CREDENTIALS', 'SPECIALISTS', 'FINANCE', 'FACILITIES'];

/** One squad's work: its players, its training sessions with the register, and (for leadership) its age rules. */
export function SquadWorkbench({ data, boot, squad, onOpen, eligibility, children }: { data: RolesWorkspace; boot: Bootstrap | null; squad: number; onOpen: OpenWorkspace; eligibility?: ReactNode; children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('view');
  const view: View = requested === 'training' ? 'training' : requested === 'eligibility' && eligibility ? 'eligibility' : 'players';
  const sessions = data.sessions.filter(s => s.squad_id === squad).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const selectedSession = sessions.find(s => s.id === Number(params.get('session')));
  const permitted = operationTabs.filter(t => !HIDDEN.includes(t.module) && canReadSquad(boot, t.module, squad) && boot?.settings.enabled_modules.includes(t.module));
  const quick = permitted.filter(t => ['DEVELOPMENT', 'AVAILABILITY'].includes(t.module));
  const more = permitted.filter(t => !['DEVELOPMENT', 'AVAILABILITY'].includes(t.module));
  const menu = useRef<HTMLDetailsElement>(null);
  const choose = (next: View, session?: number) => {
    const search = new URLSearchParams(params);
    search.set('view', next);
    if (session) search.set('session', String(session)); else search.delete('session');
    setParams(search);
  };
  const next = sessions[0];

  return <div className="gk-stack">
    <div className="sq-bar">
      <Tabs label="Squad" value={view} onChange={choose} items={[
        { id: 'players', label: 'Players' }, { id: 'training', label: 'Training', count: sessions.length || undefined },
        ...(eligibility ? [{ id: 'eligibility' as const, label: 'Age eligibility' }] : []),
      ]} />
      <div className="sq-tools">
        {quick.map(t => <Button key={t.id} size="sm" variant="ghost" onClick={() => onOpen(t.id, { squad: String(squad) })}><t.icon aria-hidden="true" />{t.id === 'development' ? 'Development' : 'Restrictions'}</Button>)}
        {more.length > 0 && <details className="sq-more" ref={menu}>
          <summary className="gk-btn gk-btn--ghost gk-btn--sm">More tools<ChevronDown aria-hidden="true" /></summary>
          <nav className="sq-more__menu" aria-label="Squad tools"><Panel flush><List label="Squad tools">{more.map(t => <ListRow key={t.id} lead={<t.icon aria-hidden="true" />} title={t.label}
            onClick={() => { menu.current?.removeAttribute('open'); onOpen(t.id, { squad: String(squad) }); }} />)}</List></Panel></nav>
        </details>}
      </div>
    </div>
    {view === 'players' ? <>
      {next && <Panel flush><List label="Next training"><FixtureRow tone="training" time={timeLabel(next.starts_at)} day={dayLabel(next.starts_at)} title={next.title} meta="Next training"
        onClick={() => choose('training', next.id)} label={`Prepare ${next.title}`} trail={<Badge tone="info">Prepare session</Badge>} /></List></Panel>}
      {children}
    </> : view === 'eligibility' ? eligibility : <div className="gk-grid gk-grid--split">
      <div className="gk-stack">
        <Section title="Sessions" hint="Next 14 days" action={<Link className="gk-section__action" to={`/squads/${squad}`}>Plans and replies <ExternalLink aria-hidden="true" className="sq-inline-icon" /></Link>}>
          <Panel flush>{sessions.length ? <List label="Training sessions">{sessions.map(s => <FixtureRow key={s.id} tone="training" time={timeLabel(s.starts_at)} day={dayLabel(s.starts_at)} title={s.title}
            meta={s.id === selectedSession?.id ? 'Open below' : undefined} onClick={() => choose('training', s.id)} label={`Open ${s.title}`} trail={s.id === selectedSession?.id ? <Badge tone="accent">Open</Badge> : undefined} />)}</List>
            : <EmptyNote title="No sessions in the next 14 days" action={<ButtonLink size="sm" to={`/squads/${squad}`}>Plan training</ButtonLink>}>Arrange training from the squad’s plans.</EmptyNote>}</Panel>
        </Section>
        {selectedSession && <Section title={selectedSession.title} hint={new Date(selectedSession.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          action={canReadSquad(boot, 'AVAILABILITY', squad) ? <Button size="sm" onClick={() => onOpen('restrictions', { squad: String(squad), state: 'open' })}><ShieldCheck aria-hidden="true" />Check restrictions</Button> : undefined}>
          {boot && canReadSquad(boot, 'ATTENDANCE', squad)
            ? <SessionRegister key={selectedSession.id} boot={{ ...boot, peopleBySquad: data.people }} session={selectedSession.id} squad={squad} onRecord={r => onOpen('attendance', { squad: String(squad), session: String(selectedSession.id), record: String(r.id) })} />
            : <Panel><EmptyNote title="The register is for staff with attendance access">Player replies in Plans and replies show who expects to attend.</EmptyNote></Panel>}
        </Section>}
      </div>
      <Section title="Weekly schedule" hint={<><CalendarDays aria-hidden="true" className="sq-inline-icon" /> Regular training times</>}>
        <Panel padded>{boot ? <LegacyIsland><SquadTrainingSchedule clubId={boot.clubId} squadId={squad} management /></LegacyIsland> : <EmptyNote title="The schedule is unavailable right now" />}</Panel>
      </Section>
    </div>}
  </div>;
}
