import { EmptyNote, Section } from '../../../design/primitives';
import { Cone } from 'lucide-react';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { useCopy } from '../../../locales/useCopy';
import { dayInline, timeLabel } from '../fixtures';
import { useNow } from '../useNow';
import '../club-workspace.css';

type SquadTile = { id: number; name: string; player_count: number; section?: string | null };

/**
 * Every squad as a small tile: name, size and next training. A tile opens the squad. A bigger club's squads come
 * in sections (first team, academy, girls…), so the tiles sit under their section's name when the squads carry one.
 */
export function SquadGrid({ squads, sessions, onOpen, title, hint, className }: { squads: SquadTile[]; sessions: RolesWorkspace['sessions']; onOpen: OpenWorkspace; title: string; hint?: string; className?: string }) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const now = useNow();
    const sections = [...new Set(squads.map(squad => squad.section ?? ''))];
    const tiles = (list: SquadTile[]) => <ul className="cw-squad-grid" aria-label={title}>{list.map(squad => {
        const next = sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
        return <li key={squad.id}><button type="button" className="cw-squad-tile" onClick={() => onOpen('squads', { squad: String(squad.id) })}>
            <span className="cw-squad-tile__name">{squad.name}</span>
            <span className="cw-squad-tile__meta"><span className="gk-num">{squad.player_count}</span> {copy('playersWord', { count: squad.player_count })}</span>
            <span className="cw-squad-tile__next"><Cone aria-hidden="true" />{next ? copy('nextTraining', { day: dayInline(next.starts_at, now), time: timeLabel(next.starts_at) }) : copy('noTraining')}</span>
        </button></li>;
    })}</ul>;
    return <Section className={className} boxed title={title} hint={hint ?? (squads.length ? `${squads.length}` : undefined)} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('squads')}>{copy('allSquads')}</button>}>
        {!squads.length ? <EmptyNote title={copy('noSquads')}>{copy('noSquadsHint')}</EmptyNote>
            : sections.length > 1 ? <div className="cw-sections">{sections.map(section => <section key={section || 'other'} className="cw-section" aria-label={section || title}>
                <h3 className="cw-section__name">{section || copy('otherSquads')}<span>{squads.filter(squad => (squad.section ?? '') === section).length}</span></h3>
                {tiles(squads.filter(squad => (squad.section ?? '') === section))}
            </section>)}</div>
                : tiles(squads)}
    </Section>;
}
