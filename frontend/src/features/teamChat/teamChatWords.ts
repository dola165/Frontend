import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { monthName } from '../teamWork/teamWorkWords';

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

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

export const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
export const isMissing = (error: unknown) => statusOf(error) === 404;
/** No answer at all, or the server or connection is in trouble: worth trying again by itself. */
export const isPassing = (error: unknown) => { const status = statusOf(error); return status === undefined || status === 401 || status === 408 || status === 429 || status >= 500; };

/** What went wrong, in our words (the server's own words are English). */
export function problem(copy: Copy, error: unknown, what: [en: string, ka: string]) {
    const status = statusOf(error);
    if (status === undefined) return copy(`${what[0]} No connection; it will be tried again.`, `${what[1]} კავშირი არ არის; ხელახლა ვცდით.`);
    if (status === 403) return copy(`${what[0]} Only its writer can do that.`, `${what[1]} ეს მხოლოდ ავტორს შეუძლია.`);
    if (status === 404) return copy(`${what[0]} It is no longer here.`, `${what[1]} აღარ არსებობს.`);
    if (status === 413) return copy(`${what[0]} It is too large.`, `${what[1]} ზედმეტად დიდია.`);
    if (status >= 500) return copy(`${what[0]} The server had a problem; try again.`, `${what[1]} სერვერზე შეფერხებაა; სცადეთ ხელახლა.`);
    return copy(`${what[0]} Check it and try again.`, `${what[1]} შეამოწმეთ და სცადეთ ხელახლა.`);
}
