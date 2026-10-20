import { appLanguage } from '../../utils/formatting';
import type { PageKind } from '../pages/model/kinds';
import type { FootballRole } from '../roles/domain';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Place } from './startApi';

/** What a chip of "What do you do?" belongs to: a football role's section, or the business answer. */
export type ChipOwner = FootballRole | 'BUSINESS';
type Words = [en: string, ka: string];

/** The setup's choices in step 1, in the order people think of them, each with one plain line. */
export const SETUP_CHOICES: { id: ChipOwner; en: Words; ka: Words }[] = [
    { id: 'PLAYER', en: ['Player', 'You play, at any level.'], ka: ['მოთამაშე', 'თამაშობთ, ნებისმიერ დონეზე.'] },
    { id: 'COACH', en: ['Coach', 'You train a team or squad.'], ka: ['მწვრთნელი', 'წვრთნით გუნდს ან ჯგუფს.'] },
    { id: 'CLUB_STAFF', en: ['Club or academy staff', 'You work or volunteer at a club.'], ka: ['კლუბის ან აკადემიის თანამშრომელი', 'მუშაობთ ან მოხალისეობთ კლუბში.'] },
    { id: 'PARENT', en: ['Parent or guardian', 'Your child plays football.'], ka: ['მშობელი ან მეურვე', 'თქვენი შვილი ფეხბურთს თამაშობს.'] },
    { id: 'REFEREE', en: ['Referee', 'You officiate matches.'], ka: ['მსაჯი', 'მსაჯობთ მატჩებს.'] },
    { id: 'ORGANIZER', en: ['Tournament organiser', 'You run tournaments or events.'], ka: ['ტურნირის ორგანიზატორი', 'აწყობთ ტურნირებს ან ღონისძიებებს.'] },
    { id: 'VENUE_MANAGER', en: ['Venue manager', 'You run pitches or facilities.'], ka: ['მოედნის მმართველი', 'მართავთ მოედნებს ან ინფრასტრუქტურას.'] },
    { id: 'AGENT', en: ['Agent', 'You represent players.'], ka: ['აგენტი', 'წარმოადგენთ მოთამაშეებს.'] },
    { id: 'FAN', en: ['Fan', 'You follow clubs and players.'], ka: ['გულშემატკივარი', 'ადევნებთ თვალს კლუბებსა და მოთამაშეებს.'] },
    { id: 'BUSINESS', en: ['Business or sponsor', 'You run a business, brand or sponsor.'], ka: ['ბიზნესი ან სპონსორი', 'გაქვთ ბიზნესი, ბრენდი ან ხართ სპონსორი.'] },
];

/** Suggestions for "What do you do?", per choice. Parent and Fan have none. Plain football words, no titles of rank. */
export const SKILLS: Partial<Record<ChipOwner, Words[]>> = {
    COACH: [['Head coach', 'მთავარი მწვრთნელი'], ['Assistant coach', 'მწვრთნელის ასისტენტი'], ['Goalkeeper coach', 'მეკარეთა მწვრთნელი'], ['Fitness coach', 'ფიზიკური მომზადების მწვრთნელი'], ['Youth coach', 'ახალგაზრდული გუნდის მწვრთნელი'], ['Analyst', 'ანალიტიკოსი']],
    CLUB_STAFF: [['Academy director', 'აკადემიის დირექტორი'], ['Manager', 'მენეჯერი'], ['Administrator', 'ადმინისტრატორი'], ['Physio', 'ფიზიოთერაპევტი'], ['Doctor', 'ექიმი'], ['Kit manager', 'ეკიპირების მენეჯერი'], ['Scout', 'სკაუტი'], ['Media', 'მედია'], ['Volunteer', 'მოხალისე']],
    PLAYER: [['Goalkeeper', 'მეკარე'], ['Defender', 'მცველი'], ['Midfielder', 'ნახევარმცველი'], ['Forward', 'თავდამსხმელი']],
    REFEREE: [['Referee', 'მსაჯი'], ['Assistant referee', 'მსაჯის ასისტენტი'], ['Fourth official', 'მეოთხე მსაჯი']],
    ORGANIZER: [['Tournaments', 'ტურნირები'], ['Leagues', 'ლიგები'], ['Camps', 'ბანაკები']],
    VENUE_MANAGER: [['Pitch hire', 'მოედნის გაქირავება'], ['Indoor pitches', 'დახურული მოედნები'], ['Facility management', 'ინფრასტრუქტურის მართვა']],
    AGENT: [['Player representation', 'მოთამაშეების წარმომადგენლობა'], ['Transfers', 'ტრანსფერები']],
    BUSINESS: [['Sponsorship', 'სპონსორობა'], ['Kit and equipment', 'ეკიპირება და ინვენტარი'], ['Media', 'მედია'], ['Training services', 'სავარჯიშო მომსახურება']],
};
export const hasSkills = (owner: ChipOwner) => Boolean(SKILLS[owner]);

/** A choice's name as the setup says it. */
export function useChoiceName() {
    const copy = useJourneyCopy();
    return (id: string) => {
        const item = SETUP_CHOICES.find(entry => entry.id === id);
        return item ? copy(item.en[0], item.ka[0]) : id;
    };
}

/** The country in the app's language ("Armenia", "სომხეთი"), else as the server names it. */
export function countryOf(place: Place) {
    try {
        if (place.countryCode) return new Intl.DisplayNames([appLanguage()], { type: 'region' }).of(place.countryCode) ?? place.countryName ?? place.name;
    } catch { /* an engine without region names keeps the server's */ }
    return place.countryName ?? place.name;
}

/** "In" a country, in Georgian: "სომხეთი" → "სომხეთში"; a name in Latin letters (no Georgian names here) → "Armenia-ში". */
export const inGeorgian = (country: string) => /[ა-ჿ]$/.test(country) ? `${country.replace(/ი$/, '')}ში` : `${country}-ში`;

/**
 * The page kinds in the order that fits the person: a business first for a business, a club first for anyone in
 * football, a fan club first for a fan or an everyday member.
 */
export function pageOrder(roles: readonly FootballRole[], business: boolean): PageKind[] {
    if (business) return ['BUSINESS', 'CLUB', 'FAN_CLUB', 'PAGE'];
    if (roles.some(role => role !== 'FAN')) return ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE'];
    return ['FAN_CLUB', 'CLUB', 'BUSINESS', 'PAGE'];
}
