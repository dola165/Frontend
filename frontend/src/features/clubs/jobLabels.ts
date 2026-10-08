import type { ClubJob, ClubJobCategory, ClubJobEngagementType } from './api';
export const CATEGORIES: Array<{ value: 'ALL' | ClubJobCategory; label: string }> = [
    { value: 'ALL', label: 'All football roles' },
    { value: 'COACHING', label: 'Coaching' },
    { value: 'FOOTBALL_OPERATIONS', label: 'Football operations' },
    { value: 'ADMINISTRATION', label: 'Administration' },
    { value: 'MEDIA_COMMUNICATIONS', label: 'Media & communications' },
    { value: 'FACILITIES', label: 'Facilities & maintenance' },
    { value: 'MEDICAL', label: 'Medical & wellbeing' },
    { value: 'MATCHDAY', label: 'Matchday staff' },
    { value: 'OTHER', label: 'Other club roles' },
];

export const ENGAGEMENTS: Array<{ value: 'ALL' | ClubJobEngagementType; label: string }> = [
    { value: 'ALL', label: 'All engagement types' },
    { value: 'PAID', label: 'Paid role' },
    { value: 'VOLUNTEER', label: 'Ongoing volunteer role' },
    { value: 'FLEXIBLE', label: 'Flexible: paid or volunteer' },
    { value: 'UNSPECIFIED', label: 'Engagement not specified' },
];

export const POSTED_OPTIONS = [
    { value: 'ALL', label: 'Any posting date' },
    { value: '7D', label: 'Past 7 days' },
    { value: '30D', label: 'Past 30 days' },
] as const;

export const labelForCategory = (value?: string | null) =>
    CATEGORIES.find((item) => item.value === value)?.label ?? 'Other club role';
export const labelForEngagement = (value?: string | null) =>
    ENGAGEMENTS.find((item) => item.value === value)?.label ?? 'Engagement not specified';
export const supportsInAppApplication = (job: Pick<ClubJob, 'requiredRole'>) =>
    job.requiredRole === 'PLAYER' || job.requiredRole === 'COACH';
export const applicationMethodLabel = (job: Pick<ClubJob, 'requiredRole'>) =>
    supportsInAppApplication(job) ? 'In-app application' : 'Contact the club';
export const expectedNextStepLabel = (job: Pick<ClubJob, 'requiredRole'>) =>
    supportsInAppApplication(job)
        ? 'Send an application for club review'
        : 'Contact the club to ask how to apply';
export const eligibilityLabel = (job: Pick<ClubJob, 'ageGroup' | 'level'>) => {
    const eligibility = [
        job.ageGroup ? `Age group: ${job.ageGroup}` : null,
        job.level && job.level !== 'ANY' ? `Experience: ${job.level.toLowerCase()}` : null,
    ].filter(Boolean);
    return eligibility.length ? eligibility.join(' · ') : null;
};
export const locationLabel = (job: ClubJob) =>
    [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ') || 'Location not specified';

export const relativeDate = (value?: string | null) => {
    if (!value) return 'Recently posted';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently posted';
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    if (days === 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    return `Posted ${days} days ago`;
};
