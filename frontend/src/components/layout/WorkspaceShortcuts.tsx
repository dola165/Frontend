import { LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ManagedClubLink { clubId: number; clubName: string }

/** Explicit club choice when a person manages more than one club. */
export function WorkspaceShortcuts({ clubs }: { clubs: ManagedClubLink[] }) {
    if (!clubs.length) return null;
    const link = (club: ManagedClubLink) => <Link key={club.clubId} to={`/clubs/${club.clubId}/workspace`}
        className="feed-side-link home-social-link workspace-shortcut" aria-label={`Workspace — ${club.clubName}`}>
        <span className="home-shortcut-icon text-[var(--social-primary)]"><LayoutDashboard className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{clubs.length === 1 ? 'Workspace' : club.clubName}</span>
            <span className="block truncate text-xs text-[var(--text-secondary)]">{clubs.length === 1 ? club.clubName : 'Open workspace'}</span></span>
    </Link>;
    return clubs.length === 1 ? link(clubs[0]) : <details className="workspace-shortcut-group">
        <summary className="cursor-pointer rounded-xl px-3 py-3 text-sm font-semibold">Workspaces <span className="text-[var(--text-secondary)]">({clubs.length})</span></summary>
        <div className="space-y-1">{clubs.map(link)}</div>
    </details>;
}
