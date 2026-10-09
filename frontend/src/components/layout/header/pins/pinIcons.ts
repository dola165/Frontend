import {
    Bookmark, BriefcaseBusiness, Building2, CalendarDays, ClipboardList, Flag, Globe2, Goal, HeartHandshake, LandPlot,
    LayoutGrid, MapPinned, Settings, Shield, ShieldCheck, ShoppingBag, Trophy, User, Users, UsersRound, type LucideIcon,
} from 'lucide-react';

/** Pins are stored as plain data, so their icons are named rather than referenced. */
export const pinIcons = {
    bookmark: Bookmark, briefcase: BriefcaseBusiness, building: Building2, calendar: CalendarDays, clipboard: ClipboardList,
    flag: Flag, world: Globe2, goal: Goal, family: HeartHandshake, venue: LandPlot, workspace: LayoutGrid, map: MapPinned,
    settings: Settings, club: Shield, admin: ShieldCheck, store: ShoppingBag, trophy: Trophy, person: User, squad: Users,
    people: UsersRound,
} satisfies Record<string, LucideIcon>;

export type PinIcon = keyof typeof pinIcons;

export const isPinIcon = (value: unknown): value is PinIcon => typeof value === 'string' && Object.hasOwn(pinIcons, value);
