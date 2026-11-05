import type { ProjectSummary } from './api';
import { markOf } from './projectWords';

/** A project's square: the squad's short name on a soft green, or the goal's initials on grey. */
export function ProjectMark({ project, size = 32 }: { project: ProjectSummary; size?: number }) {
    return <span className="pj-mark" data-squad={project.squad ? '' : undefined} style={{ width: size, height: size, fontSize: Math.round(size * (project.squad ? 0.32 : 0.38)) }} aria-hidden="true">{markOf(project)}</span>;
}
