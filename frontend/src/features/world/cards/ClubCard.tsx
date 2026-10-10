import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, Plus } from 'lucide-react';
import { Badge, Button, ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { createClubApplication, selfRegisterClubPlayer } from '../../clubs/api';
import { trainingSummary } from '../../clubs/presentation';
import type { ClubProfile, ClubRelationshipState } from '../../../components/discovery/clubDirectoryTypes';
import { toggleClubFollow } from '../api';
import { clubTypeLabel, distanceLabel, JOIN_POLICY, plural } from '../format';
import { useWorldSession } from '../worldSession';
import { Crest } from '../Crest';
import './cards.css';

const RELATIONSHIP: Partial<Record<ClubRelationshipState, { label: string; tone: 'accent' | 'warning' | 'info' | 'violet' }>> = {
    ACTIVE: { label: 'Member', tone: 'accent' },
    APPLIED: { label: 'Application pending', tone: 'warning' },
    INVITED: { label: 'Invited', tone: 'info' },
    TRIALIST: { label: 'Trialist', tone: 'violet' },
};

/** A compact club card: who they are, how to join, and Follow / Open. */
export function ClubCard({ club, compact = false, distanceKm }: { club: ClubProfile; compact?: boolean; distanceKm?: number }) {
    const { status } = useAuth();
    const { membership } = useWorldSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [following, setFollowing] = useState(club.isFollowedByMe);
    const [relationship, setRelationship] = useState<ClubRelationshipState>(club.relationshipState ?? 'NONE');
    const [busy, setBusy] = useState<'follow' | 'join' | null>(null);
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
    const signIn = () => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
    const relation = RELATIONSHIP[relationship];
    const policy = club.joinPolicy ? JOIN_POLICY[club.joinPolicy] : null;
    const fees = trainingSummary(club.presentation);
    // Joining from the directory is offered only to people verified to have no club yet.
    const canJoin = status === 'authenticated' && membership?.hasClubMembership === false && relationship === 'NONE'
        && (club.joinPolicy === 'OPEN_TRIAL' || club.joinPolicy === 'APPLICATION_REQUIRED');

    const follow = async () => {
        if (status !== 'authenticated') return signIn();
        setBusy('follow');
        setFollowing(value => !value);
        try { await toggleClubFollow(club.id); setMessage(null); }
        catch (error) { setFollowing(value => !value); setMessage({ text: extractApiErrorMessage(error, 'Following could not be updated.'), error: true }); }
        finally { setBusy(null); }
    };
    const join = async () => {
        setBusy('join');
        try {
            if (club.joinPolicy === 'OPEN_TRIAL') { await selfRegisterClubPlayer(club.id); setRelationship('TRIALIST'); setMessage({ text: 'You joined as a trialist.', error: false }); }
            else { await createClubApplication(club.id, 'PLAYER', null); setRelationship('APPLIED'); setMessage({ text: 'Application sent to the club.', error: false }); }
        } catch (error) { setMessage({ text: extractApiErrorMessage(error, 'The club could not be contacted.'), error: true }); }
        finally { setBusy(null); }
    };

    return (
        <article className={`gk-world-card gk-world-club${compact ? ' gk-world-card--compact' : ''}`}>
            <div className="gk-world-card__head">
                <Crest src={club.logoUrl} name={club.name} size={compact ? 40 : 48} />
                <div className="gk-world-card__title">
                    <h3><Link to={`/clubs/${club.id}`}>{club.name}</Link>{club.isOfficial && <BadgeCheck className="gk-world-verified" aria-label="Verified club" />}</h3>
                    <p>{[clubTypeLabel(club.type), club.cityName || club.addressText?.split(',')[0] || 'Location not published', distanceKm != null ? distanceLabel(distanceKm) : null].filter(Boolean).join(' · ')}</p>
                </div>
            </div>
            {!compact && club.description && <p className="gk-world-card__desc">{club.description}</p>}
            <div className="gk-world-card__facts">
                {relation ? <Badge tone={relation.tone}>{relation.label}</Badge> : policy && <Badge tone={policy.tone}>{policy.label}</Badge>}
                <span>{plural(club.memberCount, 'member')}</span>
                {!compact && fees && <span className="gk-world-card__fees">{fees}</span>}
            </div>
            {message && <p className={`gk-world-card__message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
            <div className="gk-world-card__actions">
                <Button size="sm" aria-pressed={following} disabled={busy === 'follow'} onClick={follow}>
                    {following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{following ? 'Following' : 'Follow'}
                </Button>
                {canJoin && (
                    <Button size="sm" variant="primary" disabled={busy === 'join'} onClick={join}>
                        {busy === 'join' ? 'Sending…' : club.joinPolicy === 'OPEN_TRIAL' ? 'Join as trialist' : 'Apply as player'}
                    </Button>
                )}
                <ButtonLink size="sm" variant="ghost" to={`/clubs/${club.id}`} aria-label={`Open ${club.name}`}>Open</ButtonLink>
            </div>
        </article>
    );
}
