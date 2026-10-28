import { useCallback } from 'react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { JobChoice, JobStatus, PersonJob } from './api';

export const JOB_WORDS: Record<string, readonly [string, string]> = {
    "HEAD_COACH": [
        "Head coach",
        "მთავარი მწვრთნელი"
    ],
    "ASSISTANT_COACH": [
        "Assistant coach",
        "მწვრთნელის ასისტენტი"
    ],
    "TEAM_MANAGER": [
        "Team manager",
        "გუნდის მენეჯერი"
    ],
    "FEES": [
        "Fees",
        "გადასახადები"
    ],
    "ADMIN": [
        "Admin",
        "ადმინი"
    ],
    "OWNER": [
        "Owner",
        "მფლობელი"
    ],
    "COACH": [
        "Coach",
        "მწვრთნელი"
    ],
    "CUSTOM": [
        "Custom",
        "საკუთარი"
    ],
    "CLUB_SECRETARY": [
        "Club secretary",
        "კლუბის მდივანი"
    ],
    "MEDIA_OFFICER": [
        "Media officer",
        "მედიაზე პასუხისმგებელი"
    ],
    "COMMERCIAL": [
        "Commercial and sponsorship",
        "კომერცია და სპონსორობა"
    ],
    "FACILITIES_COORDINATOR": [
        "Facilities coordinator",
        "ინფრასტრუქტურის კოორდინატორი"
    ],
    "HEAD_OF_COACHING": [
        "Head of coaching",
        "სამწვრთნელო მიმართულების ხელმძღვანელი"
    ],
    "SPECIALIST_COACH": [
        "Specialist coach",
        "სპეციალიზებული მწვრთნელი"
    ],
    "EQUIPMENT_MANAGER": [
        "Equipment manager",
        "ინვენტარის მენეჯერი"
    ],
    "TRAVEL_COORDINATOR": [
        "Travel coordinator",
        "მგზავრობის კოორდინატორი"
    ],
    "ANALYST": [
        "Analyst",
        "ანალიტიკოსი"
    ],
    "SPORTS_SCIENTIST": [
        "Sports scientist",
        "სპორტის მეცნიერი"
    ],
    "PHYSIOTHERAPIST": [
        "Physio",
        "ფიზიოთერაპევტი"
    ],
    "MEDICAL_PROFESSIONAL": [
        "Doctor",
        "ექიმი"
    ],
    "REHABILITATION_COACH": [
        "Rehabilitation coach",
        "რეაბილიტაციის მწვრთნელი"
    ],
    "NUTRITIONIST": [
        "Nutritionist",
        "ნუტრიციოლოგი"
    ],
    "PSYCHOLOGIST": [
        "Psychologist",
        "ფსიქოლოგი"
    ],
    "EDUCATION_OFFICER": [
        "Education officer",
        "განათლებაზე პასუხისმგებელი"
    ],
    "SCOUT": [
        "Scout",
        "სკაუტი"
    ],
    "WELFARE_OFFICER": [
        "Welfare officer",
        "კეთილდღეობაზე პასუხისმგებელი"
    ],
    "REFEREE": [
        "Club referee",
        "კლუბის მსაჯი"
    ],
    "GOALKEEPER_COACH": [
        "Goalkeeper coach",
        "მეკარეების მწვრთნელი"
    ],
    "STRENGTH_CONDITIONING": [
        "Gym & conditioning coach",
        "ფიზმომზადების მწვრთნელი"
    ],
    "CONDITIONING_COACH": [
        "Conditioning coach",
        "ფიზმომზადების მწვრთნელი"
    ],
    "TECHNICAL_COACH": [
        "Technical coach",
        "ტექნიკის მწვრთნელი"
    ],
    "TACTICAL_COACH": [
        "Tactical coach",
        "ტაქტიკის მწვრთნელი"
    ],
    "SET_PIECE_COACH": [
        "Set-piece coach",
        "სტანდარტული სიტუაციების მწვრთნელი"
    ],
    "PERFORMANCE_ANALYST": [
        "Performance analyst",
        "შესრულების ანალიტიკოსი"
    ],
    "OPPOSITION_ANALYST": [
        "Opposition analyst",
        "მეტოქის ანალიტიკოსი"
    ],
    "VIDEO_ANALYST": [
        "Video analyst",
        "ვიდეოანალიტიკოსი"
    ],
    "FINANCE_OFFICER": [
        "Fees",
        "გადასახადები"
    ],
    "CLUB": [
        "Running the club",
        "კლუბის მართვა"
    ],
    "COACHING": [
        "Coaching",
        "წვრთნა"
    ],
    "MATCHDAY": [
        "Matchday and logistics",
        "მატჩის დღე და ლოგისტიკა"
    ],
    "PERFORMANCE": [
        "Performance and health",
        "შესრულება და ჯანმრთელობა"
    ],
    "SCOUTING": [
        "Finding players",
        "მოთამაშეების მოძიება"
    ],
    "SAFETY": [
        "Safety",
        "უსაფრთხოება"
    ],
    "ELSEWHERE": [
        "Elsewhere",
        "სხვაგან"
    ],
    "CLUB_OFFICE": [
        "Club office",
        "კლუბის ოფისი"
    ],
    "MY_SQUADS": [
        "My squads",
        "ჩემი გუნდები"
    ],
    "PLAYER_FILE": [
        "Player file",
        "მოთამაშის საქმე"
    ],
    "SAFEGUARDING": [
        "Safeguarding",
        "დაცვა და უსაფრთხოება"
    ],
    "REGISTRATION": [
        "Registration",
        "რეგისტრაცია"
    ],
    "MONEY": [
        "Money",
        "ფინანსები"
    ],
    "PROJECTS": [
        "Projects",
        "პროექტები"
    ],
    "MEDIA": [
        "Media",
        "მედია"
    ],
    "TRAVEL": [
        "Travel",
        "მგზავრობა"
    ],
    "MY_MATCHES": [
        "My matches",
        "ჩემი მატჩები"
    ],
    "SHARED": [
        "Shared",
        "საერთო"
    ],
    "ALL_SQUADS": [
        "All squads",
        "ყველა გუნდი"
    ],
    "GROUP": [
        "Their group",
        "საკუთარი ჯგუფი"
    ],
    "KIT": [
        "Kit",
        "ეკიპირება"
    ],
    "BODY": [
        "Body",
        "სხეული"
    ],
    "LIFE": [
        "Life",
        "ცხოვრება"
    ]
};

