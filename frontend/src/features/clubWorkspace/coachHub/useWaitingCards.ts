import { useEffect, useState } from 'react';
import { fetchWaitingCards, type WaitingCard } from '../../clubs/api';

export type Waiting = WaitingCard & { squad: number };

/** The cards made for the shown squads that wait for the family's yes; staff-only, never the public roster. */
export function useWaitingCards(clubId: number, squadIds: number[], revision: number) {
    const key = `${clubId}|${squadIds.join(',')}|${revision}`;
    const [state, setState] = useState<{ key: string; cards: Waiting[] } | null>(null);
    useEffect(() => {
        let live = true;
        const [club, ids] = key.split('|');
        void Promise.all(ids.split(',').filter(Boolean).map(Number).map(squad =>
            fetchWaitingCards(Number(club), squad).then(cards => cards.map(card => ({ ...card, squad }))).catch(() => [] as Waiting[])))
            .then(lists => { if (live) setState({ key, cards: lists.flat() }); });
        return () => { live = false; };
    }, [key]);
    return state?.key === key ? state.cards : [];
}
