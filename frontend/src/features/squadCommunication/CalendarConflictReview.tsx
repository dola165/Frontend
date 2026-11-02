import { formatDateTime } from '../../utils/formatting';
import type { CalendarConflict } from './api';

export function CalendarConflictReview({ conflicts }: { conflicts?: CalendarConflict[] }) {
    if (!conflicts?.length) return null;
    return <div className="squad-plan-error" role="alert"><p>These dates overlap the squad’s schedule. Choose another time before confirming.</p>
        <ul>{conflicts.map((item, i) => <li key={`${item.sessionId}:${item.source}:${item.sourceId}:${i}`}><strong>{item.title}</strong> · {formatDateTime(item.startsAt)} – {formatDateTime(item.endsAt)}</li>)}</ul>
    </div>;
}
