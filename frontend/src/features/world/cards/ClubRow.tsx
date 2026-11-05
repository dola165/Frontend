import { BadgeCheck, Check } from 'lucide-react';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { Status } from '../../../design/DataTable';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { ResultRow } from '../directory/ResultRow';
import { clubTypeLabel, distanceLabel } from '../format';
import { peekOf } from '../peek/usePeek';
import { FollowButton } from '../../actions/FollowButton';
import { fittingProgrammes, programmeBorn, publicProgrammes } from './programmes';
import { parentName } from '../finder/waysIn';
import { ageOn } from '../players';
import { useClubActions } from './useClubActions';
import { useFinder } from '../finder/finderContext';
import { FinderClubRow } from '../finder/FinderClubRow';

/**
 * A club as one line of a list, the way LinkedIn lists companies: its crest, its name (the verified tick after it), what
 * kind of club and where, one fact (a programme that fits the child a parent searches for, or that none does, else the
 * academy and its pro club, else its members), where the person stands with it, and Follow. The same for everyone:
 * joining and the rest happen on the club page. Its name and crest go to the club page; a press elsewhere shows the
 * club beside the list.
 */
export function ClubRow(props: { club: ClubProfile; distanceKm?: number }) {
    // In Parent Hub's club finder the club opens inside the list, with the ways in for the child.
    return useFinder() ? <FinderClubRow club={props.club} distanceKm={props.distanceKm} /> : <WorldClubRow {...props} />;
}

function WorldClubRow({ club, distanceKm }: { club: ClubProfile; distanceKm?: number }) {
    const t = useWorldCopy();
    const actions = useClubActions(club);
    const { standing, linked, child } = actions;
    const fitting = child ? fittingProgrammes(club.presentation, child) : [];
    // A parent searching for a child is told plainly when none of the club's programmes is for that age.
    const age = ageOn(child?.dateOfBirth), unfit = child && age != null && !fitting.length && publicProgrammes(club.presentation).length > 0;
    const where = [t(clubTypeLabel(club.type)), club.cityName || club.addressText?.split(',')[0] || t('Location not published'), distanceKm != null ? distanceLabel(distanceKm) : null].filter(Boolean).join(' · ');
    const fact = unfit ? <span className="gk-faint">{t('No programme listed for age {age}', { age: age! })}</span>
        : fitting.length && child ? <span className="gk-result-open"><Check aria-hidden="true" />{t('Fits {name}', { name: child.name.split(' ')[0] })}: {[parentName(fitting[0].name), programmeBorn(fitting[0])].filter(Boolean).join(' · ')}</span>
        : linked ? <><Crest src={linked.logoUrl} name={linked.name} size={14} round /><span>{linked.profileKind === 'ACADEMY' ? t('Academy: {name}', { name: linked.name }) : t('Academy of {name}', { name: linked.name })}</span></>
            : plural(club.memberCount, 'member');
    return (
        <ResultRow lead={<Crest src={club.logoUrl} name={club.name} size={40} />} title={club.name} to={`/clubs/${club.id}`} peek={peekOf('club', club.id)}
            mark={club.isOfficial ? <BadgeCheck className="gk-world-verified" aria-label={t('Verified club')} /> : undefined}
            lines={[where, fact]}
            aside={standing && <Status tone={standing.tone}>{t(standing.label)}</Status>}
            action={<FollowButton subject={{ kind: 'club', id: club.id }} following={actions.following} name={club.name} size="sm" onChange={actions.setFollowing} />} />
    );
}
