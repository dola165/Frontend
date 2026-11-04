import { sessionNavigation } from '../features/squadCommunication/sessionLink';

/** The wire contract is (type, entityType, entityId, linkPath). Only verified local
 * resource paths are executable; display text and receipt of a notification are not authority. */
export const notificationId = (value: unknown): string | null => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const text = String(value);
    return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? text : null;
};

/** Jobs links identify an existing workspace; its API rechecks current participant authority. */
export const isJobDestination = (value: string): boolean => {
    if (value === '/jobs') return true;
    const match = /^\/jobs\/([1-9]\d*)$/.exec(value);
    return match?.[0] === value && notificationId(match[1]) !== null;
};

/** The public notice carries only an opaque watch ID; the authenticated resolver owns all criteria. */
export const worldWatchLink = (raw?: string | null): string | null => {
    const match = raw?.match(/^\/world\/clubs\?watch=([1-9]\d*)$/);
    return match?.[0] === raw && notificationId(match?.[1]) ? raw! : null;
};

const id = '[1-9]\\d*';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const reviewReceipt = new RegExp(`^/pages/requests/${uuid}$`);
// Step 2, M11: every page a notice names is a real one, so the notice opens its record (home, My squads,
// Team work, a project, a staff or family link, a merge, choosing a staff club, the admin's admissions).
const code = '[A-Za-z0-9_-]{4,128}';
const route = new RegExp(`^/(?:account|my-organizations|admin|admin/page-reviews|pages/requests/${uuid}|invite/org-${id}|agent|messages|team-work|team-work/chat|calendar|notifications|requests|reports|parent|home|my-squads|me/staff-club|clubs|admissions(?:/(?:cases|inquiries)/${id}|/groups/${id}/schedule)?|club-operations|stadiums|referees/me|clubs/${id}(?:/(?:workspace|office|management|squads))?|tournaments/${id}(?:/(?:workspace|admin))?|(?:matches|match-exchange|squads|posts|profile|projects|merge)/${id}|(?:staff-invite|family-link)/${code}|stadiums/${id}(?:/manage)?)$`);
const numericKeys = new Set(['eventId', 'fixtureId', 'conversationId', 'message', 'chat','clubId', 'applicationId', 'bookingId', 'venueId', 'itemId', 'thread', 'squad', 'squadId', 'approach', 'representation', 'representationRecord', 'representationGeneration', 'permissionId', 'appointmentId', 'player', 'playerId', 'caseId', 'inquiryId', 'task', 'step', 'who', 'journey', 'journeyChild', 'competitionAppointment']);
const queryKeys = new Set([...numericKeys, 'tab', 'tool', 'view', 'scope', 'clubName', 'manageClub', 'managementTab', 'channel', 'room', 'sessionId', 'session', 'at', 'review', 'date', 'invite']);
/** Where each newer query key may be used, and nowhere else. */
const keyPages: Record<string, RegExp> = {
    task: /^\/team-work$/, step: /^\/team-work$/, who: /^\/team-work$/,
    journey: /^\/calendar$/, journeyChild: /^\/calendar$/, date: /^\/calendar$/,
    competitionAppointment: /^\/referees\/me$/,
};

