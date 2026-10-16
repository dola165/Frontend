import { CircleUser, Earth, Heart, House, MessageSquare, Pin, Shield, Trophy, Users, type LucideIcon } from 'lucide-react';

/** One combined role state: what links the person has, never a chosen role. */
export interface Squad { id: string; name: string; club: string }
export interface Child { id: string; name: string; age: number; club: string | null; tone: string }
export interface Club { id: string; name: string; short: string; tone: string; staff: boolean }
export interface Person { name: string; initials: string; squads: Squad[]; children: Child[]; clubs: Club[] }

const dinamo: Club = { id: 'dinamo', name: 'FC Dinamo Tbilisi Academy', short: 'DTA', tone: '#2f6fe4', staff: true };
const saburtalo: Club = { id: 'saburtalo', name: 'Saburtalo Football School', short: 'SFS', tone: '#e0662f', staff: true };
const lika: Child = { id: 'lika', name: 'Lika', age: 11, club: 'FC Dinamo Tbilisi Academy', tone: '#c2417a' };
const nika: Child = { id: 'nika', name: 'Nika', age: 8, club: null, tone: '#3d9a6a' };

export const MIXES = {
    ordinary: { en: 'Ordinary', ka: 'ჩვეულებრივი', person: { name: 'Nino Beridze', initials: 'NB', squads: [], children: [], clubs: [] } },
    coach: { en: 'Coach', ka: 'მწვრთნელი', person: { name: 'Luka Gelashvili', initials: 'LG', squads: [{ id: 'u14', name: 'U14 Boys', club: dinamo.name }, { id: 'u16', name: 'U16 Boys', club: dinamo.name }], children: [], clubs: [dinamo] } },
    parent: { en: 'Parent', ka: 'მშობელი', person: { name: 'Tamar Kapanadze', initials: 'TK', squads: [], children: [lika], clubs: [] } },
    'coach-parent': { en: 'Coach + parent', ka: 'მწვრთნელი + მშობელი', person: { name: 'Luka Gelashvili', initials: 'LG', squads: [{ id: 'u14', name: 'U14 Boys', club: dinamo.name }, { id: 'u16', name: 'U16 Boys', club: dinamo.name }], children: [lika, nika], clubs: [dinamo] } },
    'multi-club': { en: 'Coach at two clubs', ka: 'მწვრთნელი ორ კლუბში', person: { name: 'Luka Gelashvili', initials: 'LG', squads: [{ id: 'u14', name: 'U14 Boys', club: dinamo.name }, { id: 'u16', name: 'U16 Boys', club: dinamo.name }, { id: 'u10', name: 'U10 Girls', club: saburtalo.name }], children: [], clubs: [dinamo, saburtalo] } },
} satisfies Record<string, { en: string; ka: string; person: Person }>;
export type MixId = keyof typeof MIXES;

export type ScreenId = 'home' | 'world' | 'my-squads' | 'my-club' | 'parent' | 'my-football' | 'messages' | 'pins' | 'you';
export interface Tab { id: ScreenId; label: string; icon: LucideIcon; badge?: number; sheet?: boolean }
/** What a layout puts in the top bar besides search, Dola, inbox and the avatar. */
export interface Layout { tabs: Tab[]; topPins: boolean; topMessages: boolean; clubInSquads: boolean }

export const ALTERNATIVES = {
    today: { en: 'Today', ka: 'დღეს', note: { en: 'Every role adds a tab. Pins and Messages always.', ka: 'ყოველი როლი ამატებს ჩანართს.' } },
    a: { en: 'A · Role tabs replace My Club', ka: 'A · როლის ჩანართი ჩემი კლუბის ნაცვლად', note: { en: 'My squads or Parent Hub take My Club’s place; My Club only when there is no role. Pins move to the top bar. The club is one tap from My squads.', ka: 'ჩემი გუნდები ან მშობლის სივრცე ცვლის ჩემს კლუბს; პინები ზედა ზოლში.' } },
    b: { en: 'B · One “My football” tab', ka: 'B · ერთი „ჩემი ფეხბურთი“', note: { en: 'One tab for everything you look after: squads, children and the club, switched at the top of the page. Always five tabs.', ka: 'ერთი ჩანართი: გუნდები, შვილები და კლუბი, გადამრთველით.' } },
    c: { en: 'C · Messages up top, “You” tab', ka: 'C · მიმოწერა ზემოთ, „თქვენ“', note: { en: 'Role tabs as in A; Messages becomes an icon in the top bar (badge kept); pins, My Club and settings live in a You tab.', ka: 'როლის ჩანართები როგორც A-ში; მიმოწერა ზემოთ; პინები „თქვენ“-ში.' } },
} as const;
export type AltId = keyof typeof ALTERNATIVES;

const copy = (ka: boolean) => (en: string, georgian: string) => ka ? georgian : en;

export function layoutFor(alt: AltId, person: Person, ka: boolean): Layout {
    const t = copy(ka);
    const home: Tab = { id: 'home', label: t('Home', 'მთავარი'), icon: House };
    const world: Tab = { id: 'world', label: t('World', 'მსოფლიო'), icon: Earth };
    const squads: Tab = { id: 'my-squads', label: t('My squads', 'ჩემი გუნდები'), icon: Users };
    const club: Tab = { id: 'my-club', label: t('My Club', 'ჩემი კლუბი'), icon: Shield };
    const parent: Tab = { id: 'parent', label: t('Parent Hub', 'მშობლის სივრცე'), icon: Heart };
    const messages: Tab = { id: 'messages', label: t('Messages', 'მიმოწერა'), icon: MessageSquare, badge: 3 };
    const pins: Tab = { id: 'pins', label: t('Pins', 'პინები'), icon: Pin, sheet: true };
    const coaching = person.squads.length > 0, parenting = person.children.length > 0;
    const roles = [...(coaching ? [squads] : []), ...(parenting ? [parent] : [])];
    if (alt === 'today') return { tabs: [home, world, ...(coaching ? [squads] : []), club, ...(parenting ? [parent] : []), messages, pins], topPins: false, topMessages: false, clubInSquads: false };
    if (alt === 'a') return { tabs: [home, world, ...(roles.length ? roles : [club]), messages], topPins: true, topMessages: false, clubInSquads: true };
    if (alt === 'b') return { tabs: [home, world, { id: 'my-football', label: t('My football', 'ჩემი ფეხბურთი'), icon: Trophy }, messages, pins], topPins: false, topMessages: false, clubInSquads: false };
    return { tabs: [home, world, ...(roles.length ? roles : [club]), { id: 'you', label: t('You', 'თქვენ'), icon: CircleUser }], topPins: false, topMessages: true, clubInSquads: true };
}

export const PINS = (ka: boolean) => {
    const t = copy(ka);
    return [t('Store', 'მაღაზია'), t('Jobs & volunteering', 'სამუშაო და მოხალისეობა'), t('U14 Boys calendar', 'U14 კალენდარი'), t('Tbilisi Community League', 'თბილისის ლიგა')];
};
