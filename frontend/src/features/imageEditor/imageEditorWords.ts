import type { useJourneyCopy } from '../squadCommunication/journeyCopy';

export type Copy = ReturnType<typeof useJourneyCopy>;

/** "2 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function editedAgo(copy: Copy, value: string, now = new Date()) {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return '';
    const minutes = Math.round((now.getTime() - at.getTime()) / 60000);
    if (minutes < 1) return copy('just now', 'ახლახან');
    if (minutes < 60) return copy(`${minutes} min ago`, `${minutes} წთ-ის წინ`);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return copy(`${hours} h ago`, `${hours} სთ-ის წინ`);
    const days = Math.round(hours / 24);
    if (days === 1) return copy('yesterday', 'გუშინ');
    if (days < 7) return copy(`${days} days ago`, `${days} დღის წინ`);
    return at.toLocaleDateString(copy('en-GB', 'ka-GE'), { day: 'numeric', month: 'short' });
}
