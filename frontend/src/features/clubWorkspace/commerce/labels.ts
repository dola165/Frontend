import { ct } from '../../store/copy';
import type { ClubJobCategory, ClubJobEngagementType } from '../../clubs/api';
import { CAMPAIGN_CATEGORIES } from '../../campaigns/api';

/** Display names for role postings, store products and campaigns in the club workspace. */
export const JOB_CATEGORIES: Array<{ value: ClubJobCategory; label: string }> = [
    { value: 'COACHING', label: 'Coaching' }, { value: 'FOOTBALL_OPERATIONS', label: 'Football operations' },
    { value: 'ADMINISTRATION', label: 'Administration' }, { value: 'MEDIA_COMMUNICATIONS', label: 'Media & communications' },
    { value: 'FACILITIES', label: 'Facilities & maintenance' }, { value: 'MEDICAL', label: 'Medical & wellbeing' },
    { value: 'MATCHDAY', label: 'Matchday staff' }, { value: 'OTHER', label: 'Other club role' },
];
export const ENGAGEMENT_TYPES: Array<{ value: ClubJobEngagementType; label: string }> = [
    { value: 'PAID', label: 'Paid role' }, { value: 'VOLUNTEER', label: 'Ongoing volunteer role' },
    { value: 'FLEXIBLE', label: 'Flexible: paid or volunteer' }, { value: 'UNSPECIFIED', label: 'Engagement not specified' },
];
export const categoryName = (value?: string | null) => ct(JOB_CATEGORIES.find(item => item.value === value)?.label);
export const engagementName = (value?: string | null) => ct(ENGAGEMENT_TYPES.find(item => item.value === value)?.label);
export const levelName = (value?: string | null) => value ? value.charAt(0) + value.slice(1).toLowerCase() : '';
export const appliesInApp = (requiredRole?: string | null) => requiredRole === 'PLAYER' || requiredRole === 'COACH';
export const campaignCategory = (value?: string | null) => ct(CAMPAIGN_CATEGORIES.find(category => category.value === value)?.label);
export const categoryLabel = (value?: string | null) => { const text = (value ?? 'OTHER').toLowerCase().replaceAll('_', ' '); return text.charAt(0).toUpperCase() + text.slice(1); };
