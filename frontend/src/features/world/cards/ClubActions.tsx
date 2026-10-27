import { Button, ButtonLink } from '../../../design/primitives';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { useArrangeLink } from '../compose/useArrangeLink';
import { useWorldCopy } from '../copy';
import type { ClubActions } from './useClubActions';

/**
 * The one main thing to do with a club for who is looking (ask about a place, join, apply, propose a match), or nothing.
 * Bright on the club's card; quiet on its row in a list, where every row has one. Proposing a match opens the form where
 * the club is (beside the list, or in the drawer) with the club as the opponent.
 */
export function ClubMainAction({ club, actions, variant = 'primary' }: { club: ClubProfile; actions: ClubActions; variant?: 'primary' | 'secondary' }) {
    const t = useWorldCopy();
    const { child } = actions;
    const arrange = useArrangeLink();
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
        <ButtonLink size="sm" variant={variant} {...arrange({ mode: 'direct', opponentId: club.id })} aria-label={t('Propose a match to {club}', { club: club.name })}>
            {t('Propose a match')}
        </ButtonLink>
    );
    return null;
}
