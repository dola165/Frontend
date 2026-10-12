import { Check, Plus } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { useWorldCopy } from '../copy';
import type { ClubActions } from './useClubActions';

/** Follow, or Following: a toggle that says which it is. */
export function FollowClubButton({ actions }: { actions: ClubActions }) {
    const t = useWorldCopy();
    return (
        <Button size="sm" aria-pressed={actions.following} disabled={actions.busy === 'follow'} onClick={actions.follow}>
            {actions.following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{actions.following ? t('Following') : t('Follow')}
        </Button>
    );
}

/**
 * The one main thing to do with a club for who is looking (ask about a place, join, apply, propose a match), or nothing.
 * Bright on the club's card; quiet on its row in a list, where every row has one.
 */
export function ClubMainAction({ club, actions, variant = 'primary' }: { club: ClubProfile; actions: ClubActions; variant?: 'primary' | 'secondary' }) {
    const t = useWorldCopy();
    const { child } = actions;
    if (actions.enquiry) return (
        <ButtonLink size="sm" variant={variant} to={actions.enquiry}
            aria-label={child ? t('Ask {club} about a place for {name}', { club: club.name, name: child.name }) : undefined}>
            {child ? t('Ask about a place') : t('Ask about joining')}
        </ButtonLink>
    );
    if (actions.canJoin) return (
        <Button size="sm" variant={variant} disabled={actions.busy === 'join'} onClick={actions.join}>
            {actions.busy === 'join' ? t('Sending…') : club.playerJoinPolicy === 'OPEN_TRIAL' ? t('Join as trialist') : t('Apply as player')}
        </Button>
    );
    if (actions.propose) return (
        <ButtonLink size="sm" variant={variant} to={`/world/matches/arrange?opponent=${club.id}`} aria-label={t('Propose a match to {club}', { club: club.name })}>
            {t('Propose a match')}
        </ButtonLink>
    );
    return null;
}
