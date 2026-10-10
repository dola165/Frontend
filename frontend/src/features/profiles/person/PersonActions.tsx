import { Check, MessageCircle, PenLine, Plus, Share2 } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { RepresentationShortcut } from '../../agents/RepresentationPanel';
import { ReportControl } from '../../moderation/Reporting';
import type { PersonProfile } from '../api';

/**
 * Your own profile: edit it. Someone else's: follow (the one primary action), message,
 * representation when it applies, report or block, and share.
 */
export function PersonActions({ profile, own, onFollow, onShare, onRepresentation }: {
    profile: PersonProfile; own: boolean; onFollow: () => void; onShare: () => void; onRepresentation: () => void;
}) {
    const share = <Button variant="ghost" iconOnly aria-label="Share profile" title="Share profile" onClick={onShare}><Share2 aria-hidden="true" /></Button>;
    if (own) return <>
        {share}
        <ButtonLink variant="primary" to="/account/roles"><PenLine aria-hidden="true" />Edit profile</ButtonLink>
    </>;
    return <>
        {share}
        <ReportControl targetType="ACCOUNT" targetId={profile.id} personId={profile.id} className="gk-btn gk-btn--ghost" />
        <RepresentationShortcut profileId={profile.id} className="gk-btn gk-btn--secondary" onOpen={onRepresentation} />
        <ButtonLink to={`/messages?chatWith=${profile.id}`}><MessageCircle aria-hidden="true" />Message</ButtonLink>
        <Button variant={profile.isFollowedByMe ? 'secondary' : 'primary'} aria-pressed={profile.isFollowedByMe} onClick={onFollow}>
            {profile.isFollowedByMe ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{profile.isFollowedByMe ? 'Following' : 'Follow'}
        </Button>
    </>;
}
