import { sessionNavigation } from '../features/squadCommunication/sessionLink';

/** The wire contract is (type, entityType, entityId, linkPath). Only verified local
 * resource paths are executable; display text and receipt of a notification are not authority. */
export const notificationId = (value: unknown): string | null => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const text = String(value);
    return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? text : null;
};

const id = '[1-9]\\d*';
const route = new RegExp(`^/(?:account|agent|messages|calendar|notifications|reports|parent|admissions(?:/(?:cases|inquiries)/${id}|/groups/${id}/schedule)?|club-operations|stadiums|referees/me|clubs/${id}(?:/(?:workspace|management|squads))?|tournaments/${id}(?:/(?:workspace|admin))?|(?:match-exchange|squads|posts|profile)/${id}|stadiums/${id}(?:/manage)?)$`);
const numericKeys = new Set(['eventId', 'fixtureId', 'conversationId', 'chat', 'clubId', 'applicationId', 'bookingId', 'venueId', 'itemId', 'thread', 'squad', 'squadId', 'approach', 'representation', 'representationRecord', 'representationGeneration', 'permissionId', 'appointmentId', 'player', 'playerId', 'caseId', 'inquiryId']);
const queryKeys = new Set([...numericKeys, 'tab', 'view', 'scope', 'clubName', 'manageClub', 'managementTab', 'channel', 'sessionId', 'at']);

export const safeNotificationLink = (raw?: string | null): URL | null => {
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
        }
        const joiningRecordKeys = ['caseId', 'inquiryId'].filter(key => url.searchParams.has(key));
        if (joiningRecordKeys.length && (!/^\/clubs\/[1-9]\d*\/workspace$/.test(url.pathname) || url.searchParams.get('tab') !== 'admissions'
            || joiningRecordKeys.length !== 1 || Array.from(url.searchParams.keys()).some(key => !['tab', ...joiningRecordKeys].includes(key)))) return null;
        if (url.searchParams.has('player') && (!/^\/(?:parent|admissions(?:\/(?:cases|inquiries)\/[1-9]\d*)?)$/.test(url.pathname)
            || Array.from(url.searchParams.keys()).some(key => key !== 'player'))) return null;
        if (url.searchParams.has('playerId') && (!/^\/admissions\/groups\/[1-9]\d*\/schedule$/.test(url.pathname)
            || Array.from(url.searchParams.keys()).some(key => key !== 'playerId'))) return null;
        if (url.pathname.startsWith('/admissions') && Array.from(url.searchParams.keys()).some(key => !['player', 'playerId'].includes(key))) return null;
        if (url.hash) {
            const squadUpdate = /^\/squads\//.test(url.pathname) && /^#squad-update-[1-9]\d*$/.test(url.hash)
                && notificationId(url.hash.slice('#squad-update-'.length));
            const appointment = (url.pathname.startsWith('/match-exchange/') || url.pathname === '/referees/me')
                && /^#appointment-[1-9]\d*$/.test(url.hash) && notificationId(url.hash.slice('#appointment-'.length));
            const availability = url.pathname === '/referees/me' && url.hash === '#availability';
            const offer = url.pathname === '/referees/me' && /^#offer-[1-9]\d*$/.test(url.hash)
                && notificationId(url.hash.slice('#offer-'.length));
            const coordination = url.pathname.startsWith('/match-exchange/') && url.hash === '#coordination';
            const result = url.pathname.startsWith('/match-exchange/') && url.hash === '#result';
            if (!squadUpdate && !appointment && !availability && !offer && !coordination && !result) return null;
        }
        const keys = Array.from(url.searchParams.keys());
        if (keys.some(key => ['permissionId', 'appointmentId'].includes(key))
            && (url.pathname !== '/club-operations' || keys.length !== 1 || url.hash)) return null;
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
        if ((url.pathname.startsWith('/match-exchange/') || url.pathname === '/referees/me') && url.search) return null;
        if (url.searchParams.has('sessionId') || url.searchParams.has('at')) {
            if (!/^\/squads\/[1-9]\d*$/.test(url.pathname) || url.hash
                || Array.from(url.searchParams.keys()).some(key => !['tab', 'sessionId', 'at'].includes(key))
                || !sessionNavigation(url.searchParams).initialSessionId) return null;
        }
        if (url.pathname === '/notifications' && (url.searchParams.has('bookingId') || url.searchParams.has('venueId'))
            && (!url.searchParams.has('bookingId') || !url.searchParams.has('venueId') || url.searchParams.has('itemId') || url.searchParams.has('squadId'))) return null;
        const squad = url.pathname.match(/^\/squads\/([1-9]\d*)$/)?.[1];
        if (squad && (url.searchParams.has('thread') || ['chat', 'coach'].includes(url.searchParams.get('tab') ?? ''))) {
            const thread = url.searchParams.get('thread');
            if (url.searchParams.get('tab') === 'coach' && !thread) return null;
            return safeNotificationLink(squadConversationDestination(squad, thread));
        }
        if (url.pathname === '/notifications' && url.searchParams.has('squadId')) {
            const channel = url.searchParams.get('channel');
            if (!['chat', 'coach'].includes(channel ?? '') || url.searchParams.has('itemId')
                || (channel === 'coach') !== url.searchParams.has('thread')) return null;
        }
        if (url.pathname === '/messages' && url.searchParams.has('chat')) {
            const chat = url.searchParams.get('chat')!;
            if (url.searchParams.has('conversationId') && url.searchParams.get('conversationId') !== chat) return null;
            url.searchParams.delete('chat'); url.searchParams.set('conversationId', chat);
        }
        return url;
    } catch { return null; }
};

export const venueBookingDestination = (venueId: string, bookingId: string) =>
    `/notifications?venueId=${venueId}&bookingId=${bookingId}`;

export const squadConversationDestination = (squadId: string, thread: string | null) =>
    `/notifications?squadId=${squadId}${thread ? `&channel=coach&thread=${thread}` : '&channel=chat'}`;
