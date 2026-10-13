import { MapPin } from 'lucide-react';
import { Status } from '../../../design/DataTable';
import type { ClubJob } from '../../clubs/api';
import { labelForCategory } from '../../clubs/jobLabels';
import type { TryoutPosting } from '../../tryouts/api';
import { postingLabel } from '../../tryouts/tryoutCopy';
import type { Opportunity } from '../../admissions/types';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { DateLead, ResultRow } from '../directory/ResultRow';
import { bilingual, codeLabel, ENGAGEMENT, fixtureDay, fixtureTime, postedLabel } from '../format';
import { peekOf } from '../peek/usePeek';
import { groupFor, groupTone } from './groupFacts';

export interface GroupResult { group: Opportunity; player?: number }

/**
 * An open role as LinkedIn lists jobs: the club's crest, the role as the link, the club and where, what kind of role,
 * when it was posted and how many applied; its terms (paid, volunteer) at the end. It opens beside the list.
 */
export function JobItem({ item: job }: { item: ClubJob }) {
    const t = useWorldCopy();
    const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    const place = [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ');
    return (
        <ResultRow lead={<Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={40} />} title={job.title} to={`/jobs/${job.id}`} peek={peekOf('job', job.id)}
            lines={[
                <>{job.clubName}{place && <><span aria-hidden="true">·</span><span className="gk-result__where"><MapPin aria-hidden="true" />{place}</span></>}</>,
                [job.category ? t(labelForCategory(job.category)) : null, postedLabel(job.createdAt), job.applicationCount ? plural(job.applicationCount, 'applicant') : null].filter(Boolean).join(' · '),
            ]}
            aside={<Status tone={terms.tone}>{t(terms.label)}</Status>} />
    );
}
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
