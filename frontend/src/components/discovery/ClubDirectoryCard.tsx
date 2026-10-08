import type { MouseEvent } from 'react';
import { MapPin, Users } from 'lucide-react';
import type { AuthStatus } from '../../context/AuthContext';
import { getClubLocation } from './clubDirectoryMappings';
import { ClubDirectoryActions } from './ClubDirectoryActions';
import { ClubDirectoryIdentity } from './ClubDirectoryIdentity';
import type { ClubProfile } from './clubDirectoryTypes';

export interface ClubDirectoryCardProps {
    club: ClubProfile;
    authStatus: AuthStatus;
    joiningClubId: number | null;
    applyingClubId: number | null;
    onJoin: (clubId: number) => void;
    onApply: (clubId: number) => void;
    onFollowToggle: (event: MouseEvent, clubId: number) => void;
}

export const ClubDirectoryCard = ({
    club,
    authStatus,
    joiningClubId,
    applyingClubId,
    onJoin,
    onApply,
    onFollowToggle
}: ClubDirectoryCardProps) => (
    <article className="club-directory-card flex min-w-0 flex-col gap-4 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] p-4">
        <ClubDirectoryIdentity club={club} variant="card" />
        <p className="line-clamp-2 min-h-[3rem] text-sm leading-6 text-[var(--color-secondary)]">{club.description || 'No club summary provided yet.'}</p>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-[var(--color-secondary)]">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--color-accent)]" />{getClubLocation(club)}</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-[var(--color-accent)]" />{club.memberCount} members</span>
            <span>{club.followerCount} followers</span>
        </div>
        <ClubDirectoryActions
            club={club}
            authStatus={authStatus}
            joiningClubId={joiningClubId}
            applyingClubId={applyingClubId}
            onJoin={onJoin}
            onApply={onApply}
            onFollowToggle={onFollowToggle}
        />
    </article>
);
