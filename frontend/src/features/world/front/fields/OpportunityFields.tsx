import { Badge, EmptyNote, List, ListRow } from '../../../../design/primitives';
import type { ClubJob } from '../../../clubs/api';
import { plural, useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { JobRow } from '../../rows';
import { codeLabel, fixtureDay, fixtureTime } from '../../format';
import { Line, ScoreGroups } from '../../scoreboard/Scoreboard';
import { useCampaigns, useJobs, useTrials } from '../frontData';
import type { FieldId } from '../fields';
import { Cluster, WorldField } from '../WorldField';
import { rowsFor, unique, when, type FieldProps } from './fieldProps';
import { orderForRole } from '../coach/relevance';

const OFF_PITCH = new Set(['MEDICAL', 'MEDIA_COMMUNICATIONS', 'FOOTBALL_OPERATIONS', 'ADMINISTRATION', 'FACILITIES']);
const JOBS: Partial<Record<FieldId, { keep: (job: ClubJob) => boolean; label: string; empty: string; to: string }>> = {
    jobs: { keep: () => true, label: 'Jobs and volunteering', empty: 'No open roles right now', to: '/world/opportunities?tab=jobs' },
    coachingJobs: { keep: job => job.category === 'COACHING', label: 'Coaching jobs', empty: 'No coaching jobs open right now', to: '/world/opportunities?tab=jobs&category=COACHING' },
    staffJobs: { keep: job => OFF_PITCH.has(job.category ?? ''), label: 'Jobs off the pitch', empty: 'No roles off the pitch open right now', to: '/world/opportunities?tab=jobs' },
    volunteering: { keep: job => job.engagementType === 'VOLUNTEER' || job.category === 'MATCHDAY', label: 'Volunteering', empty: 'No volunteering open right now', to: '/world/opportunities?tab=jobs&engagement=VOLUNTEER' },
};

/** Open roles at clubs, narrowed to what the field is about (coaching, off the pitch, volunteering), those that suit the role first. */
function Jobs({ id, area, side, role }: FieldProps & { id: FieldId }) {
    const t = useWorldCopy();
    const kind = JOBS[id]!;
    const data = useJobs(area);
    const jobs = orderForRole((data.data ?? []).filter(kind.keep), role, job => [job.title, job.requiredRole, job.description].filter(Boolean).join(' '));
    const paid = jobs.filter(job => job.engagementType && job.engagementType !== 'VOLUNTEER').length;
    return (
        <WorldField id={id} side={side} count={data.data ? jobs.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={jobs.length ? <Cluster>{unique(jobs, job => job.clubName ?? job.title).slice(0, 3).map(job => <Crest key={job.id} src={job.clubLogoUrl} name={job.clubName ?? job.title} size={30} />)}</Cluster> : undefined}
            hint={jobs.length ? (id === 'volunteering' ? unique(jobs, job => job.clubName ?? '').slice(0, 2).map(job => job.clubName).filter(Boolean).join(' · ') : [plural(paid, 'paid role'), plural(jobs.length - paid, 'volunteer role')].join(' · ')) : undefined}
            all={{ label: t('All jobs'), to: kind.to }}>
            {jobs.length ? <List label={t(kind.label)}>{jobs.slice(0, rowsFor(side)).map(job => <JobRow key={job.id} job={job} compact />)}</List>
                : <EmptyNote title={t(kind.empty)}>{t('Clubs post jobs and volunteering here.')}</EmptyNote>}
        </WorldField>
    );
}
export const JobsField = (props: FieldProps) => <Jobs {...props} id="jobs" />;
export const CoachingJobsField = (props: FieldProps) => <Jobs {...props} id="coachingJobs" />;
export const StaffJobsField = (props: FieldProps) => <Jobs {...props} id="staffJobs" />;
export const VolunteeringField = (props: FieldProps) => <Jobs {...props} id="volunteering" />;

/** Trials clubs are running, soonest first. */
export function TrialsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useTrials();
    const items = data.data?.items ?? [];
    return (
        <WorldField id="trials" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0] ? `${t('Next')}: ${when(items[0].tryoutDate)}` : undefined}
            all={{ label: t('All trials'), to: '/world/opportunities?tab=trials' }}>
            {items.length ? <ScoreGroups label={t('Open trials')} items={items.slice(0, rowsFor(side))} group={trial => fixtureDay(trial.tryoutDate)}>
                {trial => <Line key={trial.id} to={`/tryouts/${trial.id}`} when={{ time: fixtureTime(trial.tryoutDate) }} name={trial.title}
                    detail={[trial.clubName, codeLabel(trial.position), trial.location].filter(Boolean).join(' · ')} fact={codeLabel(trial.ageGroup)} factTone="warning" />}
            </ScoreGroups>
                : <EmptyNote title={t('No open trials right now')}>{t('Clubs publish trials here when they look for players.')}</EmptyNote>}
        </WorldField>
    );
}

/** Fundraisers clubs in the area are running, ending soonest first, with what the money is for. */
export function CampaignsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useCampaigns(area);
    const items = data.data?.content ?? [];
    return (
        <WorldField id="campaigns" side={side} count={data.data?.totalElements ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={items.length ? <Cluster>{unique(items, item => String(item.clubId)).slice(0, 3).map(item => <Crest key={item.id} src={item.clubLogoUrl} name={item.clubName} size={30} />)}</Cluster> : undefined}
            hint={area.city} all={{ label: t('All fundraisers'), to: '/campaigns' }}>
            {items.length ? <List label={t('Support a club')}>{items.slice(0, rowsFor(side)).map(item => <ListRow key={item.id} to={`/campaigns/${item.id}`}
                lead={<Crest src={item.clubLogoUrl} name={item.clubName} size={36} />} title={item.title}
                meta={[item.clubName, item.summary].filter(Boolean).join(' · ')}
                trail={item.goalAmount ? <Badge tone="accent">{t('Goal {amount}', { amount: `${item.goalAmount.toLocaleString()} ${item.currency}` })}</Badge> : undefined} />)}</List>
                : <EmptyNote title={t('No fundraisers in {city} right now', { city: area.city })} />}
        </WorldField>
    );
}
