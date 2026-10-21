import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { getAuthSessionId, getStoredAccessToken, getStoredUserId, subscribeAuthSession } from '../../../../utils/authStorage';
import type { Squad } from '../../../matchExchange/api';
import { ageGroupOf } from '../../../matchExchange/arrange/matchPlan';
import { requestEntry } from '../../../tournaments/api';
import { entryGate, type EntryGate } from '../../../tournaments/entryGates';
import type { TournamentDetail } from '../../../tournaments/domain';
import { zoned } from '../../scoreboard/standings';
import type { TournamentPaneData } from './tournamentPane';

interface Choice { clubId?: number | null; squadId?: number | null }
interface KnownEntry { tournamentId: number; clubId: number; squadId: number | null; entryId?: number; priorIds: number[] }
interface Command {
    token: symbol; pending: boolean; acknowledged: boolean; clubId: number; squadId: number;
    priorIds: number[]; notice: string; error: string; changed: boolean; failedRead?: TournamentDetail;
}
const ownerKey = () => {
    const session = getAuthSessionId(), user = getStoredUserId();
    return session && user && getStoredAccessToken(session) ? JSON.stringify([session, user]) : null;
};
let memory = { owner: ownerKey(), id: null as number | null, generation: Symbol(), choice: {} as Choice,
    commands: new Map<number, Command>(), known: [] as KnownEntry[] };
type Context = { data: TournamentPaneData; squads: Squad[] | undefined; gate: EntryGate };
let context: Context | null = null;
const listeners = new Set<() => void>();
const publish = (next = memory) => { memory = { ...next }; for (const listener of listeners) listener(); };
const retire = () => {
    const owner = ownerKey();
    if (owner === memory.owner) return;
    context = null;
    publish({ owner, id: null, generation: Symbol(), choice: {}, commands: new Map(), known: [] });
};
let watching = false;
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Unmounted choices and outstanding replies also belong to the retired login.
    if (!watching) { subscribeAuthSession(retire); watching = true; }
    retire();
    return () => { listeners.delete(listener); };
};
const snapshot = () => memory;
function useEntryOwner() {
    const { status, sessionId, user } = useAuth();
    const userId = user?.id;
    return useMemo(() => ({ status, sessionId, userId }), [status, sessionId, userId]);
}
const isOwner = (owner: string | null, auth: ReturnType<typeof useEntryOwner>) => Boolean(owner && ownerKey() === owner
    && memory.owner === owner && auth.status === 'authenticated' && auth.sessionId === getAuthSessionId()
    && String(auth.userId) === getStoredUserId());
const activate = (id: number) => {
    if (memory.id === id) return;
    context = null;
    // Only the unsent choice retires. Pending/confirmed facts still prevent a duplicate on returning.
    publish({ ...memory, id, generation: Symbol(), choice: {} });
};
const putCommand = (id: number, command: Command) => publish({ ...memory, commands: new Map(memory.commands).set(id, command) });
const clubsOf = (squads: Squad[] | undefined) => new Set((squads ?? []).map(squad => squad.club_id));
const recorded = (id: number) => memory.known.some(entry => entry.tournamentId === id && clubsOf(context?.squads).has(entry.clubId));
const time = (value?: string | null) => { const instant = zoned(value); return instant ? Date.parse(instant) : null; };
function currentGate(read: Context, userId: number, detail = read.data.detail) {
    return entryGate({ detail, squads: read.squads, invitation: read.data.invitation, canManage: read.data.canManage,
        signedIn: true, userId, time, now: Date.now() });
}
function receivedEntry(read: Context, userId: number, detail: TournamentDetail, receipt: Pick<KnownEntry, 'clubId' | 'squadId' | 'priorIds'>) {
    if (detail.id !== read.data.detail.id) return undefined;
    // The canonical gate can show another permitted club first. A receipt needs its own unique live row.
    const matches = detail.entries.filter(entry => entry.clubId === receipt.clubId && entry.squadId === receipt.squadId && !receipt.priorIds.includes(entry.id))
        .filter(entry => {
            const gate = currentGate(read, userId, { ...detail, entries: [entry] });
            return gate.kind === 'entered' || (gate.kind === 'answer' && gate.entered?.id === entry.id);
        });
    return matches.length === 1 ? matches[0] : undefined;
}
function selection(gate: Extract<EntryGate, { kind: 'enter' }>, age: string | undefined, choice = memory.choice) {
    const club = choice.clubId === undefined ? gate.clubs[0] : gate.clubs.find(item => item.id === choice.clubId);
    const fitting = club?.squads.filter(squad => ageGroupOf(squad.category) === age) ?? [];
    const id = choice.squadId === undefined ? (fitting.length === 1 ? fitting[0].id : club?.squads.length === 1 ? club.squads[0].id : undefined) : choice.squadId;
    return { club, squad: club?.squads.find(item => item.id === id) };
}

