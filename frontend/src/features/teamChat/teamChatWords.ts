import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { monthName } from '../teamWork/teamWorkWords';
import type { ChatStatus, ChatSummary } from './api';

export type Copy = ReturnType<typeof useJourneyCopy>;

const pad = (value: number) => String(value).padStart(2, '0');
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "14:05", the same in both languages (never "AM/PM"). */
export const clock = (value: string) => { const date = new Date(value); return `${pad(date.getHours())}:${pad(date.getMinutes())}`; };

/** A day heading: Today, Yesterday, or "Thursday 22 October" (with the year when it is not this year). */
export function dayTitle(copy: Copy, value: string, now = new Date()) {
    const date = new Date(value);
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
    if (days === 0) return copy('Today', 'დღეს');
    if (days === 1) return copy('Yesterday', 'გუშინ');
    const weekday = copy(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
        ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'][date.getDay()]);
    const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
    return `${weekday}, ${date.getDate()} ${monthName(copy, date.getMonth())}${year}`;
}

/** "Thursday, 22 October, 14:05": a message's full time, for its hover title. */
export const fullTime = (copy: Copy, value: string) => `${dayTitle(copy, value)}, ${clock(value)}`;

/** "22 October": a day, short, for the chat list and Recently deleted. */
export const shortDay = (copy: Copy, value: string, now = new Date()) => {
    const date = new Date(value);
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
    if (days === 0) return clock(value);
    if (days === 1) return copy('Yesterday', 'გუშინ');
    return `${date.getDate()} ${monthName(copy, date.getMonth())}`;
};

/**
 * Who may delete a chat, or restore it, for those who may not: the person who started it or a team admin (only an
 * admin for the chat the team had before there were several, which nobody started).
 */
export const onlyDeleters = (copy: Copy, chat: Pick<ChatSummary, 'createdBy'>, what: 'delete' | 'restore') => {
    const starter = chat.createdBy?.name;
    if (what === 'delete') return starter
        ? copy(`Only ${starter}, who started it, or a team admin can delete it.`, `წაშლა შეუძლია მხოლოდ ჩატის დამწყებს (${starter}) ან გუნდის ადმინს.`)
        : copy('Only a team admin can delete it.', 'წაშლა შეუძლია მხოლოდ გუნდის ადმინს.');
    return starter
        ? copy(`Only ${starter}, who started it, or a team admin can restore it.`, `აღდგენა შეუძლია მხოლოდ ჩატის დამწყებს (${starter}) ან გუნდის ადმინს.`)
        : copy('Only a team admin can restore it.', 'აღდგენა შეუძლია მხოლოდ გუნდის ადმინს.');
};

/** "on 1 November" / "1 ნოემბერს": a day something happens on (Georgian takes the dative). */
export const onDate = (copy: Copy, value: string) => {
    const date = new Date(value);
    const month = monthName(copy, date.getMonth());
    return copy(`on ${date.getDate()} ${month}`, `${date.getDate()} ${month.endsWith('ი') ? `${month.slice(0, -1)}ს` : `${month}ს`}`);
};

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

export const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The three statuses, as a word. */
export const STATUSES: ChatStatus[] = ['TALKING', 'DECIDED', 'ON_HOLD'];
export const statusWord = (copy: Copy, status: ChatStatus) =>
    status === 'DECIDED' ? copy('Decided', 'გადაწყდა') : status === 'ON_HOLD' ? copy('On hold', 'შეჩერებული') : copy('Talking', 'ვსაუბრობთ');

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
export const isMissing = (error: unknown) => statusOf(error) === 404;
/** No answer at all, or the server or connection is in trouble: worth trying again by itself. */
export const isPassing = (error: unknown) => { const status = statusOf(error); return status === undefined || status === 401 || status === 408 || status === 429 || status >= 500; };

/** Why deleting a chat, or restoring it, is refused: only the person who started it or a team admin may. */
export const DELETE_FORBIDDEN: [string, string] = ['Only the person who started this chat or a team admin can delete it.', 'ჩატის წაშლა შეუძლია მხოლოდ მის დამწყებს ან გუნდის ადმინს.'];
export const RESTORE_FORBIDDEN: [string, string] = ['Only the person who started this chat or a team admin can restore it.', 'ჩატის აღდგენა შეუძლია მხოლოდ მის დამწყებს ან გუნდის ადმინს.'];
/** Why changing a message is refused: only the person who wrote it may. */
export const WRITER_FORBIDDEN: [string, string] = ['Only the person who wrote it can change or delete it.', 'შეცვლა ან წაშლა მხოლოდ ავტორს შეუძლია.'];

/**
 * What went wrong, in our words (the server's own words are English). `forbidden` is the true reason a 403 has for
 * this action; without one, a plain "not allowed".
 */
export function problem(copy: Copy, error: unknown, what: [en: string, ka: string], forbidden?: [en: string, ka: string]) {
    const status = statusOf(error);
    if (status === undefined) return copy(`${what[0]} No connection; it will be tried again.`, `${what[1]} კავშირი არ არის; ხელახლა ვცდით.`);
    if (status === 403) return forbidden
        ? copy(`${what[0]} ${forbidden[0]}`, `${what[1]} ${forbidden[1]}`)
        : copy(`${what[0]} You are not allowed to do that.`, `${what[1]} ეს თქვენ არ შეგიძლიათ.`);
    if (status === 404) return copy(`${what[0]} It is no longer here.`, `${what[1]} აღარ არსებობს.`);
    if (status === 409) return copy(`${what[0]} This chat is in Recently deleted; restore it first.`, `${what[1]} ეს ჩატი ბოლოს წაშლილებშია; ჯერ აღადგინეთ.`);
    if (status === 413) return copy(`${what[0]} It is too large.`, `${what[1]} ზედმეტად დიდია.`);
    if (status >= 500) return copy(`${what[0]} The server had a problem; try again.`, `${what[1]} სერვერზე შეფერხებაა; სცადეთ ხელახლა.`);
    return copy(`${what[0]} Check it and try again.`, `${what[1]} შეამოწმეთ და სცადეთ ხელახლა.`);
}
