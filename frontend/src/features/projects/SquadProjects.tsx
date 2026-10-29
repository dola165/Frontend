import { ChevronRight, FolderKanban, HandCoins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ProjectBoard } from './api';
import { projectPath, projectsPath, summaryLine } from './projectWords';

/**
 * A squad's projects in My squads, one quiet line on its card: the one project, with its money or next step, or how
 * many there are. Only the open projects the person sees; nothing when there are none.
 */
export function SquadProjectsLine({ board, squadId }: { board: ProjectBoard | null; squadId: number }) {
    const copy = useJourneyCopy();
    const open = (Array.isArray(board?.projects) ? board.projects : []).filter(project => project.squad?.id === squadId && (project.status === 'NOW' || project.status === 'LATER'));
    if (!open.length || !board) return null;
    const one = open.length === 1 ? open[0] : null;
    return <Link className="ch-card__line" to={one ? projectPath(one.id) : projectsPath(board.club.id)}>
        <span className="ch-card__line-icon"><FolderKanban aria-hidden="true" /></span>
        <span className="ch-card__line-text">{one ? <><strong>{one.goal}</strong> · {summaryLine(copy, one)}</>
            : copy(`${open.length} projects: ${open.map(project => project.goal).join(', ')}`, `${open.length} პროექტი: ${open.map(project => project.goal).join(', ')}`)}</span>
        <ChevronRight className="cw-chevron" aria-hidden="true" />
    </Link>;
}

/** "Raise money for this squad": New project with Raise money and the squad chosen, for whoever may start one. */
export function RaiseMoneyForSquad({ board, squadId }: { board: ProjectBoard | null; squadId: number }) {
    const copy = useJourneyCopy();
    if (!board?.canStart) return null;
    return <ButtonLink size="sm" to={projectsPath(board.club.id, 'projects', { new: 'RAISE_MONEY', squad: String(squadId) })}>
        <HandCoins aria-hidden="true" />{copy('Raise money', 'თანხის შეგროვება')}
    </ButtonLink>;
}
