// Phase B producers for world-home's existing posts. Canonical matches remain world-football.exchange.
import * as W from './world.mjs';
import * as F from './world-football.mjs';
import * as V from './viewer.mjs';
import { familyOf } from './world-family.mjs';
import { squadRoles } from './world-my-squads.mjs';

const rollout = Date.now();
const counted = new Map();
const local = (date, clubId) => new Intl.DateTimeFormat('en-CA', { timeZone: W.clubById(clubId)?.timezone ?? 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const issueDates = friday => [1, 2].map(days => { const day = new Date(`${friday}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + days); return day.toISOString().slice(0, 10); });
const squad = id => F.sq(id);
const clubIds = m => [...new Set([squad(m.hostSquadId)?.clubId, squad(m.opponentSquadId)?.clubId].filter(Boolean))];
const disputed = m => m.resultStatus === 'DISPUTED' || m.resultHistory?.some(r => r.action === 'DISPUTE');
const standingAt = m => {
    const reported = m.resultHistory?.find(r => ['REPORT', 'PROPOSE'].includes(r.action))?.created_at ?? m.reportedAt ?? m.refereeReportAt;
    const deadline = m.disputeUntil ? Date.parse(m.disputeUntil) : reported ? Date.parse(reported) + 48 * 3600e3 : Infinity;
    const confirmation = m.resultHistory?.filter(r => ['CONFIRM', 'FINALIZE'].includes(r.action)).at(-1)?.created_at;
    if (['CONFIRMED', 'FINAL'].includes(m.resultStatus ?? (m.score ? 'CONFIRMED' : 'NONE')))
        return Math.min(deadline, new Date(confirmation ?? m.officialAt ?? m.refereeReportAt ?? (m.resultStatus === 'FINAL' && reported ? reported : m.end)).getTime());
    if (['REPORTED', 'PROPOSED'].includes(m.resultStatus)) return deadline;
    return Infinity;
};
const stands = (m, now) => m.origin !== 'PAST' && !m.legacy && !m.deleted && m.status !== 'CANCELLED' && !disputed(m)
    && Array.isArray(m.score) && m.score.length === 2 && m.score.every(Number.isInteger) && new Date(m.start) <= now && standingAt(m) <= +now;
const category = s => String(s?.category ?? s?.ageGroup ?? '');
const ageOf = label => {
    const youth = /(?:^|[^a-z0-9])(?:u|under)[\s._-]*([0-9]{1,2})(?![0-9])/i.exec(String(label ?? ''));
    if (youth) return Number(youth[1]);
    const year = /(?:^|[^0-9])((?:19|20)[0-9]{2})(?![0-9])/.exec(String(label ?? ''));
    return year ? new Date().getFullYear() - Number(year[1]) + 1 : null;
};
const age = s => ageOf(category(s));
const adult = s => /(^|[^a-z])(seniors?|first[ _-]?team|adults?|men|mens|women|womens|ladies|veterans?|vets|masters|reserves?|amateurs?|o[0-9]{2}|over[ _-]?[0-9]{2})([^a-z]|$)/i.test(category(s));
const protectedSquad = s => {
    if (!s) return false;
    if (age(s) != null) return age(s) <= 11;
    if (adult(s)) return false;
    // A coarse birth year cannot establish an exact birthday; unknown youth ages stay private.
    const births = (s.playerIds ?? []).map(id => W.personById(id)).filter(p => p?.dateOfBirth);
    return !births.length || births.some(p => new Date(p.dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear() - 12)));
};
const protectedResult = m => {
    const event = W.events.find(e => e.id === m.id);
    const listedAge = ageOf(m.ageGroup ?? m.age_group ?? event?.ageGroup ?? event?.age_group);
    return listedAge != null && listedAge <= 11 || [squad(m.hostSquadId), squad(m.opponentSquadId)].some(protectedSquad);
};
const safeLabel = s => !s ? null : age(s) ? `U${age(s)}` : adult(s) ? 'Seniors' : 'Squad';
function family(m, viewer, headers) {
    if (viewer == null || viewer !== V.viewerId(headers)) return false;
    const ids = [m.hostSquadId, m.opponentSquadId].filter(Boolean);
    const roles = viewer === W.ME_ID && !V.isNewcomer(headers) ? squadRoles(V.personaOf(headers)) : null;
    if (ids.some(id => roles?.has(id))) return true;
    const children = new Set((familyOf(headers) ?? []).map(c => c.id));
    return ids.some(id => squad(id)?.playerIds.some(child => children.has(child)));
}
export function weekendFriday(now) {
    const day = local(now), date = new Date(`${day}T00:00:00Z`), weekday = date.getUTCDay();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', hourCycle: 'h23' }).format(now));
    if (weekday >= 1 && weekday <= 4 || weekday === 5 && hour < 9) return null;
    date.setUTCDate(date.getUTCDate() - (weekday + 2) % 7);
    return date.toISOString().slice(0, 10);
}
/** No startup backfill, no timer: called by the sandbox's existing feed reads and switches. */
export function collectMatchMoments(posts, createPost, switchesOf, now = new Date()) {
    for (const m of F.exchange) if (stands(m, now) && standingAt(m) >= rollout) {
        for (const clubId of clubIds(m)) {
            const receipt = `MATCH_RESULT:${m.id}:${clubId}`;
            if (counted.has(receipt)) continue;
            const off = switchesOf(clubId).off.has('RESULTS'); counted.set(receipt, { suppressed: off });
            if (off) continue;
            const day = local(m.start, clubId);
            let post = posts.find(p => p.record?.kind === 'RESULTS' && p.clubId === clubId && p.record.moment === day);
            if (!post) post = createPost('RESULTS', clubId, day);
            post.record.eventIds.push(m.id); post.record.version++;
        }
    }
    const friday = weekendFriday(now);
    if (!friday || Date.parse(`${friday}T09:00:00+04:00`) < rollout) return;
    for (const club of W.clubs) {
        const receipt = `WEEKEND:${club.id}:${friday}`;
        if (counted.has(receipt)) continue;
        const fixtures = F.exchange.filter(m => m.origin !== 'PAST' && !m.deleted && m.status === 'ARRANGED' && m.opponentAnswer !== 'NOT_US'
            && clubIds(m).includes(club.id) && (m.opponentAnswer !== 'WAITING' || squad(m.hostSquadId)?.clubId === club.id)
            && (m.opponentSquadId || m.outside) && new Date(m.start) > now && issueDates(friday).includes(local(m.start, club.id)));
        if (!fixtures.length) continue;
        counted.set(receipt, {});
        if (switchesOf(club.id).off.has('WEEKEND')) continue;
        createPost('WEEKEND', club.id, friday).record.eventIds = fixtures.map(m => m.id);
    }
}
export function matchAdditionsReadable(post, viewer, headers) {
    return post.record?.kind !== 'RESULTS' || (post.record.eventIds ?? []).every(id => {
        const m = F.listingById(id); return !!m && (!protectedResult(m) || family(m, viewer, headers));
    });
}
export function matchRecordView(post, base, viewer, headers) {
    const results = post.record.kind === 'RESULTS';
    const matches = (post.record.eventIds ?? []).map(id => F.listingById(id)).filter(m => m && !m.deleted && clubIds(m).includes(post.clubId))
        .filter(m => results ? stands(m, new Date()) && (!protectedResult(m) || family(m, viewer, headers)) : m.origin !== 'PAST' && m.opponentAnswer !== 'NOT_US')
        .map(m => {
            const homeSquad = squad(m.hostSquadId), awaySquad = squad(m.opponentSquadId);
            const home = W.clubById(homeSquad?.clubId), away = W.clubById(awaySquad?.clubId);
            return { eventId: m.id, homeClub: home?.name ?? null, awayClub: away?.name ?? m.outside ?? null, homeCrest: home?.logoUrl ?? null, awayCrest: away?.logoUrl ?? null,
                homeSquad: safeLabel(homeSquad), awaySquad: safeLabel(awaySquad), startsAt: new Date(m.start).toISOString(), state: m.status === 'CANCELLED' ? 'CANCELLED' : !results && !issueDates(post.record.moment).includes(local(m.start, post.clubId)) ? 'RESCHEDULED' : new Date(m.end) < new Date() ? 'COMPLETED' : 'SCHEDULED', homeScore: results ? m.score[0] : null, awayScore: results ? m.score[1] : null };
        });
    if (results && !matches.length) return null;
    const additions = matchAdditionsReadable(post, viewer, headers);
    return { ...base, title: results ? 'From the results' : 'This weekend', action: null, matches, line: additions ? base.line : null, photoIds: additions ? base.photoIds : null };
}
