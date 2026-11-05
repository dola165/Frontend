import { Banknote, Handshake, Hammer, ShoppingCart, type LucideIcon } from 'lucide-react';
import { day, shortDate, type Copy } from '../../components/work/workWords';
import type { Money, ProjectKind, ProjectStatus, ProjectSummary } from './api';

/** The Projects page's places, in the address as `place`. Calendar and Staff open Club office. */
export type ProjectsPlace = 'projects' | 'ideas' | 'done';
export const PROJECTS_PLACES: ProjectsPlace[] = ['projects', 'ideas', 'done'];

/** The page, for one club, at one place; extra keeps a dialog's choices (`new`, `squad`) in the address. */
export const projectsPath = (clubId: number | null, place: ProjectsPlace = 'projects', extra: Record<string, string> = {}) => {
    const query = new URLSearchParams({ ...(clubId ? { club: String(clubId) } : {}), ...(place === 'projects' ? {} : { place }), ...extra }).toString();
    return `/projects${query ? `?${query}` : ''}`;
};
export const projectPath = (id: number) => `/projects/${id}`;

/** The place a project sits in. */
export const placeOf = (status: ProjectStatus): ProjectsPlace => status === 'IDEA' ? 'ideas' : status === 'DONE' ? 'done' : 'projects';

/** The four kinds a new project starts from; each only fills in the first steps. */
export const KINDS: { kind: ProjectKind; icon: LucideIcon; name: [string, string]; line: [string, string]; steps: [string, string][] }[] = [
    { kind: 'RAISE_MONEY', icon: Banknote, name: ['Raise money', 'თანხის შეგროვება'], line: ['For kit, a trip, a pitch', 'ფორმისთვის, მოგზაურობისთვის, მოედნისთვის'],
        steps: [['Target', 'მიზანი'], ['Fundraiser', 'შეგროვება'], ['Thank givers', 'მადლობა']] },
    { kind: 'BUY_SOMETHING', icon: ShoppingCart, name: ['Buy something', 'რაიმეს ყიდვა'], line: ['Kit, balls, goals, a minibus', 'ფორმა, ბურთები, კარები, მიკროავტობუსი'],
        steps: [['Quotes', 'ფასები'], ['Choose', 'არჩევა'], ['Pay', 'გადახდა'], ['Hand out', 'დარიგება']] },
    { kind: 'FIND_SPONSOR', icon: Handshake, name: ['Find a sponsor', 'სპონსორის მოძებნა'], line: ['A business backs the club', 'კომპანია კლუბს უჭერს მხარს'],
        steps: [['Contact', 'კონტაქტი'], ['Offer', 'შეთავაზება'], ['Agree', 'შეთანხმება'], ['Logo on page', 'ლოგო გვერდზე']] },
    { kind: 'FIX_OR_BUILD', icon: Hammer, name: ['Fix or build', 'შეკეთება ან აშენება'], line: ['Pitch, lights, changing rooms', 'მოედანი, განათება, გასახდელები'],
        steps: [['Quotes', 'ფასები'], ['Book the work', 'სამუშაოს დაჯავშნა'], ['Check it', 'შემოწმება']] },
];
export const isKind = (value: string | null): value is ProjectKind => KINDS.some(kind => kind.kind === value);

export const statusWords: Record<ProjectStatus, [string, string]> = { NOW: ['Now', 'ახლა'], LATER: ['Later', 'მოგვიანებით'], IDEA: ['Idea', 'იდეა'], DONE: ['Done', 'დასრულდა'] };

/** An amount as people say it: "1,240 GEL"; cents only when there are any. */
export const amount = (value: number, currency: string) => {
    const whole = Number.isInteger(value);
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(value)} ${currency}`;
};
export const money = (value: Money) => amount(value.amount, value.currency);
export const dayWord = (copy: Copy, iso: string | null) => iso ? shortDate(copy, day(iso)) : null;

/** A project's one line under its goal: the money or the steps, then who is on it. */
export function summaryLine(copy: Copy, project: ProjectSummary) {
    const names = project.people.slice(0, 3).map(person => person.name.split(' ')[0]).join(', ');
    const work = project.progressFromMoney && project.target
        ? copy(`${amount(project.raised ?? 0, project.target.currency)} of ${money(project.target)}`, `${amount(project.raised ?? 0, project.target.currency)} / ${money(project.target)}`)
        : project.stepsTotal
            ? copy(`Step ${Math.min(project.stepsDone + 1, project.stepsTotal)} of ${project.stepsTotal}`, `ნაბიჯი ${Math.min(project.stepsDone + 1, project.stepsTotal)} / ${project.stepsTotal}`)
            : copy('No steps yet', 'ნაბიჯები ჯერ არ არის');
    return [project.status === 'DONE' ? null : work, project.nextStep && project.status !== 'DONE' ? project.nextStep : null, names || null].filter(Boolean).join(' · ');
}

/** A project's square: its squad's short name ("U12") when it has one, else the goal's initials. */
export const markOf = (project: ProjectSummary) => project.squad
    ? project.squad.name.split(/\s+/)[0].slice(0, 4)
    : project.goal.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('');