/** Called before the pane read resolves, so a different tournament cannot inherit the old choice. */
export function useTournamentChoiceBoundary(id: number) {
    const auth = useEntryOwner(), state = useSyncExternalStore(subscribe, snapshot);
    useEffect(() => {
        if (Number.isSafeInteger(id) && id > 0 && isOwner(state.owner, auth)) activate(id);
    }, [id, state.owner, auth]);
}

/** Keep permission/entry facts current even while an error or saved entry replaces EnterStep. */
export function useTournamentChoiceObservation(data: TournamentPaneData, squads: Squad[] | undefined, gate: EntryGate) {
    const auth = useEntryOwner(), state = useSyncExternalStore(subscribe, snapshot);
    useEffect(() => {
        const id = data.detail.id;
        if (!isOwner(state.owner, auth) || memory.id !== id || memory.generation !== state.generation) return;
        const previous = context, read = { data, squads, gate };
        context = read;
        let choice = memory.choice;
        if (squads !== undefined) {
            if (choice.clubId != null && !squads.some(item => item.club_id === choice.clubId)) choice = { clubId: null, squadId: null };
            else if (choice.squadId != null && !squads.some(item => item.id === choice.squadId && (choice.clubId == null || item.club_id === choice.clubId))) choice = { ...choice, squadId: null };
        }
        const allowed = clubsOf(squads);
        const observed = gate.kind === 'entered' ? gate.entry : gate.kind === 'answer' ? gate.entered : null;
        let known = memory.known.map(item => {
            if (item.tournamentId !== id || item.entryId !== undefined) return item;
            const row = receivedEntry(read, auth.userId!, data.detail, item);
            return row ? { ...item, entryId: row.id } : item;
        });
        if (observed?.clubId != null) {
            const entry = observed;
            if (!known.some(item => item.tournamentId === id && item.entryId === entry.id)) known.push({ tournamentId: id, clubId: entry.clubId!, squadId: entry.squadId, entryId: entry.id, priorIds: [] });
            if (!memory.commands.get(id)?.pending) choice = {};
        }
        // An empty/older response never clears a confirmed entry. Its exact row must be resolved.
        if (gate.kind === 'enter') known = known.filter(item => !(item.tournamentId === id && allowed.has(item.clubId)
            && data.detail.entries.some(entry => entry.id === item.entryId && entry.clubId === item.clubId)));
        let command = memory.commands.get(id);
        const beforeCommand = command;
        if (command?.acknowledged && !command.pending && !known.some(item => item.tournamentId === id && item.clubId === command!.clubId)) command = undefined;
        else if (command?.changed && !command.pending && data.detail !== command.failedRead && gate.kind === 'enter') command = { ...command, changed: false, error: '' };
        const knownChanged = known.length !== memory.known.length || known.some((item, at) => item !== memory.known[at]);
        if (choice.clubId !== memory.choice.clubId || choice.squadId !== memory.choice.squadId || knownChanged || command !== beforeCommand
            || previous?.data !== data || previous?.squads !== squads || previous?.gate.kind !== gate.kind) {
            const commands = new Map(memory.commands);
            if (command) commands.set(id, command); else commands.delete(id);
            publish({ ...memory, choice, known, commands });
        }
    }, [data, squads, gate, state, auth]);
}

