import type { CreatableOrganizationKind } from '../../tournaments/domain';
import type { TournamentSetupDraft } from '../../tournaments/setupDraft';

export interface OrganizationKindStarterCopy {
    kind: CreatableOrganizationKind;
    label: string;
    description: string;
    nextStep: string;
}

interface OrganizationOnboardingCopy {
    eyebrow: string;
    title: string;
    subtitle: string;
    venueTitle: string;
    venueSubtitle: string;
    tournamentTitle: string;
    tournamentSubtitle: string;
    back: string;
    backToStadiums: string;
    backToTournament: string;
    nameLabel: string;
    namePlaceholder: string;
    typeLabel: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    nextStepLabel: string;
    identityNotice: string;
    cancel: string;
    create: string;
    creating: string;
    createFailed: string;
    creationUnconfirmed: string;
    sessionChangedPending: string;
    sessionChangedAfterCreate: string;
    sessionChangedAfterError: string;
    myOrganizations: string;
    myOrganizationsHint: string;
    noOrganizations: string;
    organizationsLoadFailed: string;
    retryOrganizations: string;
    useForTournament: string;
    kinds: readonly OrganizationKindStarterCopy[];
}

const englishKinds: readonly OrganizationKindStarterCopy[] = [
    { kind: 'VENUE', label: 'Venue operator', description: 'Operate football grounds, pitches, or sports facilities.', nextStep: 'Your venue workspace opens next. Add pitches, set prices and availability, then publish the venue page when it is ready.' },
    { kind: 'TOURNAMENT_ORGANIZER', label: 'Tournament organizer', description: 'Run competitions and football events.', nextStep: 'Complete the organizer profile, then create or continue a tournament.' },
    { kind: 'SPORTS_ORG', label: 'Sports organization', description: 'Present a sports body, association, or academy operator.', nextStep: 'Complete the public profile. Clubs and squads remain separate football resources.' },
    { kind: 'COMPANY', label: 'Company', description: 'Represent a business working with the football community.', nextStep: 'Complete the public profile and contact details for enquiries.' },
    { kind: 'SPONSOR', label: 'Sponsor', description: 'Present a sponsor or brand partnership identity.', nextStep: 'Complete the public profile for partnership enquiries. Campaign tools are not included yet.' },
    { kind: 'MEDIA', label: 'Media organization', description: 'Represent a publisher, broadcaster, or coverage team.', nextStep: 'Complete the public profile and coverage contact details.' },
    { kind: 'HEALTHCARE', label: 'Healthcare organization', description: 'Present health, rehabilitation, or sports-medicine services.', nextStep: 'Complete the public profile and service contact details. This does not enable bookings or medical-record access.' },
    { kind: 'PARTNER', label: 'Partner organization', description: 'Represent another organization working with football communities.', nextStep: 'Complete the public profile and partnership contact details.' },
] as const;

const georgianKinds: readonly OrganizationKindStarterCopy[] = [
    { kind: 'VENUE', label: 'სპორტული ობიექტის ოპერატორი', description: 'მართეთ საფეხბურთო მოედნები ან სხვა სპორტული სივრცეები.', nextStep: 'შემდეგ გაიხსნება ობიექტის სამუშაო სივრცე. დაამატეთ მოედნები, ფასები და ხელმისაწვდომობა, შემდეგ კი გამოაქვეყნეთ ობიექტის გვერდი.' },
    { kind: 'TOURNAMENT_ORGANIZER', label: 'ტურნირის ორგანიზატორი', description: 'ჩაატარეთ შეჯიბრებები და საფეხბურთო ღონისძიებები.', nextStep: 'შეავსეთ ორგანიზატორის პროფილი, შემდეგ შექმენით ან გააგრძელეთ ტურნირი.' },
    { kind: 'SPORTS_ORG', label: 'სპორტული ორგანიზაცია', description: 'წარმოადგინეთ სპორტული გაერთიანება, ასოციაცია ან აკადემიის ოპერატორი.', nextStep: 'შეავსეთ საჯარო პროფილი. კლუბები და შემადგენლობები ცალკე საფეხბურთო რესურსებია.' },
    { kind: 'COMPANY', label: 'კომპანია', description: 'წარმოადგინეთ ფეხბურთის საზოგადოებასთან მომუშავე ბიზნესი.', nextStep: 'შეავსეთ საჯარო პროფილი და საკონტაქტო ინფორმაცია შეკითხვებისთვის.' },
    { kind: 'SPONSOR', label: 'სპონსორი', description: 'წარმოადგინეთ სპონსორი ან ბრენდის პარტნიორობა.', nextStep: 'შეავსეთ საჯარო პროფილი პარტნიორობის შეკითხვებისთვის. კამპანიების ხელსაწყოები ჯერ არ არის ხელმისაწვდომი.' },
    { kind: 'MEDIA', label: 'მედია ორგანიზაცია', description: 'წარმოადგინეთ გამომცემელი, მაუწყებელი ან გაშუქების გუნდი.', nextStep: 'შეავსეთ საჯარო პროფილი და გაშუქების საკონტაქტო ინფორმაცია.' },
    { kind: 'HEALTHCARE', label: 'ჯანდაცვის ორგანიზაცია', description: 'წარმოადგინეთ ჯანდაცვის, რეაბილიტაციის ან სპორტული მედიცინის სერვისები.', nextStep: 'შეავსეთ საჯარო პროფილი და სერვისების საკონტაქტო ინფორმაცია. ეს არ რთავს ჯავშნებს ან სამედიცინო ჩანაწერებზე წვდომას.' },
    { kind: 'PARTNER', label: 'პარტნიორი ორგანიზაცია', description: 'წარმოადგინეთ ფეხბურთის საზოგადოებასთან მომუშავე სხვა ორგანიზაცია.', nextStep: 'შეავსეთ საჯარო პროფილი და პარტნიორობის საკონტაქტო ინფორმაცია.' },
] as const;

