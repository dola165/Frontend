import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { createPlayerLinkCode } from '../joining-contract/api';
import type { CreateLinkCode, LinkCode, JoiningChild } from '../joining-contract/types';
import { useAdmissionMutation } from '../admissions/applicant/useAdmissionMutation';
import { AdmissionError } from '../admissions/applicant/AdmissionFrame';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';

export function PlayerLinkCode({ child, onChanged }: { child: JoiningChild; onChanged?: () => void }) {
    const { sessionId } = useAuth(); const copy = useJourneyCopy();
    const [code, setCode] = useState<LinkCode | null>(null);
    const [club, setClub] = useState<number | undefined>();
    const [notice, setNotice] = useState(''); const [error, setError] = useState('');
    const [revoking, setRevoking] = useState(false);
    useEffect(() => {
        const hideCode = () => { if (document.visibilityState === 'hidden') setCode(null); };
        document.addEventListener('visibilitychange', hideCode);
        return () => document.removeEventListener('visibilitychange', hideCode);
    }, []);
    const clubs = new Map(child.clubs.map(c => [c.clubId, c.clubName]));
    child.cases.forEach(c => { if (c.clubId) clubs.set(c.clubId, c.organizationName); });
    const mutation = useAdmissionMutation<Omit<CreateLinkCode, 'requestId'>, LinkCode>(child.playerId, 'link-code',
        body => createPlayerLinkCode(child.playerId, body, sessionId), result => { setCode(result); setNotice(''); onChanged?.(); });
    async function copyCode() {
        if (!code) return;
        try {
            if (!navigator.clipboard) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(code.code);
            setNotice(copy('Code copied.', 'კოდი დაკოპირდა.'));
        } catch { setNotice(copy('Select the code and copy it manually.', 'მონიშნეთ კოდი და დააკოპირეთ ხელით.')); }
    }
    async function cancel() {
        if (!code || revoking) return; setRevoking(true); setError('');
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
            await apiClient.post(`/family/enrollment-codes/${code.id}/cancel`, {}, config);
            if (isCurrentAuthSession(sessionId)) { setCode(null); setNotice(copy('Code cancelled.', 'კოდი გაუქმდა.')); onChanged?.(); }
        } catch (e) { if (isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(e, copy('The code could not be cancelled. Try again.', 'კოდი ვერ გაუქმდა. სცადეთ ხელახლა.'))); }
        finally { setRevoking(false); }
    }
    return <details id="share-player-code" className="parent-panel parent-link-code"><summary>{copy('Spoken to a club? Share a linking code', 'უკვე ესაუბრეთ კლუბს? გაუზიარეთ დაკავშირების კოდი')}</summary>
        <p>{copy(`Let the chosen club link ${child.identity.fullName}’s existing player details to your joining conversation. You will still review the visit or place separately.`, `არჩეულ კლუბს შეუძლია ${child.identity.fullName}-ის არსებული პროფილი საუბარს დაუკავშიროს. ვიზიტსა თუ ადგილს ცალკე განიხილავთ.`)}</p>
        {clubs.size > 0 && <label>{copy('Who can use this code?', 'ვის შეუძლია კოდის გამოყენება?')}<select value={club || ''} disabled={mutation.busy || Boolean(mutation.pending)} onChange={e => setClub(Number(e.target.value) || undefined)}><option value="">{copy('The club I share it with', 'კლუბი, რომელსაც გავუზიარებ')}</option>{[...clubs].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
        {mutation.error && <AdmissionError message={mutation.error} />}{error && <AdmissionError message={error} />}
        {mutation.pending && <p>{copy('The reply was not confirmed. Retry to retrieve the same code.', 'პასუხი დაუდასტურებელია. იგივე კოდის მისაღებად გაიმეორეთ მოთხოვნა.')}</p>}
        <button type="button" className="parent-button" disabled={mutation.busy || revoking} onClick={() => { setNotice(''); void (mutation.pending ? mutation.retry() : mutation.run({ clubId: club ?? null })); }}>{mutation.busy ? copy('Creating…', 'იქმნება…') : mutation.pending ? copy('Retry code creation', 'კოდის შექმნის გამეორება') : code ? copy('Create a replacement code', 'ახალი კოდის შექმნა') : copy('Create linking code', 'დაკავშირების კოდის შექმნა')}</button>
        {code && <div className="parent-code-result"><label>{copy('Share directly with the chosen club', 'გაუზიარეთ უშუალოდ არჩეულ კლუბს')}<input readOnly value={code.code} aria-label={copy('Linking code', 'დაკავშირების კოდი')} onFocus={e => e.target.select()} /></label><p>{copy('Expires', 'მოქმედებს')} {new Date(code.expiresAt).toLocaleString()}</p><div className="parent-header-actions"><button type="button" className="parent-button" onClick={() => void copyCode()}>{copy('Copy code', 'კოდის კოპირება')}</button><button type="button" className="parent-button" disabled={revoking} onClick={() => void cancel()}>{copy('Cancel code', 'კოდის გაუქმება')}</button></div></div>}
        {notice && <p role="status">{notice}</p>}
        <small>{copy('Keep the code private. A replacement cancels your earlier unused code. Sharing does not accept fees or a place.', 'კოდი პირადია. ახალი კოდი აუქმებს თქვენს წინა გამოუყენებელ კოდს. გაზიარება გადასახადზე ან ადგილზე თანხმობას არ ნიშნავს.')}</small>
    </details>;
}
