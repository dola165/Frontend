import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { askAdminPath } from '../../api/access';
import './ask-admin.css';

/**
 * Where a button is refused: the server's plain reason, and "Ask the admin" (one tap, a direct message) when the
 * rule-checker said asking helps and named an admin. Nothing else to fill in or wait for.
 */
export function AskAdmin({ reason, admin, compact = false }: { reason?: string | null; admin?: { userId: number; name: string } | null; compact?: boolean }) {
    const copy = useJourneyCopy();
    if (!reason && !admin) return null;
    return <span className={`gk-ask-admin${compact ? ' gk-ask-admin--compact' : ''}`}>
        {reason && <span className="gk-faint">{reason}</span>}
        {admin && <Link className="gk-btn gk-btn--sm gk-btn--ghost" to={askAdminPath(admin)}><MessageSquare aria-hidden="true" />{copy('Ask the admin', 'ადმინთან მიწერა')}</Link>}
    </span>;
}
