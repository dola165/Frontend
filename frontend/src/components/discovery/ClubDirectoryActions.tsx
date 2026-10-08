import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock, Loader2, Plus, Send, UserPlus } from 'lucide-react';
import type { AuthStatus } from '../../context/AuthContext';
import { RELATIONSHIP_PRESENTATION } from './clubDirectoryMappings';
import type { ClubProfile } from './clubDirectoryTypes';

interface ClubDirectoryActionsProps {
    club: ClubProfile;
    authStatus: AuthStatus;
    joiningClubId: number | null;
    applyingClubId: number | null;
    onJoin: (clubId: number) => void;
    onApply: (clubId: number) => void;
    onFollowToggle: (event: MouseEvent, clubId: number) => void;
}

export const ClubDirectoryActions = ({
    club,
    authStatus,
    joiningClubId,
    applyingClubId,
    onJoin,
    onApply,
    onFollowToggle
}: ClubDirectoryActionsProps) => {
    const relationship = club.relationshipState ? RELATIONSHIP_PRESENTATION[club.relationshipState] : undefined;

    return (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {authStatus === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'OPEN_TRIAL' && (
                <button type="button" onClick={() => onJoin(club.id)} disabled={joiningClubId === club.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] disabled:opacity-60 sm:min-h-0">
                    {joiningClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}Join
                </button>
            )}
            {authStatus === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'APPLICATION_REQUIRED' && (
                <button type="button" onClick={() => onApply(club.id)} disabled={applyingClubId === club.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] disabled:opacity-60 sm:min-h-0">
                    {applyingClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}Apply
                </button>
            )}
            {authStatus === 'authenticated' && relationship && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${relationship.className}`}>
                    {relationship.icon === 'check' && <Check className="h-3 w-3" />}
                    {relationship.icon === 'clock' && <Clock className="h-3 w-3" />}
                    {relationship.label}
                </span>
            )}

            <button type="button" onClick={(event) => onFollowToggle(event, club.id)}
                className={`inline-flex min-h-11 items-center gap-2 border px-3 py-2 text-[11px] font-medium rounded-xl sm:min-h-0 ${
                    club.isFollowedByMe
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] text-[var(--color-text)]'
                }`}>
                {club.isFollowedByMe ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{club.isFollowedByMe ? 'Following' : 'Follow'}
            </button>

            <Link to={`/clubs/${club.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-medium text-[var(--color-accent)] sm:min-h-0">
                Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
};
