import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClubJob } from './api';

const strings = {
    eyebrow: ['Football opportunities', 'საფეხბურთო შესაძლებლობები'],
    title: ['Find your place in the game', 'იპოვეთ თქვენი ადგილი ფეხბურთში'],
    clubTitle: ['Roles at {club}', 'როლები კლუბში: {club}'],
    subtitle: ['Explore paid jobs and volunteering opportunities. Review the role, then apply or contact the club.', 'იპოვეთ ანაზღაურებადი და მოხალისეობრივი ვაკანსიები. გაეცანით როლს და გაგზავნეთ განაცხადი ან დაუკავშირდით კლუბს.'],
    clubSubtitle: ['Paid, ongoing volunteer and flexible roles published by this club.', 'ამ კლუბის მიერ გამოქვეყნებული ანაზღაურებადი, მუდმივი მოხალისეობრივი და მოქნილი როლები.'],
    refresh: ['Refresh', 'განახლება'],
    refereeing: ['Refereeing', 'მსაჯობა'],
    refereeKicker: ['First path', 'პირველი გზა'],
    refereeBody: ['Manage your referee profile, availability, invitations and confirmed appointments.', 'მართეთ მსაჯის პროფილი, ხელმისაწვდომობა, მოწვევები და დადასტურებული დანიშვნები.'],
    refereeTruth: ['Appointments are invitation-based today. The club-role listings below do not accept referee applications.', 'ამ ეტაპზე დანიშვნა მოწვევით ხდება. ქვემოთ მოცემული კლუბის როლები მსაჯის განაცხადებს არ იღებს.'],
    refereeWorkspace: ['Open referee workspace', 'მსაჯის სამუშაო სივრცის გახსნა'],
    refereeDirectory: ['How clubs find referees', 'როგორ ეძებენ კლუბები მსაჯებს'],
    browseByIntent: ['Browse opportunities', 'ვაკანსიების დათვალიერება'],
    volunteerAction: ['Browse volunteering', 'მოხალისეობრივი როლები'],
    coaching: ['Coaching', 'მწვრთნელობა'],
    coachingBody: ['Explore coach openings published by clubs, from academy teams to first-team support.', 'ნახეთ კლუბების მიერ გამოქვეყნებული მწვრთნელის როლები — აკადემიიდან პირველი გუნდის მხარდაჭერამდე.'],
    coachingAction: ['Browse coaching roles', 'მწვრთნელის როლების ნახვა'],
    otherRoles: ['Club & matchday roles', 'კლუბისა და მატჩის დღის როლები'],
    otherRolesBody: ['Find football operations, medical, media, facilities and other club roles.', 'იპოვეთ ფეხბურთის ოპერაციების, სამედიცინო, მედიის, ინფრასტრუქტურისა და სხვა კლუბის როლები.'],
    otherRolesAction: ['Browse every club role', 'ყველა კლუბის როლის ნახვა'],
    engagementGuide: ['Know what you are joining', 'იცოდეთ, რას უერთდებით'],
    paid: ['Paid role', 'ანაზღაურებადი როლი'],
    paidBody: ['Compensation and terms are agreed with the club.', 'ანაზღაურება და პირობები კლუბთან თანხმდება.'],
    volunteer: ['Ongoing volunteer role', 'მუდმივი მოხალისეობრივი როლი'],
    volunteerBody: ['A continuing club responsibility, not a dated event shift.', 'კლუბში მიმდინარე პასუხისმგებლობა და არა კონკრეტული ღონისძიების ცვლა.'],
    flexible: ['Flexible', 'მოქნილი'],
    flexibleBody: ['The club is open to a paid or volunteer arrangement.', 'კლუბი განიხილავს ანაზღაურებად ან მოხალისეობრივ შეთანხმებას.'],
    eventShifts: ['Event shifts', 'ღონისძიების ცვლები'],
    eventShiftsBody: ['Dated event and tournament shifts are a separate preview feature and do not appear in these role results.', 'ღონისძიებისა და ტურნირის დათარიღებული ცვლები ცალკე საცდელი ფუნქციაა და ამ როლების შედეგებში არ ჩანს.'],
    eventShiftsUnavailable: ['Event-shift signup is not available yet.', 'ღონისძიების ცვლებზე რეგისტრაცია ჯერ არ არის ხელმისაწვდომი.'],
    comingLater: ['Coming later', 'მოგვიანებით'],
    openEventShifts: ['Preview event shifts', 'ღონისძიების ცვლების წინასწარი ნახვა'],
    localDemo: ['Local demo', 'ლოკალური დემო'],
    listings: ['Club role listings', 'კლუბის როლები'],
    listingsBody: ['Filter by football work, commitment and location.', 'გაფილტრეთ საფეხბურთო საქმიანობის, ვალდებულებისა და მდებარეობის მიხედვით.'],
    searchLabel: ['Search roles', 'როლების ძიება'],
    searchPlaceholder: ['Role title, club or skill', 'როლის სახელი, კლუბი ან უნარი'],
    sort: ['Sort roles', 'როლების დალაგება'],
    newest: ['Most recent', 'უახლესი'],
    oldest: ['Oldest first', 'ჯერ ძველი'],
    filters: ['Filters', 'ფილტრები'],
    hideFilters: ['Hide filters', 'ფილტრების დამალვა'],
    selectedFilters: ['Selected role filters', 'არჩეული როლის ფილტრები'],
    filterRoles: ['Filter roles', 'როლების გაფილტვრა'],
    resetFilters: ['Reset filters', 'ფილტრების განულება'],
    footballRole: ['Football role', 'საფეხბურთო როლი'],
    engagement: ['Payment & engagement', 'ანაზღაურება და ჩართულობა'],
    engagementFact: ['Engagement', 'ჩართულობა'],
    postingDate: ['Posting date', 'გამოქვეყნების თარიღი'],
    teamExperience: ['Team & experience', 'გუნდი და გამოცდილება'],
    ageGroup: ['Team age group', 'გუნდის ასაკობრივი ჯგუფი'],
    experience: ['Experience', 'გამოცდილება'],
    any: ['Any', 'ნებისმიერი'],
    clubLocation: ['Club location', 'კლუბის მდებარეობა'],
    country: ['Country', 'ქვეყანა'],
    allCountries: ['All countries', 'ყველა ქვეყანა'],
    city: ['City', 'ქალაქი'],
    allCities: ['All cities', 'ყველა ქალაქი'],
    chooseCountry: ['Choose a country first', 'ჯერ აირჩიეთ ქვეყანა'],
    club: ['Club', 'კლუბი'],
    allClubs: ['All clubs', 'ყველა კლუბი'],
    showRoles: ['Show roles', 'როლების ჩვენება'],
    loadingRoles: ['Loading roles…', 'როლები იტვირთება…'],
    loadError: ['Could not load roles. Please try again.', 'როლები ვერ ჩაიტვირთა. სცადეთ თავიდან.'],
    tryAgain: ['Try again', 'თავიდან ცდა'],
    roleCount: ['{count} role{suffix}', '{count} როლი'],
    noMatches: ['No roles match these filters', 'ამ ფილტრებს არცერთი როლი არ შეესაბამება'],
    noMatchesBody: ['Try a broader role, commitment or location.', 'სცადეთ უფრო ფართო როლი, ჩართულობა ან მდებარეობა.'],
    clearFilters: ['Clear search and filters', 'ძიებისა და ფილტრების გასუფთავება'],
    viewRole: ['View role', 'როლის ნახვა'],
    preview: ['Quick view', 'სწრაფი ნახვა'],
    closePreview: ['Close quick view', 'სწრაფი ნახვის დახურვა'],
    nextStep: ['Next step', 'შემდეგი ნაბიჯი'],
    noDescription: ['The club has not added a description yet.', 'კლუბს აღწერა ჯერ არ დაუმატებია.'],
    previous: ['Previous', 'წინა'],
    next: ['Next', 'შემდეგი'],
    pageOf: ['Page {page} of {pages}', 'გვერდი {page} / {pages}'],
    commitment: ['Commitment', 'ვალდებულება'],
    ongoingRole: ['Ongoing club role', 'კლუბის მუდმივი როლი'],
    applicationMethod: ['Application method', 'განაცხადის მეთოდი'],
    eligibility: ['Who it suits', 'ვისთვისაა'],
    roleFrom: ['Role from', 'როლი კლუბიდან'],
    aboutRole: ['About this role', 'ამ როლის შესახებ'],
    loadingRole: ['Loading role…', 'როლი იტვირთება…'],
    roleUnavailable: ['This role has closed, is unavailable, or could not be loaded.', 'ეს როლი დაიხურა, მიუწვდომელია ან ვერ ჩაიტვირთა.'],
    yourApplication: ['Your next step', 'თქვენი შემდეგი ნაბიჯი'],
    checkingApplication: ['Checking your application…', 'თქვენი განაცხადი მოწმდება…'],
    statusLoadError: ['Your application status could not load. Please retry.', 'თქვენი განაცხადის სტატუსი ვერ ჩაიტვირთა. სცადეთ თავიდან.'],
    retryStatus: ['Retry status', 'სტატუსის განახლება'],
    applicationPending: ['Application pending', 'განაცხადი მოლოდინშია'],
    applicationPendingBody: ['The club has received your application and will review it. You can withdraw it while it is pending.', 'კლუბმა თქვენი განაცხადი მიიღო და განიხილავს. მოლოდინის პერიოდში მისი გამოთხოვა შეგიძლიათ.'],
    withdrawApplication: ['Withdraw application', 'განაცხადის გამოთხოვა'],
    confirmWithdrawQuestion: ['Withdraw this application?', 'გამოითხოვოთ ეს განაცხადი?'],
    confirmWithdrawal: ['Confirm withdrawal', 'გამოთხოვის დადასტურება'],
    keepApplication: ['Keep application', 'განაცხადის დატოვება'],
    applicationAccepted: ['Application accepted', 'განაცხადი მიღებულია'],
    applicationAcceptedBody: ['The club has accepted your application. Acceptance may create the matching player or coach relationship. It does not grant club administration or any unrelated permissions.', 'კლუბმა თქვენი განაცხადი მიიღო. შესაძლოა შეიქმნას შესაბამისი მოთამაშის ან მწვრთნელის კავშირი, თუმცა კლუბის ადმინისტრირების ან სხვა უფლებები არ გაიცემა.'],
    acceptedNext: ['Contact the club to confirm responsibilities, start date and next steps.', 'დაუკავშირდით კლუბს პასუხისმგებლობების, დაწყების თარიღისა და შემდეგი ნაბიჯების დასადასტურებლად.'],
    previousApplication: ['Previous application: {status}.', 'წინა განაცხადი: {status}.'],
    signInToApply: ['Sign in to apply', 'განაცხადისთვის შედით ანგარიშზე'],
    applyTitle: ['Apply for this role', 'განაცხადი ამ როლზე'],
    applyTruth: ['This opening uses the club’s {role} application process. Sending this form starts a tracked application; it does not confirm the role or grant club access.', 'ეს ვაკანსია კლუბის {role} განაცხადის პროცესს იყენებს. ფორმის გაგზავნა ქმნის აღრიცხულ განაცხადს; როლი ან კლუბზე წვდომა ავტომატურად არ დასტურდება.'],
    messageToClub: ['Message to the club', 'შეტყობინება კლუბს'],
    messagePlaceholder: ['Introduce yourself and explain your interest.', 'წარადგინეთ თავი და აღწერეთ თქვენი ინტერესი.'],
    sendApplication: ['Send application', 'განაცხადის გაგზავნა'],
    sending: ['Sending…', 'იგზავნება…'],
    contactTitle: ['Contact the club about this role', 'დაუკავშირდით კლუბს ამ როლზე'],
    contactTruth: ['In-app applications currently support player and coach openings. Opening club contact details does not submit or track an application.', 'აპლიკაციაში განაცხადი ამჟამად მოთამაშისა და მწვრთნელის ვაკანსიებზეა მხარდაჭერილი. კლუბის საკონტაქტო ინფორმაციის გახსნა განაცხადს არ აგზავნის და არ აღრიცხავს.'],
    contactClub: ['Contact {club} about {role}', 'დაუკავშირდით {club}-ს როლზე: {role}'],
    lifecycle: ['What happens after you apply', 'რა ხდება განაცხადის შემდეგ'],
    lifecycleOne: ['You send a tracked application to the club.', 'კლუბს უგზავნით აღრიცხულ განაცხადს.'],
    lifecycleTwo: ['The club reviews it and accepts or declines it.', 'კლუბი განაცხადს განიხილავს და იღებს ან უარყოფს.'],
    lifecycleThree: ['Acceptance may create the matching player or coach relationship.', 'მიღებისას შეიძლება შეიქმნას შესაბამისი მოთამაშის ან მწვრთნელის კავშირი.'],
    lifecycleFour: ['Club administration and unrelated permissions are never granted automatically.', 'კლუბის ადმინისტრირება და სხვა უფლებები ავტომატურად არასოდეს გაიცემა.'],
    applicationSent: ['Application sent to the club. It is awaiting review.', 'განაცხადი კლუბს გაეგზავნა და განხილვას ელოდება.'],
    applicationSendError: ['Your application could not be sent. Your message is still here.', 'განაცხადი ვერ გაიგზავნა. თქვენი შეტყობინება შენარჩუნებულია.'],
    applicationWithdrawn: ['Application withdrawn.', 'განაცხადი გამოთხოვილია.'],
    withdrawalError: ['The application could not be withdrawn.', 'განაცხადის გამოთხოვა ვერ მოხერხდა.'],
    roleNotSpecified: ['Role not specified', 'როლი არ არის მითითებული'],
    locationNotSpecified: ['Location not specified', 'მდებარეობა არ არის მითითებული'],
    recentlyPosted: ['Recently posted', 'ახლახან გამოქვეყნდა'],
    postedToday: ['Posted today', 'დღეს გამოქვეყნდა'],
    postedYesterday: ['Posted yesterday', 'გუშინ გამოქვეყნდა'],
    postedDaysAgo: ['Posted {days} days ago', 'გამოქვეყნდა {days} დღის წინ'],
    inAppApplication: ['In-app application', 'განაცხადი აპლიკაციაში'],
    contactClubMethod: ['Contact the club', 'კლუბთან დაკავშირება'],
    sendForReview: ['Send an application for club review', 'გაუგზავნეთ განაცხადი კლუბს განსახილველად'],
    askHowToApply: ['Contact the club to ask how to apply', 'დაუკავშირდით კლუბს განაცხადის გზის გასაგებად'],
    allFootballRoles: ['All football roles', 'ყველა საფეხბურთო როლი'],
    coachingCategory: ['Coaching', 'მწვრთნელობა'],
    operationsCategory: ['Football operations', 'ფეხბურთის ოპერაციები'],
    administrationCategory: ['Administration', 'ადმინისტრაცია'],
    mediaCategory: ['Media & communications', 'მედია და კომუნიკაციები'],
    facilitiesCategory: ['Facilities & maintenance', 'ინფრასტრუქტურა და მოვლა'],
    medicalCategory: ['Medical & wellbeing', 'სამედიცინო და კეთილდღეობა'],
    matchdayCategory: ['Matchday staff', 'მატჩის დღის პერსონალი'],
    otherCategory: ['Other club roles', 'კლუბის სხვა როლები'],
    allEngagements: ['All engagement types', 'ჩართულობის ყველა ტიპი'],
    paidEngagement: ['Paid role', 'ანაზღაურებადი როლი'],
    volunteerEngagement: ['Ongoing volunteer role', 'მუდმივი მოხალისეობრივი როლი'],
    flexibleEngagement: ['Flexible: paid or volunteer', 'მოქნილი: ანაზღაურებადი ან მოხალისეობრივი'],
    unspecifiedEngagement: ['Engagement not specified', 'ჩართულობა არ არის მითითებული'],
    anyPostingDate: ['Any posting date', 'გამოქვეყნების ნებისმიერი თარიღი'],
    pastSevenDays: ['Past 7 days', 'ბოლო 7 დღე'],
    pastThirtyDays: ['Past 30 days', 'ბოლო 30 დღე'],
} as const;

