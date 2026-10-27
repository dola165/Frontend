import { BadgeCheck, Check } from 'lucide-react';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { Status } from '../../../design/DataTable';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { ResultRow } from '../directory/ResultRow';
import { clubTypeLabel, distanceLabel } from '../format';
import { peekOf } from '../peek/usePeek';
import { ClubMainAction } from './ClubActions';
import { FollowButton } from '../../actions/FollowButton';
import { fittingProgrammes, publicProgrammes } from './programmes';
import { ageOn } from '../players';
import { useClubActions } from './useClubActions';

/**
 * A club as one line of a list, the way LinkedIn lists companies: its crest, its name (the verified tick after it), what
 * kind of club and where, one fact (a programme that fits the child a parent searches for, or that none does, else the
 * academy and its pro club, else its members), where the person stands with it, and the one main action for who is
 * looking (else Follow). Its name goes to the club page; a press elsewhere shows the club beside the list.
 */
export function ClubRow({ club, distanceKm }: { club: ClubProfile; distanceKm?: number }) {
    const t = useWorldCopy();
    const actions = useClubActions(club);
    const { standing, linked, message, child } = actions;
    const fitting = child ? fittingProgrammes(club.presentation, child) : [];
    // A parent searching for a child is told plainly when none of the club's programmes is for that age.
    const age = ageOn(child?.dateOfBirth), unfit = child && age != null && !fitting.length && publicProgrammes(club.presentation).length > 0;
    const where = [t(clubTypeLabel(club.type)), club.cityName || club.addressText?.split(',')[0] || t('Location not published'), distanceKm != null ? distanceLabel(distanceKm) : null].filter(Boolean).join(' · ');
    const fact = unfit ? <span className="gk-faint">{t('No programme listed for age {age}', { age: age! })}</span>
        : fitting.length && child ? <span className="gk-result-open"><Check aria-hidden="true" />{t('Fits {name}', { name: child.name.split(' ')[0] })}: {fitting[0].name}</span>
        : linked ? <><Crest src={linked.logoUrl} name={linked.name} size={14} round /><span>{linked.profileKind === 'ACADEMY' ? t('Academy: {name}', { name: linked.name }) : t('Academy of {name}', { name: linked.name })}</span></>
            : plural(club.memberCount, 'member');
    return (
        <ResultRow lead={<Crest src={club.logoUrl} name={club.name} size={40} />} title={club.name} to={`/clubs/${club.id}`} peek={peekOf('club', club.id)}
            mark={club.isOfficial ? <BadgeCheck className="gk-world-verified" aria-label={t('Verified club')} /> : undefined}
            lines={[where, fact, message && <span role={message.error ? 'alert' : 'status'} className={message.error ? 'gk-result-error' : 'gk-result-open'}>{message.text}</span>]}
            aside={standing && <Status tone={standing.tone}>{t(standing.label)}</Status>}
            action={actions.enquiry || actions.canJoin || actions.propose ? <ClubMainAction club={club} actions={actions} variant="secondary" /> : <FollowButton subject={{ kind: 'club', id: club.id }} following={actions.following} name={club.name} size="sm" onChange={actions.setFollowing} />} />
    );
}
