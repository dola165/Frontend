import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { Button, Chip } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { submitClubEnquiry } from '../../joining-contract/api';
import type { ConnectedInquiry } from '../../joining-contract/types';
import type { Opportunity } from '../../admissions/types';
import type { TrainingProgramme } from '../../clubs/presentation';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useWorldChild } from '../players';
import { firstLine, parentName } from './waysIn';
import './finder.css';

/**
 * Ask the club, always there, inside the open club: today's enquiry, for the child, about a group when asked from one,
 * with the first line already written (naming the group, or the programme that fits when asked from World). It carries
 * what it is about, so it reaches the right squad's Want to join: the group and its squad, or the programme (and its
 * squad when it has one; with several the club routes it). When several programmes fit, the first is chosen and the
 * others are a press away.
 */
export function AskTheClub({ club, group, programmes = [], onClose }: { club: ClubProfile; group: Opportunity | null; programmes?: TrainingProgramme[]; onClose: () => void }) {
    const copy = useJourneyCopy();
    const { sessionId, status } = useAuth();
    const { child } = useWorldChild();
    const id = useId();
    const birthYear = child?.dateOfBirth ? Number(child.dateOfBirth.slice(0, 4)) : null;
    const offered = group ? [] : programmes.filter(programme => programme.id != null);
    const [programmeId, setProgrammeId] = useState(offered[0]?.id ?? null);
    const programme = offered.find(item => item.id === programmeId) ?? null;
    const written = (about: TrainingProgramme | null) => firstLine(copy, child ? { name: child.name, gender: child.gender, birthYear } : null,
        group ? parentName(group.name) ?? group.name : about ? parentName(about.name) ?? about.name : undefined);
    const [message, setMessage] = useState(() => written(programme));
    // Another programme rewrites the first line only while the parent has not changed it.
    const choose = (next: TrainingProgramme) => { if (message === written(programme)) setMessage(written(next)); setProgrammeId(next.id ?? null); };
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState<ConnectedInquiry | null>(null);
    const request = useRef<{ key: string; id: string } | null>(null);
    if (status !== 'authenticated') return <p className="gk-faint">{copy('Sign in to message the club.', 'კლუბისთვის მისაწერად შედით.')}</p>;
    const send = async () => {
        const text = message.trim();
        if (!text || busy) return;
        const key = JSON.stringify([club.id, group?.id ?? null, programme?.id ?? null, child?.id ?? null, text]);
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        setBusy(true); setError('');
        const squadId = group ? group.squadId ?? null : programme?.squadIds?.length === 1 ? programme.squadIds[0] : null;
        try { setSent(await submitClubEnquiry(club.id, { requestId: request.current.id, playerId: child?.id ?? null, groupId: group?.id ?? null, programmeId: programme?.id ?? null, squadId, message: text }, sessionId)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Couldn’t send · Try again', 'ვერ გაიგზავნა · სცადეთ ხელახლა'))); }
        finally { setBusy(false); }
    };
    if (sent) return <div className="gk-finder-done" role="status"><Check aria-hidden="true" /><span><strong>{copy('Sent to the club', 'კლუბს გაეგზავნა')}</strong>
        <small>{copy('They answer you in Messages.', 'პასუხს შეტყობინებებში მიიღებთ.')}</small>
        {sent.conversationDestination && <Link className="gk-section__action" to={sent.conversationDestination}>{copy('Open the conversation', 'საუბრის გახსნა')}</Link>}</span></div>;
    return <form className="gk-finder-ask" onSubmit={event => { event.preventDefault(); void send(); }} data-guide="ask-form">
        {offered.length > 1 && <div className="gk-chips" role="radiogroup" aria-label={copy('About', 'რის შესახებ')}>
            {offered.map(item => <Chip key={item.id} pressed={item.id === programmeId} onClick={() => choose(item)}>{parentName(item.name) ?? item.name}</Chip>)}
        </div>}
        <label className="gk-field" htmlFor={`${id}-message`}><span className="gk-field__label">{group ? copy(`Ask ${club.name} about ${group.name}`, `ჰკითხეთ ${club.name}-ს ${group.name}-ის შესახებ`) : copy(`Ask ${club.name}`, `ჰკითხეთ ${club.name}-ს`)}</span>
            <textarea id={`${id}-message`} className="gk-input" rows={3} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} /></label>
        {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        <div className="gk-finder-acts">
            <Button type="submit" size="sm" variant="primary" disabled={busy || !message.trim()}>{copy('Send', 'გაგზავნა')}</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>{copy('Not now', 'ახლა არა')}</Button>
        </div>
    </form>;
}
