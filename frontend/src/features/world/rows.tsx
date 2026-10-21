import { Badge, ListRow } from '../../design/primitives';
import { Status } from '../../design/DataTable';
import type { ClubJob } from '../clubs/api';
import { labelForCategory } from '../clubs/jobLabels';
import type { PersonSummary } from './api';
import { useWorldCopy } from './copy';
import { Crest } from './Crest';
import { useMapCounterpart } from './directory/selection';
import { ENGAGEMENT, PERSON_ROLE, postedLabel } from './format';

/** An open club role: who posted it, what it is, paid or volunteer. */
export function JobRow({ job, compact = false }: { job: ClubJob; compact?: boolean }) {
    const t = useWorldCopy();
    const engagement = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
    const place = [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ');
    return (
        <ListRow to={`/jobs/${job.id}`} {...useMapCounterpart()} lead={<Crest src={job.clubLogoUrl} name={job.clubName ?? job.title} size={compact ? 36 : 40} />}
            title={job.title}
            meta={(compact ? [job.clubName, job.clubCityName] : [job.clubName, t(labelForCategory(job.category)), place, postedLabel(job.createdAt)]).filter(Boolean).join(' · ')}
            trail={<Status tone={engagement.tone}>{t(engagement.label)}</Status>} />
    );
}

/** A person with a public football profile: their face, name, what they do and where, and their People view. */
export function PersonRow({ person: p, compact = false }: { person: PersonSummary; compact?: boolean }) {
    const t = useWorldCopy();
    const club = p.clubName && !p.headline?.includes(p.clubName) ? p.clubName : null;
    return (
        <ListRow to={`/profile/${p.id}`} {...useMapCounterpart()} lead={<Crest src={p.avatarUrl} name={p.fullName} round size={compact ? 36 : 40} />}
            title={p.fullName}
            meta={[p.headline || p.profession, compact ? null : club, p.city].filter(Boolean).join(' · ')}
            trail={<Badge tone={p.role === 'REFEREE' ? 'info' : p.role === 'COACH' ? 'accent' : 'neutral'}>{t(PERSON_ROLE[p.role])}</Badge>} />
    );
}

