import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { Button, Field, GkRoot, PageFrame, PageHeader, Section, Skeleton } from '../design/primitives';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../utils/apiError';

interface Received {
    id: number; clubId: number; clubName: string; status: string; description: string; immediateAction: string; resolution: string;
    childName: string | null; reporterName: string; createdAt: string; grassKickZ: boolean; canClose: boolean;
}

/**
 * A confidential concern, for whoever received it: the club's Owner when no welfare officer is named, or GrassKickZ's team
 * for one that names the Owner. Nobody else opens it. They read it, say what they did, and close it; whoever raised it hears
 * that it was dealt with, and no more than that.
 */
export default function ConcernReceivedPage() {
    const copy = useJourneyCopy();
    const { id, concernId } = useParams();
    const [concern, setConcern] = useState<Received | null>(null);
    const [error, setError] = useState(''), [closing, setClosing] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        apiClient.get<Received>(`/clubs/${id}/operations/concerns/${concernId}`, { signal: abort.signal })
            .then(response => { if (!abort.signal.aborted) setConcern(response.data); })
            .catch(failure => { if (!abort.signal.aborted) setError(extractApiErrorMessage(failure, copy('This concern is for someone else.', 'ეს შეტყობინება სხვისთვისაა.'))); });
        return () => abort.abort();
    }, [id, concernId, copy]);
    const close = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try {
            await apiClient.post(`/clubs/${id}/operations/concerns/${concernId}/close`, { resolution: closing.trim() });
            setConcern(current => current && { ...current, status: 'CLOSED', canClose: false, resolution: closing.trim() });
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('Couldn’t save. Your words are still here.', 'ვერ შეინახა. ტექსტი ისევ აქ არის.'))); }
        finally { setBusy(false); }
    };
    return <GkRoot className="gk-page"><PageFrame width="profile">
        <PageHeader title={copy('Confidential concern', 'კონფიდენციალური შეტყობინება')} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {!concern && !error && <Skeleton height={220} />}
        {concern && <Section boxed icon={ShieldAlert} title={concern.clubName} hint={new Date(concern.createdAt).toLocaleDateString()}>
            <p className="gk-notice">{concern.grassKickZ
                ? copy('It reached GrassKickZ because it names the club’s owner. The owner can’t read it.', 'ის GrassKickZ-ს მიუვიდა, რადგან კლუბის მფლობელს ასახელებს. მფლობელი მას ვერ წაიკითხავს.')
                : copy('Only you can read this, because no welfare officer is named. If a child is in danger now, call the emergency services first.', 'ამას მხოლოდ თქვენ ხედავთ, რადგან ბავშვთა დაცვის ოფიცერი დანიშნული არ არის. თუ ბავშვი ახლა საფრთხეშია, ჯერ სასწრაფო სამსახურს დაურეკეთ.')}</p>
            <p><strong>{copy('Raised by: ', 'შემტყობინებელი: ')}</strong>{concern.reporterName}{concern.childName ? <> · <strong>{copy('About: ', 'ეხება: ')}</strong>{concern.childName}</> : null}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{concern.description}</p>
            {concern.immediateAction && <p style={{ whiteSpace: 'pre-wrap' }}><strong>{copy('Already done: ', 'უკვე გაკეთდა: ')}</strong>{concern.immediateAction}</p>}
            {concern.canClose
                ? <form onSubmit={event => void close(event)}>
                    <Field label={copy('What did you do?', 'რა გააკეთეთ?')} htmlFor="concern-closing">
                        <textarea id="concern-closing" className="gk-input" required maxLength={4000} rows={4} value={closing} disabled={busy} onChange={event => setClosing(event.target.value)} /></Field>
                    <Button variant="primary" type="submit" disabled={busy || !closing.trim()}>{copy('Close it', 'დახურვა')}</Button>
                </form>
                : <p><strong>{copy('Closed: ', 'დახურულია: ')}</strong>{concern.resolution}</p>}
        </Section>}
    </PageFrame></GkRoot>;
}
