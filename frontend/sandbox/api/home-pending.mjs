// Home's contributor families read existing sandbox domain endpoints. No second action store.
import { handleApi } from './router.mjs';
import * as W from './world.mjs';
import * as V from './viewer.mjs';
import { can, decidesJoining } from './world-my-squads.mjs';
import { squadAccess } from './squad-access.mjs';
import { staffChoiceSince } from './home-staff-choice.mjs';

// Only saved ARRIVED/ABSENT records prove that this optional work has begun.
export const partiallyRecordedRegister = players => players.some(p => ['ARRIVED', 'ABSENT'].includes(p.register))
    && players.some(p => p.register == null || p.register === 'EXPECTED');

export async function homePending(headers) {
    const items = [], unavailableSources = [];
    const add = (family, id, title, context, at, destination, actionLabel, status = 'PENDING', actionable = true) =>
        items.push({ key: `${family}:${id}`, family, id, title, context, updatedAt: at ?? null, destination, actionLabel, status, actionable, direction: 'INCOMING' });
    const read = async (family, path) => {
        const result = await handleApi({ method: 'GET', path, query: new URLSearchParams(), headers });
        if (result?.status === 200) return result.body;
        if (result?.body?.code === 'EMAIL_CONFIRMATION_REQUIRED') {
            add(family, V.viewerId(headers), 'Confirm your email', '', null, '/account', 'Confirm email'); return [];
        }
        if (!result || ![403, 404].includes(result.status)) unavailableSources.push(family);
        return [];
    };
    for (const r of await read('MATCH_RESULT', '/me/results-waiting')) if (r.action !== 'DISPUTED' && can(V.personaOf(headers), r.squadId, 'MATCHES'))
        add('MATCH_RESULT', r.id, r.action === 'CONFIRM' ? 'Confirm the result' : 'Add the result', [r.squadName, r.opponentName].filter(Boolean).join(' · '), r.startsAt, `/matches/${r.id}`, r.action);
    for (const squad of W.squads.filter(s => squadAccess(s, headers)?.canManage && decidesJoining(V.personaOf(headers), s.id))) {
        const rows = await read('SQUAD_JOIN_REQUESTS', `/squad-communication/${squad.id}/join-requests`);
        if (rows.length) add('SQUAD_JOIN_REQUESTS', squad.id, `${rows.length} want to join`, squad.name, rows.map(r => r.createdAt).sort()[0], `/squads/${squad.id}?tab=players&invite=1`, 'Review join requests');
    }
    for (const h of await read('SESSION_HELPER', '/me/helping/invitations'))
        add('SESSION_HELPER', h.helperId, 'Invitation to help', `${h.squadName} · ${h.clubName}`, h.startsAt, `/home?helper=${h.helperId}`, 'Accept invitation', 'INVITED');
    const accepted = new Set();
    for (const h of await read('SESSION_HELPER_WORK', '/me/helping')) {
        if (!accepted.has(h.helperId)) add('SESSION_HELPER', h.helperId, 'Your helper session', `${h.squadName} · ${h.clubName}`, h.startsAt, `/home?helping=${h.helperId}`, 'Open your session', 'ACCEPTED', false);
        accepted.add(h.helperId);
        if (h.sessionId && h.registerOpen && partiallyRecordedRegister(h.players))
            add('SESSION_HELPER_WORK', h.sessionId, 'Finish the session register', h.squadName, h.startsAt, `/home?helpingSession=${h.sessionId}`, 'Open your session');
    }
    for (const p of await read('PROJECT_HELPER', '/projects/helping'))
        add('PROJECT_HELPER', p.projectId, p.pending ? 'Invitation to help' : 'Your helper project', p.goal, null, p.pending ? `/home?projectHelper=${p.projectId}` : `/projects/${p.projectId}`, p.pending ? 'Accept invitation' : 'Open project', p.pending ? 'INVITED' : 'ACCEPTED', !!p.pending);
    const choice = await read('STAFF_CLUB_CHOICE', '/me/staff-club');
    if (choice?.needed) add('STAFF_CLUB_CHOICE', V.viewerId(headers), 'Choose your staff club', `${choice.clubs.length} clubs`, staffChoiceSince(V.viewerId(headers)), '/me/staff-club', 'Choose your club');
    return { items, unavailableSources: [...new Set(unavailableSources)] };
}