export function useTournamentChoice(id: number, gate: Extract<EntryGate, { kind: 'enter' }>, age?: string) {
    const auth = useEntryOwner(), state = useSyncExternalStore(subscribe, snapshot);
    const current = () => isOwner(state.owner, auth) && memory.id === id && memory.generation === state.generation;
    const ready = current();
    const command = ready ? state.commands.get(id) : undefined;
    const choice = command?.pending ? { clubId: command.clubId, squadId: command.squadId } : ready ? state.choice : {};
    const { club, squad } = selection(gate, age, choice);
    const editable = ready && !command?.pending && !recorded(id);
    const choose = (patch: Choice) => {
        if (!current() || memory.commands.get(id)?.pending || recorded(id) || context?.gate.kind !== 'enter') return;
        if (patch.clubId != null && !context.gate.clubs.some(item => item.id === patch.clubId)) return;
        if (patch.squadId != null && !context.gate.clubs.some(item => item.id === club?.id && item.squads.some(own => own.id === patch.squadId))) return;
        publish({ ...memory, choice: { clubId: club?.id, squadId: squad?.id, ...patch } });
    };
    const send = async (done: (team: string) => string, failed: string) => {
        if (!current() || !context || context.data.detail.id !== id || memory.commands.get(id)?.pending || memory.commands.get(id)?.changed || recorded(id)) return;
        const read = context, latest = currentGate(read, auth.userId!);
        if (latest.kind !== 'enter') return;
        const selected = selection(latest, read.data.rules?.ageGroup);
        if (!selected.club || !selected.squad) return;
        const generation = state.generation, owner = state.owner, token = Symbol('tournament-entry');
        const command: Command = { token, pending: true, acknowledged: false, clubId: selected.club.id, squadId: selected.squad.id,
            priorIds: read.data.detail.entries.map(entry => entry.id), error: '', changed: false, notice: '' };
        putCommand(id, command);
        const ownsReply = () => isOwner(owner, auth) && memory.commands.get(id)?.token === token;
        try {
            const result = await requestEntry(id, { clubId: command.clubId, squadId: command.squadId }, { _authSessionId: auth.sessionId });
            if (!ownsReply()) return;
            const entryId = result?.entries ? receivedEntry(read, auth.userId!, result, command)?.id : undefined;
            const known = [...memory.known, { tournamentId: id, clubId: command.clubId, squadId: command.squadId, entryId, priorIds: command.priorIds }];
            const choice = memory.id === id && memory.generation === generation ? {} : memory.choice;
            publish({ ...memory, choice, known, commands: new Map(memory.commands).set(id, { ...command, pending: false, acknowledged: true, notice: done(selected.squad.name) }) });
        } catch (error) {
            if (!ownsReply()) return;
            const changed = isAxiosError(error) && error.response?.status === 409;
            putCommand(id, { ...command, pending: false, changed, failedRead: read.data.detail,
                error: extractApiErrorMessage(error, changed ? 'This tournament changed since you opened it, or your entry already went through.' : failed) });
        }
    };
    return { club, squad, editable, busy: Boolean(command?.pending), error: command?.error ?? '', changed: command?.changed ?? false, choose, send };
}

/** Refresh only the mounted current view; completed replies do not retain callbacks from retired views. */
export function useTournamentEntryFeedback(id: number, reload: () => void) {
    const auth = useEntryOwner(), state = useSyncExternalStore(subscribe, snapshot);
    const ready = isOwner(state.owner, auth) && state.id === id;
    const command = ready ? state.commands.get(id) : undefined;
    const before = useRef({ owner: state.owner, id, command });
    useEffect(() => {
        const previous = before.current;
        before.current = { owner: state.owner, id, command };
        if (ready && isOwner(state.owner, auth) && memory.id === id && previous.owner === state.owner && previous.id === id
            && previous.command?.pending && command?.acknowledged && !command.pending) reload();
    }, [ready, command, id, state.owner, reload, auth]);
    return { notice: command?.notice ?? '', recorded: ready && recorded(id) };
}