export type JobsOpportunitiesCopyKey = keyof typeof strings;

const fill = (template: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce(
        (value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)),
        template,
    );

const categories: Record<string, JobsOpportunitiesCopyKey> = {
    ALL: 'allFootballRoles',
    COACHING: 'coachingCategory',
    FOOTBALL_OPERATIONS: 'operationsCategory',
    ADMINISTRATION: 'administrationCategory',
    MEDIA_COMMUNICATIONS: 'mediaCategory',
    FACILITIES: 'facilitiesCategory',
    MEDICAL: 'medicalCategory',
    MATCHDAY: 'matchdayCategory',
    OTHER: 'otherCategory',
};

const engagements: Record<string, JobsOpportunitiesCopyKey> = {
    ALL: 'allEngagements',
    PAID: 'paidEngagement',
    VOLUNTEER: 'volunteerEngagement',
    FLEXIBLE: 'flexibleEngagement',
    UNSPECIFIED: 'unspecifiedEngagement',
};

export function useJobsOpportunitiesCopy() {
    const { i18n } = useTranslation();
    const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') ? 'ka' : 'en';
    const index = language === 'ka' ? 1 : 0;
    const copy = useCallback((key: JobsOpportunitiesCopyKey, values?: Record<string, string | number>) =>
        fill(strings[key][index], values), [index]);
    const category = (value?: string | null) => copy(categories[value ?? 'OTHER'] ?? 'otherCategory');
    const engagement = (value?: string | null) => copy(engagements[value ?? 'UNSPECIFIED'] ?? 'unspecifiedEngagement');
    const supportsApplication = (job: Pick<ClubJob, 'requiredRole'>) =>
        job.requiredRole === 'PLAYER' || job.requiredRole === 'COACH';
    return {
        language,
        copy,
        category,
        engagement,
        applicationMethod: (job: Pick<ClubJob, 'requiredRole'>) =>
            copy(supportsApplication(job) ? 'inAppApplication' : 'contactClubMethod'),
        expectedNextStep: (job: Pick<ClubJob, 'requiredRole'>) =>
            copy(supportsApplication(job) ? 'sendForReview' : 'askHowToApply'),
        eligibility: (job: Pick<ClubJob, 'ageGroup' | 'level'>) => {
            const parts = [
                job.ageGroup ? `${copy('ageGroup')}: ${job.ageGroup}` : null,
                job.level && job.level !== 'ANY' ? `${copy('experience')}: ${job.level.toLowerCase()}` : null,
            ].filter(Boolean);
            return parts.length ? parts.join(' · ') : null;
        },
        location: (job: Pick<ClubJob, 'clubCityName' | 'clubCountryName'>) =>
            [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ') || copy('locationNotSpecified'),
        relativeDate: (value?: string | null) => {
            if (!value) return copy('recentlyPosted');
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return copy('recentlyPosted');
            const days = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000));
            if (days === 0) return copy('postedToday');
            if (days === 1) return copy('postedYesterday');
            return copy('postedDaysAgo', { days });
        },
        postedOption: (value: string) =>
            copy(value === '7D' ? 'pastSevenDays' : value === '30D' ? 'pastThirtyDays' : 'anyPostingDate'),
    };
}
