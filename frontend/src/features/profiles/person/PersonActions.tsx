import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
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
    const copy = useJourneyCopy();
    const share = <Button variant="ghost" iconOnly aria-label={copy('Share profile', 'პროფილის გაზიარება')} title={copy('Share profile', 'პროფილის გაზიარება')} onClick={onShare}><Share2 aria-hidden="true" /></Button>;
    if (own) return <>
        {share}
        <ButtonLink variant="primary" to="/account/football"><PenLine aria-hidden="true" />{copy('Edit profile', 'პროფილის რედაქტირება')}</ButtonLink>
    </>;
    return <>
        {share}
        <ReportControl targetType="ACCOUNT" targetId={profile.id} personId={profile.id} className="gk-btn gk-btn--ghost" />
        <RepresentationShortcut profileId={profile.id} className="gk-btn gk-btn--secondary" onOpen={onRepresentation} />
        <ButtonLink to={`/messages?chatWith=${profile.id}`}><MessageCircle aria-hidden="true" />{copy('Message', 'მიწერა')}</ButtonLink>
        <Button variant={profile.isFollowedByMe ? 'secondary' : 'primary'} aria-pressed={profile.isFollowedByMe} onClick={onFollow}>
            {profile.isFollowedByMe ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{profile.isFollowedByMe ? copy('Following', 'გამოწერილია') : copy('Follow', 'გამოწერა')}
        </Button>
    </>;
}
