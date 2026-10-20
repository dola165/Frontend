import { extractApiErrorMessage } from '../../utils/apiError';
import { appLanguage } from '../../utils/formatting';
import type { useRoleProfiles } from '../profiles/account/useRoleProfiles';
import type { FootballRole, RoleProfile } from '../roles/domain';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Place } from './startApi';
import { aboutChanges, type AboutDraft, type SetupProfile } from './useSetupProfile';

/** Every football role, in the order people think of them, with one plain sentence each. */
export const SETUP_ROLES: { role: FootballRole; en: [string, string]; ka: [string, string] }[] = [
    { role: 'PLAYER', en: ['Player', 'You play, at any level.'], ka: ['მოთამაშე', 'თამაშობთ, ნებისმიერ დონეზე.'] },
    { role: 'COACH', en: ['Coach', 'You train a team or squad.'], ka: ['მწვრთნელი', 'წვრთნით გუნდს ან ჯგუფს.'] },
    { role: 'CLUB_STAFF', en: ['Club or academy staff', 'You work or volunteer at a club: management, admin, medical, kit and more.'], ka: ['კლუბის ან აკადემიის თანამშრომელი', 'მუშაობთ ან მოხალისეობთ კლუბში: მართვა, ადმინისტრაცია, მედიცინა, ეკიპირება და სხვა.'] },
    { role: 'PARENT', en: ['Parent or guardian', 'Your child plays football.'], ka: ['მშობელი ან მეურვე', 'თქვენი შვილი ფეხბურთს თამაშობს.'] },
    { role: 'REFEREE', en: ['Referee', 'You officiate matches.'], ka: ['მსაჯი', 'მსაჯობთ მატჩებს.'] },
    { role: 'ORGANIZER', en: ['Tournament organiser', 'You run tournaments or events.'], ka: ['ტურნირის ორგანიზატორი', 'აწყობთ ტურნირებს ან ღონისძიებებს.'] },
    { role: 'VENUE_MANAGER', en: ['Venue manager', 'You run pitches or facilities.'], ka: ['მოედნის მმართველი', 'მართავთ მოედნებს ან ინფრასტრუქტურას.'] },
    { role: 'AGENT', en: ['Agent', 'You represent players.'], ka: ['აგენტი', 'წარმოადგენთ მოთამაშეებს.'] },
    { role: 'FAN', en: ['Fan', 'You follow clubs and players.'], ka: ['გულშემატკივარი', 'ადევნებთ თვალს კლუბებსა და მოთამაშეებს.'] },
];

/** A role's name as the setup says it. */
export function useRoleName() {
    const copy = useJourneyCopy();
    return (role: string) => {
        const item = SETUP_ROLES.find(entry => entry.role === role);
        return item ? copy(item.en[0], item.ka[0]) : role;
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

/** "Coach · Tbilisi": the main role and the person's town, a headline they can keep or change. */
export function useSuggestedHeadline(roles: RoleProfile[], place: Place | null) {
    const roleName = useRoleName();
    const main = roles.find(item => item.primary) ?? roles[0];
    const town = place?.source === 'SAVED' ? place.name : null;
    return [main ? roleName(main.role) : null, town].filter(Boolean).join(' · ');
}

/** Saves what the draft changed: details, then the role lines. Resolves to an error message, or '' when all is kept. */
export async function saveAbout(draft: AboutDraft, setup: SetupProfile, roles: ReturnType<typeof useRoleProfiles>, failure: string) {
    if (!setup.profile) return '';
    const changes = aboutChanges(draft, setup.profile, roles.profiles);
    try {
        await setup.saveProfile(changes.details);
        if (changes.roles && !(await roles.save(changes.roles))) return failure;
        return '';
    } catch (reason) { return extractApiErrorMessage(reason, failure); }
}