export const HOME_WORDS: Record<string, readonly [string, string]> = { ...JOB_WORDS, SCOUTING: ['Scouting', 'სკაუტინგი'] };
export const VIEW_WORDS: Record<string, readonly [string, string]> = { ...JOB_WORDS, PERFORMANCE: ['Performance', 'შესრულება'], MATCHDAY: ['Matchday', 'მატჩის დღე'] };

/** How jobs, where they apply and their state read, in the app's language. */
export function useJobWords(choices: JobChoice[] = []) {
    const copy = useJourneyCopy();
    const jobName = useCallback((key: string, fallback?: string) => JOB_WORDS[key] ? copy(...JOB_WORDS[key]) : choices.find(c => c.key === key)?.title ?? fallback ?? key, [copy, choices]);
    const titleName = useCallback((title: string) => {
        const word = Object.values(JOB_WORDS).find(([en]) => en === title);
        return word ? copy(...word) : title;
    }, [copy]);
    const jobLabel = useCallback((job: Pick<PersonJob, 'job' | 'title'>) => {
        if (job.job === 'CUSTOM') return job.title;
        const defaultTitle = JOB_WORDS[job.job]?.[0] ?? choices.find(c => c.key === job.job)?.title;
        if (job.title && job.title !== defaultTitle && !(job.job === 'FEES' && job.title === 'Finance officer')) return titleName(job.title);
        return jobName(job.job, job.title);
    }, [jobName, titleName, choices]);
    const whereLabel = useCallback((job: Pick<PersonJob, 'clubWide' | 'squads'>) => job.clubWide ? copy('Whole club', 'მთელი კლუბი') : job.squads.map(s => s.name).join(', '), [copy]);
    const statusLabel = useCallback((status: JobStatus) => ({
        ACTIVE: null, INVITED: copy('Invited', 'მოწვეული'), SUGGESTED: copy('Suggested', 'შეთავაზებული'), UPCOMING: copy('Starts later', 'მოგვიანებით იწყება'),
        EXPIRED: copy('Invite expired', 'მოწვევის ვადა გავიდა'), UNAVAILABLE: copy('Can’t start', 'ვერ დაიწყება'),
    })[status], [copy]);
    const eventLabel = useCallback((action: string) => ({
        GIVEN: copy('Given', 'მიეცა'), SUGGESTED: copy('Suggested', 'შეთავაზდა'), CONFIRMED: copy('Confirmed', 'დადასტურდა'), DECLINED: copy('Declined', 'უარყოფილია'),
        ACCEPTED: copy('Accepted', 'მიიღო'), CHANGED: copy('Changed', 'შეიცვალა'), JOINED_BY_LINK: copy('Joined through a staff link', 'შემოვიდა პერსონალის ბმულით'), ENDED: copy('Ended', 'დასრულდა'),
    } as Record<string, string>)[action] ?? action, [copy]);
    const homeName = (key: string) => HOME_WORDS[key] ? copy(...HOME_WORDS[key]) : key;
    const viewName = (key: string) => VIEW_WORDS[key] ? copy(...VIEW_WORDS[key]) : key;
    return { copy, jobName, homeName, viewName, titleName, jobLabel, whereLabel, statusLabel, eventLabel };
}
