import { EmptyNote, Section } from '../../../design/primitives';
import { Cone } from 'lucide-react';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { useCopy } from '../../../locales/useCopy';
import { dayInline, timeLabel } from '../fixtures';
import { useNow } from '../useNow';
import '../club-workspace.css';

/** Every squad as a small tile: name, size and next training. A tile opens the squad. */
export function SquadGrid({ squads, sessions, onOpen, title, className }: { squads: { id: number; name: string; player_count: number }[]; sessions: RolesWorkspace['sessions']; onOpen: OpenWorkspace; title: string; className?: string }) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const now = useNow();
    return <Section className={className} boxed title={title} hint={squads.length ? `${squads.length}` : undefined} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('squads')}>{copy('allSquads')}</button>}>
        {squads.length ? <ul className="cw-squad-grid" aria-label={title}>{squads.map(squad => {
            const next = sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            return <li key={squad.id}><button type="button" className="cw-squad-tile" onClick={() => onOpen('squads', { squad: String(squad.id) })}>
                <span className="cw-squad-tile__name">{squad.name}</span>
                <span className="cw-squad-tile__meta"><span className="gk-num">{squad.player_count}</span> {copy('playersWord', { count: squad.player_count })}</span>
                <span className="cw-squad-tile__next"><Cone aria-hidden="true" />{next ? copy('nextTraining', { day: dayInline(next.starts_at, now), time: timeLabel(next.starts_at) }) : copy('noTraining')}</span>
            </button></li>;
        })}</ul> : <EmptyNote title={copy('noSquads')}>{copy('noSquadsHint')}</EmptyNote>}
    </Section>;
}
