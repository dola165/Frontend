import { Handshake, Heart, ListChecks, QrCode, Shield, Ticket, Users, type LucideIcon } from 'lucide-react';
import type { AccessAction } from '../../api/access';
import { activityColors } from '../schedule/activityIcons';

/**
 * The eight things a person can do from anywhere (F5, "actions everywhere"). Each is one flow that any page places as a
 * button: `ActionButton` shows it only when the rule-checker allows it, and its link opens the flow over the page
 * (`?do=<key>&do-…`, read by `ActionHost`), with the likely answer already chosen by `guess`.
 */
export type ActionKey = Extract<AccessAction, 'join_squad' | 'invite_staff' | 'add_child' | 'arrange_match' | 'report_score' | 'start_club' | 'follow'>;

/** What an action is about. A match is a finished one waiting for its score; `vs` a club to play. */
export type ActionSubject =
    | { kind: 'me' }
    | { kind: 'club'; id: number }
    | { kind: 'squad'; id: number; clubId?: number | null }
    | { kind: 'match'; source: 'MATCH_EXCHANGE' | 'SCHEDULE_EVENT'; id: number; squadId?: number | null }
    | { kind: 'person'; id: number };

/** What the page already knows that narrows the flow: an opponent to play, a child to join for, the job to offer. */
export interface ActionHints { opponentId?: number | null; playerId?: number | null; job?: string | null; code?: string | null }

export interface ActionDefinition {
    key: ActionKey;
    label: [english: string, georgian: string];
    /** The short form for a crowded row ("Arrange", "Score"). */
    short: [english: string, georgian: string];
    icon: LucideIcon;
    /** Match actions wear the match colour (the calendar's); the rest stay quiet. */
    color?: string;
    /** The subjects it can be about; the first is the default. */
    subjects: ActionSubject['kind'][];
    /** The flow's opening answers, as the `do-…` keys of its address. */
    guess: (subject: ActionSubject, hints: ActionHints) => Record<string, string | number | null | undefined>;
}

const squadOf = (subject: ActionSubject) => subject.kind === 'squad' ? subject.id : subject.kind === 'match' ? subject.squadId : null;
const clubOf = (subject: ActionSubject) => subject.kind === 'club' ? subject.id : subject.kind === 'squad' ? subject.clubId : null;

export const ACTIONS: Record<ActionKey, ActionDefinition> = {
    report_score: {
        key: 'report_score', label: ['Report a score', 'ანგარიშის შეყვანა'], short: ['Score', 'ანგარიში'], icon: ListChecks, color: activityColors.MATCH,
        subjects: ['me', 'match', 'squad'],
        // A match names itself; otherwise the newest one waiting (of the squad, when on its page).
        guess: subject => subject.kind === 'match' ? { source: subject.source, event: subject.id } : { squad: squadOf(subject) },
    },
    arrange_match: {
        key: 'arrange_match', label: ['Arrange a match', 'მატჩის დაგეგმვა'], short: ['Arrange', 'დაგეგმვა'], icon: Handshake, color: activityColors.FRIENDLY,
        subjects: ['me', 'squad', 'club'],
        guess: (subject, hints) => ({ squad: squadOf(subject), opponent: hints.opponentId }),
    },
    add_child: {
        key: 'add_child', label: ['Add my child', 'ჩემი შვილის დამატება'], short: ['Add child', 'ბავშვი'], icon: Heart,
        subjects: ['me'], guess: () => ({}),
    },
    join_squad: {
        key: 'join_squad', label: ['Join with a code', 'გუნდში შესვლა კოდით'], short: ['Join', 'შესვლა'], icon: Ticket,
        subjects: ['me', 'squad'],
        guess: (subject, hints) => ({ squad: squadOf(subject), player: hints.playerId, code: hints.code }),
    },
    invite_staff: {
        key: 'invite_staff', label: ['Invite staff', 'პერსონალის მოწვევა'], short: ['Invite', 'მოწვევა'], icon: QrCode,
        subjects: ['club', 'squad', 'me'],
        // For a squad the likely helper is an assistant coach; for the club a head coach (the link's own default).
        guess: (subject, hints) => ({ club: clubOf(subject), squad: squadOf(subject), job: hints.job ?? (subject.kind === 'squad' ? 'ASSISTANT_COACH' : null) }),
    },
    start_club: {
        key: 'start_club', label: ['Start a club', 'კლუბის შექმნა'], short: ['Start', 'შექმნა'], icon: Shield,
        subjects: ['me'], guess: () => ({}),
    },
    follow: {
        key: 'follow', label: ['Follow', 'გამოწერა'], short: ['Follow', 'გამოწერა'], icon: Users,
        // A toggle where the club or person is shown (`FollowButton`), never a flow of its own.
        subjects: ['club', 'person', 'me'], guess: () => ({}),
    },
};

export const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[];
export const isActionKey = (value: string | null): value is ActionKey => value !== null && Object.hasOwn(ACTIONS, value);

/**
 * The link state of a flow opened by a button on this page: closing it goes back one step, so Back never reopens it.
 * A flow opened from a shared link or a notification has none, and closing replaces its address instead.
 */
export const OPENED_HERE = { actionOpenedHere: true } as const;
export const openedHere = (state: unknown) => Boolean((state as { actionOpenedHere?: boolean } | null)?.actionOpenedHere);

/** The address key that opens a flow, and the prefix of its answers. */
export const DO_PARAM = 'do';
const PREFIX = 'do-';

type Location = { pathname: string; search: string; hash?: string };

/** The address with every action key removed: closing a flow. */
export function withoutAction(search: string) {
    const params = new URLSearchParams(search);
    for (const key of [...params.keys()]) if (key === DO_PARAM || key.startsWith(PREFIX)) params.delete(key);
    const rest = params.toString();
    return rest ? `?${rest}` : '';
}

/** The current page with the flow open over it, its likely answers filled in. Follow has no flow: null. */
export function actionHref(location: Location, key: ActionKey, subject: ActionSubject = { kind: 'me' }, hints: ActionHints = {}): string | null {
    if (key === 'follow') return null;
    const params = new URLSearchParams(withoutAction(location.search));
    params.set(DO_PARAM, key);
    for (const [name, value] of Object.entries(ACTIONS[key].guess(subject, hints))) if (value != null && value !== '') params.set(`${PREFIX}${name}`, String(value));
    return `${location.pathname}?${params}${location.hash ?? ''}`;
}

/** One answer of the open flow (`do-squad` → 12), as a positive number. */
export function actionNumber(params: URLSearchParams, name: string) {
    const value = Number(params.get(`${PREFIX}${name}`));
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
export const actionText = (params: URLSearchParams, name: string) => params.get(`${PREFIX}${name}`) ?? undefined;
