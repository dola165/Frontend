import { useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DeskTool } from './registry';
import { workspaceSectionPath } from './paths';
import type { JobWorkspace } from './types';
import { WorkspaceLink } from './WorkspaceLink';

/** Every tool of a workspace with more than fits its rail: one row each, its name and what it is for. */
export function WorkspaceToolList({ club, workspace, tools }: { club: number; workspace: JobWorkspace; tools: DeskTool[] }) {
    const [params] = useSearchParams();
    return <ul className="job-workspaces__destinations">{tools.map(tool => <li key={tool.id}>
        <WorkspaceLink to={workspaceSectionPath(club, workspace, tool.id, params)}><tool.icon aria-hidden="true" /><span><strong>{tool.label}</strong><span>{tool.description}</span></span><ArrowRight aria-hidden="true" /></WorkspaceLink>
    </li>)}</ul>;
}
