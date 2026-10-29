import { moduleNames, type OperationRecord } from '../../clubOperations/api';
import { coachRecordHref } from '../../clubOperations/coachOrigin';
import { isFinished } from '../../clubOperations/records/recordStatus';
import { dayLabel, dueWords, timeLabel } from '../fixtures';
import { replies, type CoachSquad } from './useCoachData';
import { translate } from '../../../locales/useCopy';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import type { MatchCard } from './squadApi';
import type { WantToJoinItem } from './useSquadCards';

const tr = (key: keyof typeof coachHubEn, values?: Record<string, string | number>) => translate('coachHub', coachHubEn, key, values);

export type NeedTone = 'danger' | 'warning' | 'info' | 'neutral';
/** Something waiting for the coach: what it is, where it applies, its state in a word or two, and where it opens. */
export type NeedKind = 'reply' | 'message' | 'update' | 'restriction' | 'consent' | 'development' | 'task' | 'join' | 'callups';
export interface CoachNeed { key: string; kind: NeedKind; squad: number | null; tone: NeedTone; title: string; meta: string; status: string; to: string; rank: number; date: string }

const DAY = 86_400_000;
const recordLink = coachRecordHref;
const say = (key: 'needsJoin' | 'needsJoinMeta' | 'decide' | 'needsCallUps' | 'remindThem', values?: Record<string, string | number>) => translate('mySquads', mySquadsEn, key, values);

/**
 * What waits on this person in their squads because of their jobs (step 3): someone to decide on joining, for those who
 * decide it; call-ups nobody answered, for those who send them. Only what the server gave this person is counted.
 */
export function squadNeeds({ joining, cards, names, now, link }: {
    joining: WantToJoinItem[] | null; cards: Map<number, MatchCard | null> | null; names: Map<number, string>; now: number; link: (tab: string, context: Record<string, string>) => string;
}): CoachNeed[] {
    const items: CoachNeed[] = [];
    const waiting = new Map<number, number>();
    for (const item of joining ?? []) if (item.state === 'DECIDE' && item.squadId) waiting.set(item.squadId, (waiting.get(item.squadId) ?? 0) + 1);
    for (const [squad, count] of waiting) items.push({ key: `join-${squad}`, kind: 'join', squad, tone: 'warning', title: say('needsJoin', { count, squad: names.get(squad) ?? '' }),
        meta: say('needsJoinMeta'), status: say('decide'), to: link('players', { squad: String(squad) }), rank: 1, date: '' });
    for (const [squad, card] of cards ?? []) {
        const match = card?.match, unanswered = card?.callUps?.filter(player => player.response === 'UNANSWERED').length ?? 0;
        if (!match || !card?.can?.remind || !unanswered) continue;
        items.push({ key: `callups-${squad}`, kind: 'callups', squad, tone: 'warning', title: say('needsCallUps', { count: unanswered }),
            meta: `${names.get(squad) ?? ''} · ${dayLabel(match.starts_at_iso, now)} ${timeLabel(match.starts_at_iso)}`, status: say('remindThem'), to: link('matches', { squad: String(squad) }), rank: 1, date: match.starts_at_iso });
    }
    return items;
}

/**
 * Everything waiting for a coach across their squads, most urgent first: overdue work, then replies and
 * messages to chase and players to plan around, then things to keep an eye on. Nothing is counted that the
 * squad spaces and records did not report.
 */
