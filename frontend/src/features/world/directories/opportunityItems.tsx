import { Status } from '../../../design/DataTable';
import type { TryoutPosting } from '../../tryouts/api';
import { postingLabel } from '../../tryouts/tryoutCopy';
import type { Opportunity } from '../../admissions/types';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { DateLead, ResultRow } from '../directory/ResultRow';
import { bilingual, codeLabel, fixtureDay, fixtureTime } from '../format';
import { peekOf } from '../peek/usePeek';
import { groupFor, groupTone } from './groupFacts';

export interface GroupResult { group: Opportunity; player?: number }

/** A trial as a row: its time and day where a crest would be, its title (to its page), the club and who it is for, where, and whether applications are open. It shows beside the list. */
export function TrialItem({ item: trial }: { item: TryoutPosting }) {
    useWorldCopy();
    return (
        <ResultRow lead={<DateLead top={fixtureTime(trial.tryoutDate)} bottom={fixtureDay(trial.tryoutDate)} />} title={trial.title} to={`/tryouts/${trial.id}`} peek={peekOf('trial', trial.id)}
            lines={[[trial.clubName, codeLabel(trial.ageGroup), codeLabel(trial.position)].filter(Boolean).join(' · '), trial.location]}
            aside={<Status tone={trial.status === 'OPEN' ? 'accent' : 'neutral'}>{postingLabel(trial.status, bilingual)}</Status>} />
    );
}


/** A place to train as a row under the map: who runs it and who it is for, where it trains, whether there are places. It shows beside the list. */
export function TrainingItem({ item: { group, player } }: { item: GroupResult }) {
    const t = useWorldCopy();
    const { availability } = useAdmissionCopy();
    return (
        <ResultRow lead={<Crest name={group.organizationName} size={40} />} title={group.name} to={`/admissions/opportunities/${group.id}${player ? `?player=${player}` : ''}`} peek={peekOf('group', group.id)}
            lines={[[group.organizationName, ...groupFor(group, t)].filter(Boolean).join(' · '), [group.location.name, group.schedule].filter(Boolean).join(' · ')]}
            aside={<Status tone={groupTone(group)}>{availability(group.availability)}</Status>} />
    );
}
