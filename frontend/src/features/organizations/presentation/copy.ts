const en = {
    back: 'My organizations', club: 'Club workspace', edit: 'Edit profile', cancel: 'Cancel', save: 'Save profile', saving: 'Saving…',
    saved: 'Profile saved.', loading: 'Loading organization…', retry: 'Retry', notFound: 'Organization not found.',
    verified: 'Verified organization', notVerified: 'Organization not verified', published: 'Published profile', draft: 'Draft profile · visible to organization members',
    venue: 'Open venue workspace', tournament: 'Create a tournament', configure: 'Configure activities',
    publicVenue: 'View venue page', venueOrganizationHelp: 'This is the organization behind your venue. Edit its identity and contacts here; manage pitches, availability and bookings in the venue workspace.',
    restrictedTitle: 'Public promotion is restricted',
    restrictedBody: 'This profile remains private. Authorized operational workspaces remain available.',
    about: 'About', emptyAbout: 'An introduction has not been added yet.', emptyFocus: 'Details have not been added yet.',
    contact: 'Contact', noContact: 'Public contact details have not been added yet.', website: 'Visit website',
    editTitle: 'Edit organization profile', publish: 'Publish profile for GrassKickZ members to view', name: 'Organization name', address: 'Address', focus: 'Focus',
    description: 'About', publicEmail: 'Public email', publicPhone: 'Public phone', settings: 'Organization settings', settingsHelp: 'Manage enabled activities and the venue team without changing club identity.',
    kindVenue: 'Stadium & venue', kindTournament: 'Tournament organizer', kindMedia: 'Media organization', kindHealthcare: 'Healthcare organization', kindSponsor: 'Sponsor', kindOrganization: 'Organization',
};
const ka: typeof en = {
    back: 'ჩემი ორგანიზაციები', club: 'კლუბის სივრცე', edit: 'პროფილის რედაქტირება', cancel: 'გაუქმება', save: 'პროფილის შენახვა', saving: 'ინახება…',
    saved: 'პროფილი შენახულია.', loading: 'ორგანიზაცია იტვირთება…', retry: 'ხელახლა ცდა', notFound: 'ორგანიზაცია ვერ მოიძებნა.',
    verified: 'დადასტურებული ორგანიზაცია', notVerified: 'ორგანიზაცია არ არის დადასტურებული', published: 'გამოქვეყნებული პროფილი', draft: 'შიდა პროფილი · ხილულია ორგანიზაციის წევრებისთვის',
    venue: 'ობიექტის სამუშაო სივრცის გახსნა', tournament: 'ტურნირის შექმნა', configure: 'საქმიანობის მართვა',
    publicVenue: 'ობიექტის გვერდის ნახვა', venueOrganizationHelp: 'ეს თქვენი ობიექტის მმართველი ორგანიზაციაა. აქ შეცვალეთ მისი სახელი და საკონტაქტო ინფორმაცია; მოედნები, ხელმისაწვდომობა და ჯავშნები მართეთ ობიექტის სამუშაო სივრცეში.',
    restrictedTitle: 'საჯარო გავრცელება შეზღუდულია',
    restrictedBody: 'ეს პროფილი კერძოდ რჩება. უფლებამოსილი ოპერაციული სივრცეები ხელმისაწვდომია.',
    about: 'ორგანიზაციის შესახებ', emptyAbout: 'შესავალი ჯერ არ დამატებულა.', emptyFocus: 'დეტალები ჯერ არ დამატებულა.',
    contact: 'კონტაქტი', noContact: 'საჯარო საკონტაქტო დეტალები ჯერ არ დამატებულა.', website: 'ვებგვერდის გახსნა',
    editTitle: 'ორგანიზაციის პროფილის რედაქტირება', publish: 'პროფილის გამოქვეყნება GrassKickZ-ის წევრებისთვის', name: 'ორგანიზაციის სახელი', address: 'მისამართი', focus: 'ფოკუსი',
    description: 'შესახებ', publicEmail: 'საჯარო ელფოსტა', publicPhone: 'საჯარო ტელეფონი', settings: 'ორგანიზაციის პარამეტრები', settingsHelp: 'მართეთ ჩართული საქმიანობები და ობიექტის გუნდი კლუბის იდენტობის შეცვლის გარეშე.',
    kindVenue: 'სტადიონი და ობიექტი', kindTournament: 'ტურნირის ორგანიზატორი', kindMedia: 'მედია ორგანიზაცია', kindHealthcare: 'ჯანდაცვის ორგანიზაცია', kindSponsor: 'სპონსორი', kindOrganization: 'ორგანიზაცია',
};

export const organizationProfileCopy = (language?: string) => language?.toLowerCase().startsWith('ka') ? ka : en;
