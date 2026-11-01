import type { ChildClub, JoiningChild } from '../api';
import { parentName } from '../../world/finder/waysIn';

/** A club the child plays for now: a player there, on trial, or enrolled through its joining. */
export const PLAYING = ['ACTIVE', 'TRIALIST', 'ENROLLED'];

/** The clubs the child plays for, each once (the server may list a club as a player and as enrolled). */
export function playingClubs(child: JoiningChild): ChildClub[] {
    const seen = new Map<number, ChildClub>();
    for (const club of child.clubs) if (PLAYING.includes(club.affiliationStatus ?? '') && !seen.has(club.clubId)) seen.set(club.clubId, club);
    return [...seen.values()];
}

export const firstName = (child: Pick<JoiningChild, 'identity'>) => child.identity.fullName.trim().split(/\s+/)[0] ?? '';

/** The year the child was born, which is how parents read groups ("Born 2017"); null when not recorded. */
export const birthYear = (child: Pick<JoiningChild, 'identity'>) => child.identity.dateOfBirth ? Number(child.identity.dateOfBirth.slice(0, 4)) : null;

/** One thing that truly waits on the parent. `tone`: red for urgent, amber to decide. */
export interface WaitingItem { key: string; tone: 'urgent' | 'decide'; text: string; detail: string; to: string; action: string }

type Copy = (en: string, ka: string) => string;

/**
 * What waits on the parent for one child, from the children payload alone: a consent the law asks for, a teen account
 * waiting for approval, a place a club offered, and a payment the club recorded as due within a week or overdue. Updates
 * to read are added by the page that loads them.
 */
export function childWaiting(child: JoiningChild, copy: Copy, today = new Date()): WaitingItem[] {
    const first = firstName(child), items: WaitingItem[] = [];
    const page = `/parent?player=${child.playerId}`;
    for (const club of child.clubs.filter(c => c.consentStatus === 'PENDING'))
        items.push({ key: `consent-${club.clubId}`, tone: 'urgent', text: copy(`${club.clubName} asks for your consent`, `${club.clubName} თქვენს თანხმობას ითხოვს`), detail: first, to: `/parent?tab=connections&player=${child.playerId}`, action: copy('Review', 'ნახვა') });
    if (child.parentApproval?.status === 'WAITING')
        items.push({ key: 'approval', tone: 'urgent', text: copy(`${first}’s account waits for you`, `${first}-ს ანგარიში თქვენს დადასტურებას ელოდება`), detail: copy('Approve or decline', 'დაადასტურეთ ან უარყავით'), to: `${page}&details=1`, action: copy('Open', 'გახსნა') });
    for (const c of child.cases.filter(item => item.offer?.status === 'PENDING'))
        items.push({ key: `offer-${c.id}`, tone: 'decide', text: copy(`${c.organizationName} offered ${first} a place`, `${c.organizationName} ${first}-ს ადგილს სთავაზობს`), detail: parentName(c.groupName) ?? c.groupName, to: `/admissions/cases/${c.id}?player=${child.playerId}`, action: copy('Answer', 'პასუხი') });
    const soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString().slice(0, 10);
    for (const club of playingClubs(child)) {
        const fees = club.fees;
        if (!fees || !fees.dueDate || fees.amount == null || (fees.status !== 'OVERDUE' && fees.dueDate > soon)) continue;
        items.push({ key: `fee-${club.clubId}`, tone: fees.status === 'OVERDUE' ? 'urgent' : 'decide', text: fees.status === 'OVERDUE' ? copy(`${club.clubName}: a payment is overdue`, `${club.clubName}: გადასახადის ვადა გავიდა`) : copy(`${club.clubName}: a payment is due`, `${club.clubName}: გადასახადი ახლოვდება`),
            detail: first, to: page, action: copy('See', 'ნახვა') });
    }
    return items;
}
