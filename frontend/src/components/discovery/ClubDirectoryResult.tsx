import type { MouseEvent } from 'react';
import { MapPin, Users } from 'lucide-react';
import type { AuthStatus } from '../../context/AuthContext';
import { getClubLocation } from './clubDirectoryMappings';
import { ClubDirectoryActions } from './ClubDirectoryActions';
import { ClubDirectoryIdentity } from './ClubDirectoryIdentity';
import type { ClubProfile } from './clubDirectoryTypes';

interface ClubDirectoryResultProps {
    club: ClubProfile;
    authStatus: AuthStatus;
    joiningClubId: number | null;
    applyingClubId: number | null;
    onJoin: (clubId: number) => void;
    onApply: (clubId: number) => void;
    onFollowToggle: (event: MouseEvent, clubId: number) => void;
}

export const ClubDirectoryResult = ({
    club,
    authStatus,
    joiningClubId,
    applyingClubId,
    onJoin,
    onApply,
    onFollowToggle
}: ClubDirectoryResultProps) => {
    return (
        <article className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:items-center">
            <ClubDirectoryIdentity club={club} />

            <p className="text-sm leading-6 text-[#a1a1aa]">{club.description || 'No club summary provided yet.'}</p>

            <div className="text-sm text-[#a1a1aa]">
                <div className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#16a34a]" />
                    <span>{getClubLocation(club)}</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-[#a1a1aa]">
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
};
