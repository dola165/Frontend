import { useCallback } from 'react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { JobChoice, JobStatus, PersonJob } from './api';

const EN: Record<string, string> = {
    HEAD_COACH: 'Head coach', ASSISTANT_COACH: 'Assistant coach', TEAM_MANAGER: 'Team manager', FEES: 'Fees', ADMIN: 'Admin',
    OWNER: 'Owner', COACH: 'Coach', CUSTOM: 'Custom',
};
const KA: Record<string, string> = {
    HEAD_COACH: 'მთავარი მწვრთნელი', ASSISTANT_COACH: 'მწვრთნელის ასისტენტი', TEAM_MANAGER: 'გუნდის მენეჯერი', FEES: 'გადასახადები', ADMIN: 'ადმინი',
    OWNER: 'მფლობელი', COACH: 'მწვრთნელი', CUSTOM: 'საკუთარი',
};

/** How jobs, where they apply and their state read, in the app's language. */
export function useJobWords(choices: JobChoice[] = []) {
    const copy = useJourneyCopy();
    const jobName = useCallback((key: string, fallback?: string) => EN[key] ? copy(EN[key], KA[key]) : choices.find(c => c.key === key)?.title ?? fallback ?? key, [copy, choices]);
    const jobLabel = useCallback((job: Pick<PersonJob, 'job' | 'title'>) => job.job === 'CUSTOM' ? job.title : jobName(job.job, job.title), [jobName]);
    const whereLabel = useCallback((job: Pick<PersonJob, 'clubWide' | 'squads'>) => job.clubWide ? copy('Whole club', 'მთელი კლუბი') : job.squads.map(s => s.name).join(', '), [copy]);
    const statusLabel = useCallback((status: JobStatus) => ({
        ACTIVE: null, INVITED: copy('Invited', 'მოწვეული'), SUGGESTED: copy('Suggested', 'შეთავაზებული'), UPCOMING: copy('Starts later', 'მოგვიანებით იწყება'),
        EXPIRED: copy('Invite expired', 'მოწვევის ვადა გავიდა'), UNAVAILABLE: copy('Can’t start', 'ვერ დაიწყება'),
    })[status], [copy]);
    return { copy, jobName, jobLabel, whereLabel, statusLabel };
}
