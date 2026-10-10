import { Building2, CalendarDays, ClipboardCheck, FileCheck2, Flag, Goal, Handshake, HeartHandshake, Trophy, UserPlus, type LucideIcon } from 'lucide-react';

/** One icon per request family, shared by the Requests page and the header Inbox. */
export function requestIcon(family: string): LucideIcon {
    if (family.includes('TOURNAMENT')) return Trophy;
    if (family.includes('REFEREE') || family.includes('OFFICIAL')) return Flag;
    if (family.includes('FAMILY') || family.includes('GUARDIAN') || family.includes('CONSENT')) return HeartHandshake;
    if (family.includes('BOOKING') || family.includes('VENUE')) return CalendarDays;
    if (family.includes('REPRESENTATION') || family.includes('APPROACH')) return Handshake;
    if (family.includes('MATCH')) return Goal;
    if (family.includes('TRYOUT') || family.includes('APPLICATION')) return ClipboardCheck;
    if (family.includes('INVIT')) return UserPlus;
    if (family.includes('CLUB') || family.includes('STAFF')) return Building2;
    return FileCheck2;
}
