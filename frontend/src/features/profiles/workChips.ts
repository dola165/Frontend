import type { CATEGORIES } from '../jobs/api';

/**
 * What people do, as real job titles, each with the jobs category it opens. The welcome's Work step and "What you do"
 * on your football profile offer the same chips; a chip saves as a profession in the person's own words.
 */
export const WORK_CHIPS: { id: string; en: string; ka: string; category: typeof CATEGORIES[number]['value'] }[] = [
    { id: 'coach', en: 'Coach', ka: 'მწვრთნელი', category: 'COACHING' },
    { id: 'assistant', en: 'Assistant coach', ka: 'მწვრთნელის ასისტენტი', category: 'COACHING' },
    { id: 'goalkeeping', en: 'Goalkeeper coach', ka: 'მეკარეთა მწვრთნელი', category: 'COACHING' },
    { id: 'referee', en: 'Referee', ka: 'მსაჯი', category: 'MATCHDAY' },
    { id: 'physio', en: 'Physio', ka: 'ფიზიოთერაპევტი', category: 'MEDICAL' },
    { id: 'analyst', en: 'Analyst', ka: 'ანალიტიკოსი', category: 'FOOTBALL_OPERATIONS' },
    { id: 'scout', en: 'Scout', ka: 'სკაუტი', category: 'FOOTBALL_OPERATIONS' },
    { id: 'manager', en: 'Team manager', ka: 'გუნდის მენეჯერი', category: 'FOOTBALL_OPERATIONS' },
    { id: 'agent', en: 'Agent', ka: 'აგენტი', category: 'OTHER' },
    { id: 'media', en: 'Photographer', ka: 'ფოტოგრაფი', category: 'MEDIA_COMMUNICATIONS' },
    { id: 'volunteer', en: 'Volunteer', ka: 'მოხალისე', category: 'OTHER' },
];

/** Whether a saved profession title is this chip, in either language. */
export const isChip = (title: string, chip: (typeof WORK_CHIPS)[number]) => {
    const name = title.trim().toLowerCase();
    return name === chip.en.toLowerCase() || name === chip.ka;
};
