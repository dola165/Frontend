import { useState } from 'react';
import { Button, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { ActionButton } from '../../actions/ActionButton';
import { useWorldCopy } from '../copy';
import { AskTheClub } from '../finder/AskTheClub';
import { fittingProgrammes } from './programmes';
import type { ClubActions } from './useClubActions';

/**
 * The one main thing to do with a club for who is looking (ask about a place, join, apply, arrange a match), or nothing.
 * A parent asks about a place for the chosen child here in World. Arranging a match opens the
 * shared sheet over the page, with the club filled in when the coach invites it.
 */
export function ClubMainAction({ club, actions, variant = 'primary' }: { club: ClubProfile; actions: ClubActions; variant?: 'primary' | 'secondary' }) {
    const t = useWorldCopy();
    const { child } = actions;
    const [asking, setAsking] = useState(false);
    if (actions.enquiry && child) return <>
        <Button size="sm" variant={variant} onClick={() => setAsking(true)} data-guide="ask-club"
            aria-label={t('Ask {club} about a place for {name}', { club: club.name, name: child.name })}>{t('Ask about a place')}</Button>
        {asking && <Dialog open size="sm" title={club.name} onClose={() => setAsking(false)} closeLabel={t('Close')}>
            <AskTheClub club={club} group={null} programmes={fittingProgrammes(club.presentation, child)} onClose={() => setAsking(false)} />
        </Dialog>}
    </>;
    if (actions.enquiry) return <ButtonLink size="sm" variant={variant} to={actions.enquiry}>{t('Ask about joining')}</ButtonLink>;
    if (actions.canJoin) return (
        <Button size="sm" variant={variant} disabled={actions.busy === 'join'} onClick={actions.join}>
            {actions.busy === 'join' ? t('Sending…') : club.playerJoinPolicy === 'OPEN_TRIAL' ? t('Join as trialist') : t('Apply as player')}
        </Button>
    );
    if (actions.propose) return <ActionButton action="arrange_match" size="sm" variant={variant} hints={{ opponentId: club.id }} label={t('Arrange a match')} />;
    return null;
}
