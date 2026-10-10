import { moduleNames, type OperationRecord } from '../../clubOperations/api';
import { operationTab } from '../../clubOperations/workspaceNavigation';
import { isFinished } from '../../clubOperations/records/recordStatus';
import { dayLabel, dueWords, timeLabel } from '../fixtures';
import { replies, type CoachSquad } from './useCoachData';

export type NeedTone = 'danger' | 'warning' | 'info' | 'neutral';
/** Something waiting for the coach: what it is, where it applies, its state in a word or two, and where it opens. */
export interface CoachNeed { key: string; tone: NeedTone; title: string; meta: string; status: string; to: string; rank: number; date: string }

const DAY = 86_400_000;
const recordLink = (club: number, record: OperationRecord) => `/clubs/${club}/workspace?tab=${operationTab(record.module)}&record=${record.id}${record.squad_id ? `&squad=${record.squad_id}` : ''}`;

/**
 * Everything waiting for a coach across their squads, most urgent first: overdue work, then replies and
 * messages to chase and players to plan around, then things to keep an eye on. Nothing is counted that the
 * squad spaces and records did not report.
 */
export function coachNeeds({ club, squads, names, records, mine, person, now }: {
    club: number; squads: CoachSquad[]; names: Map<number, string>; records: OperationRecord[]; mine: OperationRecord[];
    person: (id: number | null) => string | null; now: number;
}): CoachNeed[] {
    const items: CoachNeed[] = [];
    for (const squad of squads) {
        const name = names.get(squad.id) ?? '';
        // Matches and events that ask families to reply, in the coming week.
        for (const session of squad.sessions) {
            const start = new Date(session.starts_at).getTime(), reply = replies(session);
            if (session.status !== 'SCHEDULED' || start < now || start > now + 7 * DAY || !reply.asked || !reply.none) continue;
            items.push({ key: `reply-${session.id}`, tone: 'warning', title: session.title, meta: `${name} · ${dayLabel(session.starts_at, now)} ${timeLabel(session.starts_at)} · ${reply.text}`,
                status: `${reply.none} no reply`, to: `?tab=schedule&session=${session.id}`, rank: 1, date: session.starts_at });
        }
        // Families waiting for an answer in private messages.
        const waiting = squad.overview?.threads.filter(thread => thread.unread_count > 0) ?? [];
        if (waiting.length) items.push({ key: `families-${squad.id}`, tone: 'warning', title: waiting.length === 1 ? `${waiting[0].full_name} messaged you` : `${waiting.length} families messaged you`,
            meta: `${name} · ${waiting.length === 1 ? 'Private message' : waiting.map(thread => thread.full_name).join(', ')}`, status: 'Reply',
            to: `/messages?squadId=${squad.id}&channel=coach${waiting.length === 1 ? `&thread=${waiting[0].user_id}` : ''}`, rank: 1, date: '' });
        // Important updates, still pinned, that some families have not confirmed.
        const families = squad.overview?.threads.length ?? 0;
        for (const update of squad.updates) {
            const read = update.acknowledged_by?.length ?? 0;
            if (!update.important || !families || read >= families || !update.expires_at || new Date(update.expires_at).getTime() < now) continue;
            items.push({ key: `update-${update.id}`, tone: 'info', title: update.title ?? 'Update', meta: `${name} · ${read} of ${families} families confirmed`,
                status: `${families - read} not read`, to: `?tab=updates&squad=${squad.id}`, rank: 2, date: update.created_at });
        }
    }
    const seen = new Set<number>();
    for (const record of records) {
        seen.add(record.id);
        const player = person(record.subject_user_id) ?? record.title, squad = names.get(record.squad_id ?? 0) ?? '';
        if (record.module === 'AVAILABILITY') items.push({ key: `record-${record.id}`, tone: 'warning', title: player, meta: [record.data.restrictions || record.title, squad].filter(Boolean).join(' · '),
            status: 'Restricted', to: recordLink(club, record), rank: 1, date: record.data.reviewOn ?? '' });
        else if (record.module === 'GUARDIANS' && record.status === 'PENDING') items.push({ key: `record-${record.id}`, tone: 'info', title: player, meta: [`Consent: ${record.title}`, squad].filter(Boolean).join(' · '),
            status: 'Awaiting parent', to: recordLink(club, record), rank: 3, date: record.due_on ?? '' });
        else if (record.module === 'DEVELOPMENT') {
            const date = record.data.reviewOn ?? record.due_on ?? '', due = dueWords(date, now), draft = record.status === 'DRAFT';
            if (!draft && (!due || due.days > 14)) continue;
            items.push({ key: `record-${record.id}`, tone: due?.late ? 'danger' : 'neutral', title: player, meta: [record.title.split(' — ')[0], squad].filter(Boolean).join(' · '),
                status: draft ? 'Draft' : due!.late ? due!.text : `Due ${due!.text}`, to: recordLink(club, record), rank: due?.late ? 0 : 2, date: date || '9999' });
        }
    }
    for (const record of mine) {
        if (seen.has(record.id)) continue;
        const due = dueWords(record.attentionDate ?? record.due_on, now), late = Boolean(due?.late && !isFinished(record.status)) || Boolean(record.expired);
        items.push({ key: `mine-${record.id}`, tone: late ? 'danger' : 'neutral', title: record.title, meta: [moduleNames[record.module], names.get(record.squad_id ?? 0) ?? (record.squad_id ? null : 'Club-wide'), 'Assigned to you'].filter(Boolean).join(' · '),
            status: record.expired ? 'Expired' : due ? (due.late ? due.text : `Due ${due.text}`) : 'To do', to: recordLink(club, record), rank: late ? 0 : 2, date: record.attentionDate ?? record.due_on ?? '9999' });
    }
    return items.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));
}
