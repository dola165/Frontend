import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import * as squadApi from '../../squadCommunication/api';
import { nextMatch, waitingApplications, type MatchCard, type WaitingApplication } from './squadApi';

/** Each squad's next match card; a squad whose card could not be read has none (`null`), never an invented one. */
export function useMatchCards(squadIds: number[], revision: number) {
    const key = `${squadIds.join(',')}:${revision}`;
    const [state, setState] = useState<{ key: string; cards: Map<number, MatchCard | null> } | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController(), ids = key.split(':')[0].split(',').filter(Boolean).map(Number);
        void Promise.all(ids.map(id => nextMatch(id, controller.signal).then(card => [id, card] as const, () => [id, null] as const)))
            .then(entries => { if (!controller.signal.aborted) setState({ key, cards: new Map(entries) }); });
        return () => controller.abort();
    }, [key, attempt]);
    const refresh = useCallback(() => setAttempt(value => value + 1), []);
    return { cards: state?.key === key ? state.cards : null, refresh };
}

/**
 * Someone who wants to join, from any of the three doors (decision 2): an application from World or the club page, an
 * admission request, or a request through the squad's join code. `state`: still to decide, a trial offered, or answered
 * (by whom, when someone else answered first).
 */
export interface WantToJoinItem {
    key: string; kind: 'APPLICATION' | 'REQUEST'; id: number; squadId: number | null; name: string; age: number | null; position: string | null;
    createdAt: string; source: 'WORLD' | 'LINK' | 'ENQUIRY'; state: 'DECIDE' | 'TRIAL' | 'ANSWERED'; answeredBy: string | null;
    application?: WaitingApplication; request?: squadApi.SquadJoinRequest;
}

const applicationItem = (a: WaitingApplication): WantToJoinItem => ({
    key: `application-${a.id}`, kind: 'APPLICATION', id: a.id, squadId: a.squadId, name: a.applicantName, age: a.age, position: a.position, createdAt: a.createdAt, source: 'WORLD',
    state: a.status === 'PENDING' ? 'DECIDE' : a.status === 'OFFERED' ? 'TRIAL' : 'ANSWERED', answeredBy: a.answeredBy, application: a,
});
const requestItem = (squad: number, r: squadApi.SquadJoinRequest): WantToJoinItem => ({
    key: `request-${r.id}`, kind: 'REQUEST', id: r.id, squadId: squad, name: r.childName, age: r.birthYear ? new Date().getFullYear() - r.birthYear : null, position: null,
    createdAt: r.createdAt, source: r.source === 'LINK' ? 'LINK' : 'ENQUIRY', state: 'DECIDE', answeredBy: null, request: r,
});

/**
 * Want to join, one list for the squads shown, newest first. Only those who decide get anything: the server answers
 * the others with an empty list or a refusal, which is taken as "not yours", not as an error. Applications without a
 * squad are in the all-squads list only.
 */
export function useWantToJoin(clubId: number, squadIds: number[], all: boolean, revision: number) {
    const key = `${clubId}|${squadIds.join(',')}|${all}|${revision}`;
    const [state, setState] = useState<{ key: string; items: WantToJoinItem[]; failed: boolean } | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController(), ids = key.split('|')[1].split(',').filter(Boolean).map(Number);
        const refused = (error: unknown) => isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);
        let failed = false;
        const quietly = <T,>(load: Promise<T[]>) => load.catch(error => { if (!refused(error)) failed = true; return [] as T[]; });
        void Promise.all([
            quietly(waitingApplications(clubId, null, controller.signal)),
            ...ids.map(id => quietly(squadApi.joinRequests(id, controller.signal)).then(rows => rows.map(row => requestItem(id, row)))),
        ]).then(([applications, ...requests]) => {
            if (controller.signal.aborted) return;
            const shown = (applications as WaitingApplication[]).filter(a => a.squadId === null ? key.split('|')[2] === 'true' : ids.includes(a.squadId)).map(applicationItem);
            const items = [...shown, ...(requests as WantToJoinItem[][]).flat()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setState({ key, items, failed });
        });
        return () => controller.abort();
    }, [clubId, key, attempt]);
    const refresh = useCallback(() => setAttempt(value => value + 1), []);
    const current = state?.key === key ? state : null;
    return { items: current?.items ?? null, failed: current?.failed ?? false, refresh };
}
