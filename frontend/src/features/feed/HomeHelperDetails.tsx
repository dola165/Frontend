import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { HelpingCard } from '../helpers/HelpingCard';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** Existing helper work stays reachable in place after the separate Home card is removed. */
export function HomeHelperDetails() {
    const copy = useJourneyCopy(); const { sessionId, status } = useAuth();
    const [params, setParams] = useSearchParams();
    const helper = params.get('helping'), session = params.get('helpingSession');
    const positive = (value: string | null) => value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
    const helperId = positive(helper), selectedSession = positive(session);
    if (status !== 'authenticated' || !helperId && !selectedSession) return null;
    return <Dialog open title={copy('Your session', 'თქვენი ვარჯიში')} closeLabel={copy('Close', 'დახურვა')} onClose={() => setParams(current => {
        const next = new URLSearchParams(current); next.delete('helping'); next.delete('helpingSession'); return next;
    })}><HelpingCard key={`${sessionId}:${helperId}:${selectedSession}`} helperId={helperId} sessionId={selectedSession} /></Dialog>;
}
