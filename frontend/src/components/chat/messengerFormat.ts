import type { ConversationDto } from '../../api/chat';
import { formatDate, formatTime as formatClockTime } from '../../utils/formatting';

export function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return formatClockTime(d);
    return formatDate(d, { month: 'short', day: 'numeric' });
}

export function isSharedConversation(conv: ConversationDto): boolean {
    return conv.contextType !== 'DIRECT';
}
