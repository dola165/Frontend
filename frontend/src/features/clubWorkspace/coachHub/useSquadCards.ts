import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import * as squadApi from '../../squadCommunication/api';
import { nextMatch, waitingApplications, type MatchCard, type WaitingApplication } from './squadApi';

/** The server's "not yours" (refused, or nothing there for this person): never shown as a failure. */
const refused = (error: unknown) => isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);

/**
 * Each squad's next match card; a squad whose card the server refused has none (`null`), never an invented one, and a
 * squad whose card failed to load is in `failed`, so the page says so and tries again. While a change reloads them the
 * earlier cards stay, so a notice on a card (Remind) survives the reload.
 */
export function useMatchCards(squadIds: number[], revision: number) {
    const scope = squadIds.join(',');
    const [attempt, setAttempt] = useState(0);
    const key = `${scope}:${revision}:${attempt}`;
    const [state, setState] = useState<{ scope: string; cards: Map<number, MatchCard | null>; failed: number[] } | null>(null);
    useEffect(() => {
        const controller = new AbortController(), ids = scope.split(',').filter(Boolean).map(Number);
        void Promise.all(ids.map(id => nextMatch(id, controller.signal).then(card => [id, card] as const, error => [id, refused(error) ? null : undefined] as const)))
            .then(entries => {
                if (controller.signal.aborted) return;
                setState({ scope, cards: new Map(entries.map(([id, card]) => [id, card ?? null])), failed: entries.filter(([, card]) => card === undefined).map(([id]) => id) });
            });
        return () => controller.abort();
    }, [scope, key]);
    const refresh = useCallback(() => setAttempt(value => value + 1), []);
    const current = state?.scope === scope ? state : null;
    return { cards: current?.cards ?? null, failed: current?.failed ?? [], refresh };
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
    createdAt: r.createdAt, source: r.source === 'LINK' ? 'LINK' : 'ENQUIRY', state: r.answeredAt ? 'ANSWERED' : 'DECIDE', answeredBy: r.answeredBy ?? null, request: r,
});

/**
 * Want to join, one list for the squads shown, newest first, with those answered lately and who answered them. Only
 * those who decide get anything: the server answers the others with an empty list or a refusal, which is taken as
 * "not yours", not as an error; any other failure is `failed`. Applications without a squad are in the all-squads list
 * only. While a change reloads the list the earlier items stay, so the notice after an answer survives.
 */
export function useWantToJoin(clubId: number, squadIds: number[], all: boolean, revision: number) {
    const scope = `${clubId}|${squadIds.join(',')}|${all}`;
    const [attempt, setAttempt] = useState(0);
    const key = `${scope}|${revision}|${attempt}`;
    const [state, setState] = useState<{ scope: string; items: WantToJoinItem[]; failed: boolean } | null>(null);
    useEffect(() => {
        const controller = new AbortController(), [club, list, everything] = scope.split('|'), ids = list.split(',').filter(Boolean).map(Number);
        let failed = false;
        const quietly = <T,>(load: Promise<T[]>) => load.catch(error => { if (!refused(error)) failed = true; return [] as T[]; });
        void Promise.all([
            quietly(waitingApplications(Number(club), null, controller.signal)),
            ...ids.map(id => quietly(squadApi.joinRequests(id, controller.signal, true)).then(rows => rows.map(row => requestItem(id, row)))),
        ]).then(([applications, ...requests]) => {
            if (controller.signal.aborted) return;
            const shown = (applications as WaitingApplication[]).filter(a => a.squadId === null ? everything === 'true' : ids.includes(a.squadId)).map(applicationItem);
            const items = [...shown, ...(requests as WantToJoinItem[][]).flat()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            setState({ scope, items, failed });
        });
        return () => controller.abort();
    }, [scope, key]);
    const refresh = useCallback(() => setAttempt(value => value + 1), []);
    const current = state?.scope === scope ? state : null;
    return { items: current?.items ?? null, failed: current?.failed ?? false, refresh };
}
