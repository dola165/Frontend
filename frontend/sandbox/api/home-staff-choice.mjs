// Local acceptance fixture for the existing staff-choice contract. No production grants.
import { get, post, reply } from './router.mjs';
import * as W from './world.mjs';
import * as V from './viewer.mjs';

export const STAFF_CHOOSER = 9660;
const openedAt = new Date(Date.now() - 7 * 864e5), deadline = new Date(+openedAt + 30 * 864e5);
if (!V.accounts.has(STAFF_CHOOSER)) {
    V.accounts.set(STAFF_CHOOSER, { id: STAFF_CHOOSER, fullName: 'Staff choice fixture', firstName: 'Staff', lastName: 'Fixture', email: 'staff-choice@sandbox.test', dateOfBirth: '1989-06-02', createdAt: openedAt,
        preferences: { town: V.townRecord('Tbilisi'), topics: [], activity: 'COACH' }, roles: [], clubFollows: new Set(), events: [] });
    for (const clubId of [1, 16]) W.staff.push({ personId: STAFF_CHOOSER, clubId, title: 'Youth coach', kind: 'COACH', status: 'ACTIVE', responsibilities: ['SQUAD_COACH'] });
}
const choices = new Map();
const current = actor => W.staff.filter(s => s.personId === actor && (s.status ?? 'ACTIVE') === 'ACTIVE' && W.clubById(s.clubId)?.status !== 'DISSOLVED');
const clubsFor = actor => [...new Set(current(actor).map(s => s.clubId))].map(clubId => {
    const c = W.clubById(clubId);
    return { clubId, name: c.name, logoUrl: c.logoUrl ?? null, jobs: current(actor).filter(s => s.clubId === clubId).map(s => s.title), activity: null, owner: false, suggested: clubId === 1 };
});
export const staffChoiceSince = actor => actor === STAFF_CHOOSER ? openedAt.toISOString() : null;
get('/me/staff-club', ({ headers }) => {
    const actor = V.viewerId(headers), clubs = clubsFor(actor), selected = choices.get(actor);
    const needed = !selected && clubs.length > 1;
    return { needed, deadline: needed ? deadline.toISOString() : null, suggestedClubId: needed ? clubs[0].clubId : null,
        chosenClubId: selected?.chosenClubId ?? null, chosenBy: selected ? 'PERSON' : null, clubs: needed ? clubs : [] };
});
post('/me/staff-club', ({ headers, body }) => {
    const actor = V.viewerId(headers), clubId = Number(body?.clubId), selected = choices.get(actor);
    if (selected) return selected.chosenClubId === clubId ? selected : reply(409, { message: 'Your club was already chosen. Reload.' });
    const clubs = clubsFor(actor);
    if (clubs.length < 2 || !clubs.some(c => c.clubId === clubId)) return reply(404, { message: 'This staff-club choice is unavailable.' });
    const ended = clubs.filter(c => c.clubId !== clubId).map(({ clubId, name }) => ({ clubId, name }));
    for (const job of current(actor)) if (job.clubId !== clubId) { job.status = 'ENDED'; job.endedAt = new Date().toISOString(); }
    const result = { chosenClubId: clubId, ended }; choices.set(actor, result); return result;
});