export const safeNotificationLink = (raw?: string | null): URL | null => {
    // Older notices name the app's start page; it is Home.
    if (raw === '/') raw = '/home';
    if (raw?.startsWith('/jobs')) return isJobDestination(raw) ? new URL(raw, 'https://notification.invalid') : null;
    if (worldWatchLink(raw)) return new URL(raw!, 'https://notification.invalid');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || Array.from(raw).some(char => char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return null;
    try {
        const decoded = decodeURIComponent(raw);
        if (Array.from(decoded).some(char => char === '\\' || char === '%' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
        const url = new URL(raw, 'https://notification.invalid');
        // Canonical path segments are deliberately unencoded. No dot traversal or URL normalization.
        if (url.pathname !== raw.split(/[?#]/)[0] || url.pathname.includes('%') || !route.test(url.pathname)) return null;
        if (url.pathname.split('/').some(part => /^\d+$/.test(part) && !notificationId(part))) return null;
        for (const [key, value] of url.searchParams) {
            if (!queryKeys.has(key) || url.searchParams.getAll(key).length !== 1 || (numericKeys.has(key) && !notificationId(value))) return null;
            if (keyPages[key] && !keyPages[key].test(url.pathname)) return null;
        }
        // S5: a squad's joining requests open its players tab with the invite dialog, and nothing else.
        if (url.searchParams.has('invite') && (!/^\/squads\/[1-9]\d*$/.test(url.pathname) || url.hash || url.searchParams.get('invite') !== '1'
            || url.searchParams.get('tab') !== 'players' || Array.from(url.searchParams.keys()).some(key => !['tab', 'invite'].includes(key)))) return null;
        if (url.searchParams.has('date') && !/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date')!)) return null;
        if (url.pathname === '/admin' && (url.hash || Array.from(url.searchParams.keys()).some(key => key !== 'tab'))) return null;
        if (/^\/(?:home|my-squads|me\/staff-club|clubs|projects\/|merge\/|staff-invite\/|family-link\/)/.test(url.pathname) && !/^\/clubs\/[1-9]/.test(url.pathname)
            && (url.search || url.hash)) return null;
        const joiningRecordKeys = ['caseId', 'inquiryId'].filter(key => url.searchParams.has(key));
        if (joiningRecordKeys.length && (!/^\/clubs\/[1-9]\d*\/workspace$/.test(url.pathname) || url.searchParams.get('tab') !== 'admissions'
            || joiningRecordKeys.length !== 1 || Array.from(url.searchParams.keys()).some(key => !['tab', ...joiningRecordKeys].includes(key)))) return null;
        // A child's page: the child, and one session on it (`session=squad:id`, with its `at`) or one of its full views.
        const childPage = url.pathname === '/parent' && url.searchParams.has('player');
        if (childPage) {
            const session = url.searchParams.get('session'), view = url.searchParams.get('view'), at = url.searchParams.get('at');
            if (url.hash || Array.from(url.searchParams.keys()).some(key => !['player', 'session', 'at', 'view'].includes(key))
                || session !== null && !/^[1-9]\d*:[1-9]\d*$/.test(session) || at !== null && (session === null || !Number.isFinite(Date.parse(at)))
                || view !== null && (session !== null || !['updates', 'calendar'].includes(view))) return null;
        } else if (url.searchParams.has('session')) return null;
        if (url.searchParams.has('player') && (!/^\/(?:parent|admissions(?:\/(?:cases|inquiries)\/[1-9]\d*)?)$/.test(url.pathname)
            || !childPage && Array.from(url.searchParams.keys()).some(key => key !== 'player'))) return null;
        if (url.searchParams.has('playerId') && (!/^\/admissions\/groups\/[1-9]\d*\/schedule$/.test(url.pathname)
            || Array.from(url.searchParams.keys()).some(key => key !== 'playerId'))) return null;
        if (url.pathname.startsWith('/admissions') && Array.from(url.searchParams.keys()).some(key => !['player', 'playerId'].includes(key))) return null;
        if (url.hash) {
            const squadUpdate = /^\/squads\//.test(url.pathname) && /^#squad-update-[1-9]\d*$/.test(url.hash)
                && notificationId(url.hash.slice('#squad-update-'.length));
            const appointment = (/^\/match(?:es|-exchange)\//.test(url.pathname) || url.pathname === '/referees/me')
                && /^#appointment-[1-9]\d*$/.test(url.hash) && notificationId(url.hash.slice('#appointment-'.length));
            const availability = url.pathname === '/referees/me' && url.hash === '#availability';
            const offer = url.pathname === '/referees/me' && /^#offer-[1-9]\d*$/.test(url.hash)
                && notificationId(url.hash.slice('#offer-'.length));
            const coordination = /^\/match(?:es|-exchange)\//.test(url.pathname) && url.hash === '#coordination';
            const result = (/^\/match(?:es|-exchange)\//.test(url.pathname) || url.pathname === '/calendar' && url.searchParams.has('eventId')) && url.hash === '#result';
            if (!squadUpdate && !appointment && !availability && !offer && !coordination && !result) return null;
        }
        const keys = Array.from(url.searchParams.keys());
        // The team chats: one chat (?chat=), or one message in it (a mention); an old link names only the message.
        if ((url.pathname === '/team-work/chat' || url.searchParams.has('message'))
            && (url.pathname !== '/team-work/chat' || url.hash || keys.some(key => key !== 'message' && key !== 'chat'))) return null;
        if (url.pathname === '/my-organizations' && (url.hash || keys.length !== 1 || !url.searchParams.has('itemId'))) return null;
        if (url.pathname.startsWith('/invite/org-') && (url.search || url.hash || !notificationId(url.pathname.slice('/invite/org-'.length)))) return null;
        if (url.pathname === '/admin/page-reviews' || url.searchParams.has('review')) {
            if (url.pathname !== '/admin/page-reviews' || url.hash || keys.length !== 1 || !new RegExp(`^${uuid}$`).test(url.searchParams.get('review') ?? '')) return null;
        }
        if (reviewReceipt.test(url.pathname) && (url.search || url.hash)) return null;
        if (url.searchParams.has('permissionId')) {
            const legacy = url.pathname === '/club-operations' && keys.length === 1;
            const parent = url.pathname === '/parent' && keys.length === 2 && url.searchParams.get('tab') === 'connections';
            if (url.hash || !(legacy || parent)) return null;
        }
        if (url.searchParams.has('appointmentId')) {
            const legacy = url.pathname === '/club-operations' && keys.length === 1;
            const inbox = url.pathname === '/requests' && keys.every(key => key === 'appointmentId' || key === 'view')
                && (!url.searchParams.has('view') || url.searchParams.get('view') === 'needs-you');
            if (url.hash || !(legacy || inbox)) return null;
        }
        if (url.pathname === '/requests' && url.searchParams.has('view') && !['updates', 'needs-you'].includes(url.searchParams.get('view')!)) return null;
        if (url.pathname === '/reports' && (url.hash || !(keys.length === 0 || keys.length === 1 && (url.searchParams.has('itemId') || url.searchParams.get('view') === 'notices')))) return null;
        if (url.searchParams.has('approach')) {
            const profile = /^\/profile\/[1-9]\d*$/.test(url.pathname) && keys.length === 1;
            const agent = url.pathname === '/agent' && url.searchParams.get('tab') === 'relationships';
            const club = /^\/clubs\/[1-9]\d*\/workspace$/.test(url.pathname) && url.searchParams.get('tab') === 'club-approaches';
            if (url.hash || !(profile || (agent || club) && keys.length === 2)) return null;
        }
        const representationKeys = ['representation', 'representationRecord', 'representationGeneration'];
        if (representationKeys.some(key => url.searchParams.has(key))) {
            const request = keys.length === 1 && url.searchParams.has('representation');
            const record = keys.length === 2 && url.searchParams.has('representationRecord') && url.searchParams.has('representationGeneration');
            if (!/^\/profile\/[1-9]\d*$/.test(url.pathname) || url.hash || !(request || record)) return null;
        }
        if (url.pathname === '/agent' && !url.searchParams.has('approach')) return null;
        if ((/^\/match(?:es|-exchange)\//.test(url.pathname) || url.pathname === '/referees/me')
            && url.search && !(url.pathname === '/referees/me' && keys.length === 1 && url.searchParams.has('competitionAppointment'))) return null;
        if (url.searchParams.has('sessionId') || (url.searchParams.has('at') && !childPage)) {
            if (!/^\/squads\/[1-9]\d*$/.test(url.pathname) || url.hash
                || Array.from(url.searchParams.keys()).some(key => !['tab', 'sessionId', 'at'].includes(key))
                || !sessionNavigation(url.searchParams).initialSessionId) return null;
        }
        if (['/notifications', '/requests'].includes(url.pathname) && (url.searchParams.has('bookingId') || url.searchParams.has('venueId'))
            && (!url.searchParams.has('bookingId') || !url.searchParams.has('venueId') || url.searchParams.has('itemId') || url.searchParams.has('squadId'))) return null;
        const squad = url.pathname.match(/^\/squads\/([1-9]\d*)$/)?.[1];
        if (squad && (url.searchParams.has('thread') || ['chat', 'coach'].includes(url.searchParams.get('tab') ?? ''))) {
            const thread = url.searchParams.get('thread');
            if (url.searchParams.get('tab') === 'coach' && !thread) return null;
            return safeNotificationLink(squadConversationDestination(squad, thread));
        }
        if (['/notifications', '/requests'].includes(url.pathname) && url.searchParams.has('squadId')) {
            const channel = url.searchParams.get('channel');
            if (!['chat', 'coach'].includes(channel ?? '') || url.searchParams.has('itemId')
                || (channel === 'coach') !== url.searchParams.has('thread')) return null;
        }
        if (url.pathname === '/messages' && url.searchParams.has('chat')) {
            const chat = url.searchParams.get('chat')!;
            if (url.searchParams.has('conversationId') && url.searchParams.get('conversationId') !== chat) return null;
            url.searchParams.delete('chat'); url.searchParams.set('conversationId', chat);
        }
        if (url.pathname === '/notifications') { url.pathname = '/requests'; url.search = `view=updates${url.search ? '&' + url.search.slice(1) : ''}`; }
        if (url.pathname === '/club-operations') {
            url.pathname = url.searchParams.has('permissionId') ? '/parent' : '/requests';
            if (url.searchParams.has('permissionId')) url.searchParams.set('tab', 'connections');
        }
        if (/^\/clubs\/[1-9]\d*\/squads$/.test(url.pathname)) { url.pathname = url.pathname.replace(/\/squads$/, ''); url.searchParams.set('tab', 'teams'); }
        return url;
    } catch { return null; }
};

export const venueBookingDestination = (venueId: string, bookingId: string) =>
    `/requests?view=updates&venueId=${venueId}&bookingId=${bookingId}`;

export const squadConversationDestination = (squadId: string, thread: string | null) =>
    `/requests?view=updates&squadId=${squadId}${thread ? `&channel=coach&thread=${thread}` : '&channel=chat'}`;
