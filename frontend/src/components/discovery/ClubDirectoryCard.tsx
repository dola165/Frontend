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
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border border-[#ffffff0d] bg-[#16181d] p-4">
        <ClubDirectoryIdentity club={club} variant="card" />
        <p className="line-clamp-2 min-h-[3rem] text-sm leading-6 text-[#a1a1aa]">{club.description || 'No club summary provided yet.'}</p>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-[#a1a1aa]">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#16a34a]" />{getClubLocation(club)}</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-[#16a34a]" />{club.memberCount} members</span>
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
