import { MapPin } from 'lucide-react';
import { Badge, ListRow } from '../../../design/primitives';
import type { ClubJob } from '../../clubs/api';
import { labelForCategory } from '../../clubs/jobLabels';
import type { TryoutPosting } from '../../tryouts/api';
import type { Opportunity } from '../../admissions/types';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { ResultRow } from '../directory/ResultRow';
import { useMapCounterpart } from '../directory/selection';
import { ENGAGEMENT, postedLabel } from '../format';
import { peekOf } from '../peek/usePeek';
import { TrialRow } from '../rows';

export interface GroupResult { group: Opportunity; player?: number }

/**
 * An open role as LinkedIn lists jobs: the club's crest, the role as the link, the club, where and what kind of role,
 * when it was posted and how many applied; its terms (paid, volunteer) at the end. It opens in the job drawer.
 */
export function JobItem({ item: job }: { item: ClubJob }) {
    const t = useWorldCopy();
    const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    const place = [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ');
    return (
        <ResultRow lead={<Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={56} />} title={job.title} to={`/jobs/${job.id}`} peek={peekOf('job', job.id)}
            lines={[
                job.clubName,
                <span className="gk-result__where"><MapPin aria-hidden="true" />{[place, job.category ? t(labelForCategory(job.category)) : null].filter(Boolean).join(' · ')}</span>,
                [postedLabel(job.createdAt), job.applicationCount ? plural(job.applicationCount, 'applicant') : null].filter(Boolean).join(' · '),
            ]}
            aside={<Badge tone={terms.tone}>{t(terms.label)}</Badge>} />
    );
}
export const TrialItem = ({ item }: { item: TryoutPosting }) => <TrialRow trial={item} />;

export function GroupItem({ item: { group, player } }: { item: GroupResult }) {
    const t = useWorldCopy();
    const { availability } = useAdmissionCopy();
    const counterpart = useMapCounterpart();
    const open = group.availability === 'PLACES_AVAILABLE' || group.availability === 'APPLICATIONS_OPEN';
    return (
        <ListRow to={`/admissions/opportunities/${group.id}${player ? `?player=${player}` : ''}`} lead={<Crest name={group.organizationName} size={40} />} {...counterpart}
            title={group.name}
            meta={[group.organizationName, t('Born {from}–{to}', { from: group.birthYearFrom, to: group.birthYearTo }), group.gender === 'ANY' ? null : group.gender === 'MALE' ? t('Boys') : t('Girls'), group.beginnerWelcome ? t('Beginners welcome') : null, group.location.name].filter(Boolean).join(' · ')}
            trail={<Badge tone={open ? 'accent' : group.availability === 'WAITLIST' ? 'warning' : 'neutral'}>{availability(group.availability)}</Badge>} />
    );
}
