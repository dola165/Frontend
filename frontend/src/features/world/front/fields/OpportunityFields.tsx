import { EmptyNote, List } from '../../../../design/primitives';
import { plural, useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { JobRow, TrialRow } from '../../rows';
import { useJobs, useTrials } from '../frontData';
import { Cluster, WorldField } from '../WorldField';
import { rowsFor, unique, when, type FieldProps } from './fieldProps';

/** Open roles at clubs, or only the coaching ones. */
function Jobs({ area, side, coachingOnly }: FieldProps & { coachingOnly?: boolean }) {
    const t = useWorldCopy();
    const data = useJobs(area);
    const jobs = (data.data ?? []).filter(job => !coachingOnly || job.category === 'COACHING');
    const paid = jobs.filter(job => job.engagementType && job.engagementType !== 'VOLUNTEER').length;
    return (
        <WorldField id={coachingOnly ? 'coachingJobs' : 'jobs'} side={side} count={data.data ? jobs.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={jobs.length ? <Cluster>{unique(jobs, job => job.clubName ?? job.title).slice(0, 3).map(job => <Crest key={job.id} src={job.clubLogoUrl} name={job.clubName ?? job.title} size={30} />)}</Cluster> : undefined}
            hint={jobs.length ? [plural(paid, 'paid role'), plural(jobs.length - paid, 'volunteer role')].join(' · ') : undefined}
            all={{ label: t('All jobs'), to: coachingOnly ? '/world/opportunities?tab=jobs&category=COACHING' : '/world/opportunities?tab=jobs' }}>
            {jobs.length ? <List label={t(coachingOnly ? 'Coaching jobs' : 'Jobs and volunteering')}>{jobs.slice(0, rowsFor(side)).map(job => <JobRow key={job.id} job={job} compact />)}</List>
                : <EmptyNote title={t(coachingOnly ? 'No coaching jobs open right now' : 'No open roles right now')}>{t('Clubs post jobs and volunteering here.')}</EmptyNote>}
        </WorldField>
    );
}
export const JobsField = (props: FieldProps) => <Jobs {...props} />;
export const CoachingJobsField = (props: FieldProps) => <Jobs {...props} coachingOnly />;

/** Trials clubs are running, soonest first. */
export function TrialsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useTrials();
    const items = data.data?.items ?? [];
    return (
        <WorldField id="trials" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0] ? `${t('Next')}: ${when(items[0].tryoutDate)}` : undefined}
            all={{ label: t('All trials'), to: '/world/opportunities?tab=trials' }}>
            {items.length ? <List label={t('Open trials')}>{items.slice(0, rowsFor(side)).map(trial => <TrialRow key={trial.id} trial={trial} />)}</List>
                : <EmptyNote title={t('No open trials right now')}>{t('Clubs publish trials here when they look for players.')}</EmptyNote>}
        </WorldField>
    );
}
