import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Participant } from '../admissions/types';
import { readSelectedPlayer, rememberSelectedPlayer } from '../parents/playerSelection';
import type { RememberedChoice } from './directory/types';
import { useWorldSession } from './worldSession';

/** Age in whole years on a day (today by default), from a YYYY-MM-DD birth date. */
export function ageOn(dateOfBirth: string | null | undefined, today = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth ?? '');
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
    return age >= 0 && age < 120 ? age : null;
}

/** The children a person acts for: participants who are minors. */
export const childrenOf = (participants: Participant[] | undefined) => (participants ?? []).filter(person => person.minor);

/**
 * The browser's memory of the child chosen on another World page (or in Parent Hub), for this
 * account session. It is a convenience: the server still decides who the person may act for.
 */
export function rememberedPlayer(userId: number | undefined, sessionId: string | null): RememberedChoice {
    return {
        read: () => readSelectedPlayer(userId, sessionId)?.toString(),
        write: value => rememberSelectedPlayer(userId, sessionId, Number(value) > 0 ? Number(value) : undefined),
    };
}

/**
 * The child a parent is searching for on this World page: the `player` in the address, else
 * the one chosen earlier in this session. Only the person's own children count.
 */
export function useWorldChild() {
    const { user, sessionId } = useAuth();
    const { participants } = useWorldSession();
    const [params] = useSearchParams();
    const children = useMemo(() => childrenOf(participants), [participants]);
    const remember = useMemo(() => rememberedPlayer(user?.id, sessionId), [user?.id, sessionId]);
    const requested = params.has('player') ? params.get('player') : remember.read();
    const child = children.find(person => String(person.id) === requested);
    return {
        children, child, isParent: children.length > 0, remember,
        /** A player is asked for but the person's children are still loading: searching now would ignore them. */
        pending: participants === undefined && Boolean(requested),
    };
}

/** "Nino" from "Nino Gelashvili": a parent's own child is named by first name. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