export function coachNeeds({ club, squads, names, records, mine, person, now, link }: {
    club: number; squads: CoachSquad[]; names: Map<number, string>; records: OperationRecord[]; mine: OperationRecord[];
    person: (id: number | null) => string | null; now: number; link?: (tab: string, context: Record<string, string>) => string;
}): CoachNeed[] {
    const items: CoachNeed[] = [];
    for (const squad of squads) {
        const name = names.get(squad.id) ?? '';
        // Matches and events that ask parents to reply, in the coming week.
        for (const session of squad.sessions) {
            const start = new Date(session.starts_at).getTime(), reply = replies(session);
            if (session.status !== 'SCHEDULED' || start < now || start > now + 7 * DAY || !reply.asked || !reply.none) continue;
            items.push({ key: `reply-${session.id}`, kind: 'reply', squad: squad.id, tone: 'warning', title: session.title, meta: `${name} · ${dayLabel(session.starts_at, now)} ${timeLabel(session.starts_at)} · ${reply.text}`,
                status: tr('needNoReply', { count: reply.none }), to: link ? link('calendar', { session: `${squad.id}:${session.id}`, date: session.starts_at.slice(0, 10) }) : `?tab=calendar&session=${squad.id}:${session.id}&date=${session.starts_at.slice(0, 10)}`, rank: 1, date: session.starts_at });
        }
        // Families waiting for an answer in private messages.
        const waiting = squad.overview?.threads.filter(thread => thread.unread_count > 0) ?? [];
        if (waiting.length) items.push({ key: `families-${squad.id}`, kind: 'message', squad: squad.id, tone: 'warning', title: waiting.length === 1 ? tr('needMessagedOne', { name: waiting[0].full_name }) : tr('needMessagedMany', { count: waiting.length }),
            meta: `${name} · ${waiting.length === 1 ? tr('privateMessage') : waiting.map(thread => thread.full_name).join(', ')}`, status: tr('reply'),
            to: `/messages?squadId=${squad.id}&channel=coach${waiting.length === 1 ? `&thread=${waiting[0].user_id}` : ''}`, rank: 1, date: '' });
        // Important updates, still pinned, that some parents have not confirmed.
        const families = squad.overview?.threads.length ?? 0;
        for (const update of squad.updates) {
            const acknowledged = update.acknowledged_by?.length ?? 0;
            if (!update.important || !families || acknowledged >= families || !update.expires_at || new Date(update.expires_at).getTime() < now) continue;
            items.push({ key: `update-${update.id}`, kind: 'update', squad: squad.id, tone: 'info', title: update.title ?? tr('updateFallback'), meta: `${name} · ${tr('needConfirmed', { count: acknowledged, total: families })}`,
                status: tr('needNotAck', { count: families - acknowledged }), to: link ? link('updates', { squad: String(squad.id) }) : `?tab=updates&squad=${squad.id}`, rank: 2, date: update.created_at });
        }
    }
    const seen = new Set<number>();
    for (const record of records) {
        seen.add(record.id);
        const player = person(record.subject_user_id) ?? record.title, squad = names.get(record.squad_id ?? 0) ?? '';
        if (record.module === 'AVAILABILITY') items.push({ key: `record-${record.id}`, kind: 'restriction', squad: record.squad_id, tone: 'warning', title: player, meta: [record.data.restrictions || record.title, squad].filter(Boolean).join(' · '),
            status: tr('badgeRestricted'), to: recordLink(club, record), rank: 1, date: record.data.reviewOn ?? '' });
        else if (record.module === 'GUARDIANS' && record.status === 'PENDING') items.push({ key: `record-${record.id}`, kind: 'consent', squad: record.squad_id, tone: 'info', title: player, meta: [tr('needConsent', { title: record.title }), squad].filter(Boolean).join(' · '),
            status: tr('badgeAwaitingParent'), to: recordLink(club, record), rank: 3, date: record.due_on ?? '' });
        else if (record.module === 'DEVELOPMENT') {
            const date = record.data.reviewOn ?? record.due_on ?? '', due = dueWords(date, now), draft = record.status === 'DRAFT';
            if (!draft && (!due || due.days > 14)) continue;
            items.push({ key: `record-${record.id}`, kind: 'development', squad: record.squad_id, tone: due?.late ? 'danger' : 'neutral', title: player, meta: [record.title.split(' — ')[0], squad].filter(Boolean).join(' · '),
                status: draft ? tr('needDraft') : due!.late ? due!.text : tr('needDue', { date: due!.text }), to: recordLink(club, record), rank: due?.late ? 0 : 2, date: date || '9999' });
        }
    }
    for (const record of mine) {
        if (seen.has(record.id)) continue;
        const due = dueWords(record.attentionDate ?? record.due_on, now), late = Boolean(due?.late && !isFinished(record.status)) || Boolean(record.expired);
        items.push({ key: `mine-${record.id}`, kind: 'task', squad: record.squad_id, tone: late ? 'danger' : 'neutral', title: record.title, meta: [moduleNames[record.module], names.get(record.squad_id ?? 0) ?? (record.squad_id ? null : tr('clubWide')), tr('assignedToYou')].filter(Boolean).join(' · '),
            status: record.expired ? tr('expired') : due ? (due.late ? due.text : tr('needDue', { date: due.text })) : tr('toDo'), to: recordLink(club, record), rank: late ? 0 : 2, date: record.attentionDate ?? record.due_on ?? '9999' });
    }
    return items.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));
}
