import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { MessageCircle, Share2, Shirt } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { FollowButton } from '../../actions/FollowButton';
import { RepresentationShortcut } from '../../agents/RepresentationPanel';
import { ReportControl } from '../../moderation/Reporting';
import type { PersonProfile } from '../api';

/**
 * Your own profile: everything is edited where it is shown; "Your football" opens your lines, jobs and the line under your name. Someone else's: follow (the one primary action), message,
 * representation when it applies, report or block, and share.
 */
export function PersonActions({ profile, own, onFollowChange, onShare, onRepresentation }: {
    profile: PersonProfile; own: boolean; onFollowChange: (following: boolean) => void; onShare: () => void; onRepresentation: () => void;
}) {
    const copy = useJourneyCopy();
    const share = <Button variant="ghost" iconOnly aria-label={copy('Share profile', 'პროფილის გაზიარება')} title={copy('Share profile', 'პროფილის გაზიარება')} onClick={onShare}><Share2 aria-hidden="true" /></Button>;
    if (own) return <>
        {share}
        <ButtonLink to="/account/football"><Shirt aria-hidden="true" />{copy('Your football', 'თქვენი ფეხბურთი')}</ButtonLink>
    </>;
    return <>
        {share}
        <ReportControl targetType="ACCOUNT" targetId={profile.id} personId={profile.id} className="gk-btn gk-btn--ghost" />
        <RepresentationShortcut profileId={profile.id} className="gk-btn gk-btn--secondary" onOpen={onRepresentation} />
        <ButtonLink to={`/messages?chatWith=${profile.id}`}><MessageCircle aria-hidden="true" />{copy('Message', 'მიწერა')}</ButtonLink>
        <FollowButton subject={{ kind: 'person', id: profile.id }} following={profile.isFollowedByMe} primary onChange={onFollowChange} />
    </>;
}
