import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, Plus } from 'lucide-react';
import { Badge, Button, ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { createClubApplication, selfRegisterClubPlayer } from '../../clubs/api';
import type { ClubProfile, ClubRelationshipState } from '../../../components/discovery/clubDirectoryTypes';
import { toggleClubFollow } from '../api';
import { plural, useWorldCopy } from '../copy';
import { counterpartProps, useMapCounterpart } from '../directory/selection';
import { clubTypeLabel, distanceLabel, JOIN_POLICY } from '../format';
import { useWorldChild } from '../players';
import { useWorldSession } from '../worldSession';
import { Crest } from '../Crest';
import { ClubProgrammes } from './ClubProgrammes';
import { enquiryPath, fittingProgrammes } from './programmes';
import './cards.css';

const RELATIONSHIP: Partial<Record<ClubRelationshipState, { label: string; tone: 'accent' | 'warning' | 'info' | 'violet' }>> = {
    ACTIVE: { label: 'Member', tone: 'accent' },
    APPLIED: { label: 'Application pending', tone: 'warning' },
    INVITED: { label: 'Invited', tone: 'info' },
    TRIALIST: { label: 'Trialist', tone: 'violet' },
};

/**
 * A compact club card: who they are, how to join, their programmes, and Follow / Open.
 * A parent asks the club about a place for their child through the club's enquiry; joining in
 * one click is offered only to someone joining for themselves who is verified to have no club.
 */
export function ClubCard({ club, compact = false, distanceKm }: { club: ClubProfile; compact?: boolean; distanceKm?: number }) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { membership } = useWorldSession();
    const { isParent, child } = useWorldChild();
    const counterpart = useMapCounterpart();
    const navigate = useNavigate();
    const location = useLocation();
    const [following, setFollowing] = useState(club.isFollowedByMe);
    const [relationship, setRelationship] = useState<ClubRelationshipState>(club.relationshipState ?? 'NONE');
    const [busy, setBusy] = useState<'follow' | 'join' | null>(null);
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
    const signIn = () => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
    const relation = RELATIONSHIP[relationship];
    const policy = club.joinPolicy ? JOIN_POLICY[club.joinPolicy] : null;
    const enquiry = isParent && (child || relationship === 'NONE') ? enquiryPath(club.id, child?.id, fittingProgrammes(club.presentation, child)[0]?.id) : null;
    const canJoin = !isParent && status === 'authenticated' && membership?.hasClubMembership === false && relationship === 'NONE'
        && (club.joinPolicy === 'OPEN_TRIAL' || club.joinPolicy === 'APPLICATION_REQUIRED');

    const follow = async () => {
        if (status !== 'authenticated') return signIn();
        setBusy('follow');
        setFollowing(value => !value);
        try { await toggleClubFollow(club.id); setMessage(null); }
        catch (error) { setFollowing(value => !value); setMessage({ text: extractApiErrorMessage(error, t('Following could not be updated.')), error: true }); }
        finally { setBusy(null); }
    };
    const join = async () => {
        setBusy('join');
        try {
            if (club.joinPolicy === 'OPEN_TRIAL') { await selfRegisterClubPlayer(club.id); setRelationship('TRIALIST'); setMessage({ text: t('You joined as a trialist.'), error: false }); }
            else { await createClubApplication(club.id, 'PLAYER', null); setRelationship('APPLIED'); setMessage({ text: t('Application sent to the club.'), error: false }); }
        } catch (error) { setMessage({ text: extractApiErrorMessage(error, t('The club could not be contacted.')), error: true }); }
        finally { setBusy(null); }
    };

    return (
        <article className={`gk-world-card gk-world-club${compact ? ' gk-world-card--compact' : ''}`} {...counterpartProps(counterpart)}>
            <div className="gk-world-card__head">
                <Crest src={club.logoUrl} name={club.name} size={compact ? 40 : 48} />
                <div className="gk-world-card__title">
                    <h3><Link to={`/clubs/${club.id}`} title={club.name}>{club.name}</Link>{club.isOfficial && <BadgeCheck className="gk-world-verified" aria-label={t('Verified club')} />}</h3>
                    <p>{t(clubTypeLabel(club.type))} · {club.cityName || club.addressText?.split(',')[0] || t('Location not published')}</p>
                </div>
            </div>
            {!compact && club.description && <p className="gk-world-card__desc">{club.description}</p>}
            <div className="gk-world-card__facts">
                {relation ? <Badge tone={relation.tone}>{t(relation.label)}</Badge> : policy && <Badge tone={policy.tone}>{t(policy.label)}</Badge>}
                <span>{plural(club.memberCount, 'member')}</span>
                {distanceKm != null && <span>{distanceLabel(distanceKm)}</span>}
            </div>
            <ClubProgrammes presentation={club.presentation} child={child} compact={compact} />
            {message && <p className={`gk-world-card__message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
            <div className="gk-world-card__actions">
                <Button size="sm" aria-pressed={following} disabled={busy === 'follow'} onClick={follow}>
                    {following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{following ? t('Following') : t('Follow')}
                </Button>
                {enquiry && (
                    <ButtonLink size="sm" variant="primary" to={enquiry}
                        aria-label={child ? t('Ask {club} about a place for {name}', { club: club.name, name: child.name }) : undefined}>
                        {child ? t('Ask about a place') : t('Ask about joining')}
                    </ButtonLink>
                )}
                {canJoin && (
                    <Button size="sm" variant="primary" disabled={busy === 'join'} onClick={join}>
                        {busy === 'join' ? t('Sending…') : club.joinPolicy === 'OPEN_TRIAL' ? t('Join as trialist') : t('Apply as player')}
                    </Button>
                )}
                <ButtonLink size="sm" variant="ghost" to={`/clubs/${club.id}`} aria-label={t('Open {name}', { name: club.name })}>{t('Open')}</ButtonLink>
            </div>
        </article>
    );
}
