import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface MatchChallengePayload {
    targetClubId: number;
    challengingSquadId?: number;
    targetSquadId?: number;
    matchType: 'FRIENDLY' | 'COMPETITIVE';
    proposedDate: string;
    location?: string;
    venuePreference?: 'HOME' | 'AWAY' | 'NEUTRAL' | 'FLEXIBLE';
    message?: string;
}

interface MatchInviteModalProps {
    sourceClubId: number;
    targetClubId: number;
    targetClubName: string;
    onClose: () => void;
    onSubmit: (inviteData: MatchChallengePayload) => Promise<void>;
}

/**
 * Challenging a club from its profile now opens the one "Arrange a match" form with that club
 * filled in, instead of a separate wizard in a dialog. Kept as a hand-off so existing callers work.
 */
export const MatchInviteModal = ({ targetClubId, onClose }: MatchInviteModalProps) => {
    const navigate = useNavigate();
    useEffect(() => {
        onClose();
        navigate(`/world/matches/arrange?opponent=${targetClubId}`);
    }, [navigate, onClose, targetClubId]);
    return null;
};