const copy: Record<'en' | 'ka', OrganizationOnboardingCopy> = {
    en: {
        eyebrow: 'Organization onboarding',
        title: 'What will this organization do here?',
        subtitle: 'Create one organization identity and choose its starting purpose. A club is an organization with football operations; squads belong inside a club.',
        venueTitle: 'Create your venue organization',
        venueSubtitle: 'Start with the organization that runs your venue. Its workspace brings together your venue page, pitches, calendar and booking requests.',
        tournamentTitle: 'Add the organization running this tournament',
        tournamentSubtitle: 'Your tournament draft is safe. Create its organization, then return to the same setup with the new organizer selected.',
        back: 'Back',
        backToStadiums: 'Back to stadiums',
        backToTournament: 'Back to tournament setup',
        nameLabel: 'Organization Name',
        namePlaceholder: 'e.g. Tbilisi Community Sports',
        typeLabel: 'What will this organization do here?',
        descriptionLabel: 'Public Introduction (Optional)',
        descriptionPlaceholder: 'Briefly explain what the organization does.',
        nextStepLabel: 'After creation',
        identityNotice: 'This creates one organization identity and your owner membership. It does not create a second person account or automatically add club, squad, campaign, or healthcare modules.',
        cancel: 'Cancel',
        create: 'Create Organization',
        creating: 'Creating organization…',
        createFailed: 'Failed to create organization. Your details have been kept.',
        creationUnconfirmed: 'The result could not be confirmed. Check My organizations before creating another to avoid a duplicate.',
        sessionChangedPending: 'Your sign-in changed while the organization was being created. Please wait for the result before trying again.',
        sessionChangedAfterCreate: 'The organization was created, but your sign-in changed before it could be opened. Check My organizations in the correct account before creating another.',
        sessionChangedAfterError: 'Your sign-in changed while the request was in progress. Check My organizations in the correct account before trying again.',
        myOrganizations: 'My organizations',
        myOrganizationsHint: 'Open an organization you already manage instead of creating a duplicate.',
        noOrganizations: 'No organizations are linked to this account yet.',
        organizationsLoadFailed: 'Could not load your organizations.',
        retryOrganizations: 'Retry organizations',
        useForTournament: 'Use for this tournament',
        kinds: englishKinds,
    },
    ka: {
        eyebrow: 'ორგანიზაციის რეგისტრაცია',
        title: 'რას გააკეთებს ეს ორგანიზაცია აქ?',
        subtitle: 'შექმენით ერთი ორგანიზაციის იდენტობა და აირჩიეთ მისი საწყისი დანიშნულება. კლუბი საფეხბურთო ოპერაციების მქონე ორგანიზაციაა, ხოლო შემადგენლობები კლუბს ეკუთვნის.',
        venueTitle: 'შექმენით თქვენი ობიექტის ორგანიზაცია',
        venueSubtitle: 'დაიწყეთ ორგანიზაციით, რომელიც თქვენს ობიექტს მართავს. მის სამუშაო სივრცეში გაერთიანებულია ობიექტის გვერდი, მოედნები, კალენდარი და დაჯავშნის მოთხოვნები.',
        tournamentTitle: 'დაამატეთ ამ ტურნირის ორგანიზატორი',
        tournamentSubtitle: 'ტურნირის მონახაზი შენახულია. შექმენით ორგანიზაცია და იმავე ფორმას ახალი ორგანიზატორით დაუბრუნდებით.',
        back: 'უკან',
        backToStadiums: 'სტადიონებზე დაბრუნება',
        backToTournament: 'ტურნირის ფორმაზე დაბრუნება',
        nameLabel: 'ორგანიზაციის სახელი',
        namePlaceholder: 'მაგ. თბილისის სათემო სპორტი',
        typeLabel: 'რას გააკეთებს ეს ორგანიზაცია აქ?',
        descriptionLabel: 'საჯარო შესავალი (არასავალდებულო)',
        descriptionPlaceholder: 'მოკლედ აღწერეთ ორგანიზაციის საქმიანობა.',
        nextStepLabel: 'შექმნის შემდეგ',
        identityNotice: 'იქმნება ერთი ორგანიზაციის იდენტობა და თქვენი მფლობელის წევრობა. მეორე პირადი ანგარიში ან კლუბის, შემადგენლობის, კამპანიისა თუ ჯანდაცვის მოდული ავტომატურად არ იქმნება.',
        cancel: 'გაუქმება',
        create: 'ორგანიზაციის შექმნა',
        creating: 'ორგანიზაცია იქმნება…',
        createFailed: 'ორგანიზაციის შექმნა ვერ მოხერხდა. შევსებული ინფორმაცია შენახულია.',
        creationUnconfirmed: 'შედეგის დადასტურება ვერ მოხერხდა. დუბლიკატის თავიდან ასაცილებლად ახალი ორგანიზაციის შექმნამდე შეამოწმეთ „ჩემი ორგანიზაციები“.',
        sessionChangedPending: 'ორგანიზაციის შექმნისას ავტორიზაცია შეიცვალა. ხელახლა ცდამდე დაელოდეთ შედეგს.',
        sessionChangedAfterCreate: 'ორგანიზაცია შეიქმნა, მაგრამ გახსნამდე ავტორიზაცია შეიცვალა. დუბლიკატის შექმნამდე სწორ ანგარიშში შეამოწმეთ „ჩემი ორგანიზაციები“.',
        sessionChangedAfterError: 'მოთხოვნის მიმდინარეობისას ავტორიზაცია შეიცვალა. ხელახლა ცდამდე სწორ ანგარიშში შეამოწმეთ „ჩემი ორგანიზაციები“.',
        myOrganizations: 'ჩემი ორგანიზაციები',
        myOrganizationsHint: 'დუბლიკატის შექმნის ნაცვლად გახსენით ორგანიზაცია, რომელსაც უკვე მართავთ.',
        noOrganizations: 'ამ ანგარიშთან ორგანიზაცია ჯერ არ არის დაკავშირებული.',
        organizationsLoadFailed: 'ორგანიზაციების ჩატვირთვა ვერ მოხერხდა.',
        retryOrganizations: 'ორგანიზაციების ხელახლა ჩატვირთვა',
        useForTournament: 'ამ ტურნირისთვის გამოყენება',
        kinds: georgianKinds,
    },
};

const supportedKinds = new Set<CreatableOrganizationKind>(englishKinds.map(({ kind }) => kind));

export const getOrganizationOnboardingCopy = (language?: string): OrganizationOnboardingCopy =>
    copy[language?.toLowerCase().startsWith('ka') ? 'ka' : 'en'];

export const parseOrganizationKind = (value: string | null): CreatableOrganizationKind =>
    supportedKinds.has(value as CreatableOrganizationKind) ? value as CreatableOrganizationKind : 'SPORTS_ORG';

export const organizationDestination = (
    organizationId: number,
    kind: CreatableOrganizationKind,
    tournamentDraft: TournamentSetupDraft | null,
) => {
    if (tournamentDraft) {
        return {
            to: `/tournaments/setup?organizer=${organizationId}`,
            state: {
                tournamentSetupDraft: {
                    ...tournamentDraft,
                    organizerId: organizationId,
                    form: { ...tournamentDraft.form, hostClubId: '' },
                },
            },
        };
    }
    return {
        to: kind === 'VENUE' ? `/stadiums/${organizationId}/manage` : `/organizations/${organizationId}`,
        state: undefined,
    };
};
