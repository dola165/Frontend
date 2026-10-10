import { Badge, ListRow } from '../../../design/primitives';
import type { ClubJob } from '../../clubs/api';
import type { TryoutPosting } from '../../tryouts/api';
import type { Opportunity } from '../../admissions/types';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { Crest } from '../Crest';
import { JobRow, TrialRow } from '../rows';

export interface GroupResult { group: Opportunity; player?: number }

export const JobItem = ({ item }: { item: ClubJob }) => <JobRow job={item} />;
export const TrialItem = ({ item }: { item: TryoutPosting }) => <TrialRow trial={item} />;

export function GroupItem({ item: { group, player } }: { item: GroupResult }) {
    const { availability } = useAdmissionCopy();
    const open = group.availability === 'PLACES_AVAILABLE' || group.availability === 'APPLICATIONS_OPEN';
    return (
        <ListRow to={`/admissions/opportunities/${group.id}${player ? `?player=${player}` : ''}`} lead={<Crest name={group.organizationName} size={40} />}
            title={group.name}
            meta={[group.organizationName, `Born ${group.birthYearFrom}–${group.birthYearTo}`, group.gender === 'ANY' ? null : group.gender === 'MALE' ? 'Boys' : 'Girls', group.beginnerWelcome ? 'Beginners welcome' : null, group.location.name].filter(Boolean).join(' · ')}
            trail={<Badge tone={open ? 'accent' : group.availability === 'WAITLIST' ? 'warning' : 'neutral'}>{availability(group.availability)}</Badge>} />
    );
}
