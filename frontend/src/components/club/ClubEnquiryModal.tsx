import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MessageSquare, X } from 'lucide-react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import { extractApiErrorMessage } from '../../utils/apiError';
import { enquiryPriority, staffTitle, type ClubEnquiryContext, type PublicStaff } from '../../features/clubs/publicJourney';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { enquiryReasons } from '../../features/clubs/enquiryMessage';

export function ClubEnquiryModal({ clubId, clubName, context, onClose }: { clubId: number; clubName: string; context: ClubEnquiryContext; onClose: () => void }) {
  const { status, sessionId, user } = useAuth();
  const navigate = useNavigate(), heading = useId();
  const dialog = useRef<HTMLDivElement>(null), sending = useRef(false), alive = useRef(true);
  const requestClose = () => { if (!sending.current) onClose(); };
  useDialogFocus(true, dialog, requestClose);
  const [people, setPeople] = useState<PublicStaff[] | null>(null), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const [recipient, setRecipient] = useState(''), [body, setBody] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [reason,setReason]=useState(''),[age,setAge]=useState('');
  const [sent, setSent] = useState<number | null>(null);
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const prefix = `Enquiry: ${context.name.replaceAll('\n',' ')}\n${clubName.replaceAll('\n',' ')}\n${new URL(context.path, window.location.origin).href}\nReason: ${reason}\n${age?`Player age: ${age}\n`:''}\n`;
  const bodyLimit = Math.max(0, 2000 - prefix.length);
  useEffect(() => {
    alive.current = true; const controller = new AbortController();
    const config: AuthSessionRequestConfig = { signal: controller.signal, _authSessionId: sessionId };
    void apiClient.get<PublicStaff[]>(`/clubs/${clubId}/staff-directory`, config).then(r => {
      if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) { setPeople(r.data.filter(p => p.userId !== user?.id)); setLoadError(''); }
    }).catch(e => { if (!controller.signal.aborted) setLoadError(extractApiErrorMessage(e, 'Contacts could not load.')); });
    return () => { alive.current = false; controller.abort(); };
  }, [clubId, sessionId, user?.id, retry]);
  const contacts = [...(people ?? [])].sort((a, b) => enquiryPriority(a, context.squadIds) - enquiryPriority(b, context.squadIds) || a.fullName.localeCompare(b.fullName));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending.current || status !== 'authenticated' || !isCurrentAuthSession(sessionId) || !contacts.some(p => String(p.userId) === recipient) || !enquiryReasons.some(r=>r===reason) || (age!==''&&(!/^\d{1,2}$/.test(age)||Number(age)<3)) || !body.trim()) return;
    const content = prefix + body.trim();
    if (content.length > 2000) { setError(`Keep your question within ${bodyLimit} characters.`); return; }
    const fingerprint = `${recipient}:${content}`;
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
    const clientMessageId = attempt.current.id;
    sending.current = true; setBusy(true); setError('');
    const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
    try {
      const conversation = await apiClient.post<{ id: number }>('/chat/conversations', { contextType: 'DIRECT', participantIds: [Number(recipient)] }, config);
      if (!alive.current || !isCurrentAuthSession(sessionId)) return;
      await apiClient.post(`/chat/conversations/${conversation.data.id}/messages`, { content, clientMessageId }, config);
      if (alive.current && isCurrentAuthSession(sessionId)) setSent(conversation.data.id);
    } catch (e) {
      if (alive.current && isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(e, 'Delivery could not be confirmed. Retry this enquiry without changing it to avoid a duplicate.'));
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  const signIn = () => {
    const destination = new URL(context.path, window.location.origin);
    destination.searchParams.set('enquire', '1');
    navigate(buildLoginRedirectPath(destination.pathname, destination.search, destination.hash));
  };
  return <div className="cp-modal-backdrop" onClick={requestClose}><section className="club-public cp-enquiry" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={heading} onClick={e => e.stopPropagation()}>
    <header className="cp-enquiry-heading"><div><span className="cp-section-icon" data-tone="blue"><MessageSquare size={21}/></span><h2 id={heading}>{sent ? 'Enquiry sent' : 'Ask the club'}</h2></div><button type="button" className="cp-icon-button" aria-label="Close enquiry" disabled={busy} onClick={requestClose}><X size={20}/></button></header>
    {sent ? <div className="cp-enquiry-body"><CheckCircle2 size={34} className="cp-success"/><h3>Your conversation has started</h3><p>Your message includes {context.name} and its page link, so the recipient has the context.</p><button className="cp-button cp-button-primary" onClick={() => navigate(`/messages?conversationId=${sent}`)}>Open conversation<ArrowRight size={16}/></button></div> : <form onSubmit={e => void submit(e)} className="cp-enquiry-body">
      <div className="cp-enquiry-context"><span className="cp-eyebrow">About this enquiry</span><strong>{context.name}</strong><span>{clubName}</span></div>
      {status !== 'authenticated' ? <><p>Sign in to send a message to the club’s staff and keep their reply in your inbox.</p><button type="button" className="cp-button cp-button-primary" onClick={signIn}>Sign in to enquire<ArrowRight size={16}/></button></> : <>
        {loadError ? <p role="alert">{loadError} <button type="button" className="cp-text-button" onClick={() => setRetry(v => v + 1)}>Retry contacts</button></p> : people === null ? <p role="status">Loading contacts…</p> : contacts.length === 0 ? <p>No other public staff contacts are available. Use the contact details on the club page.</p> : <fieldset disabled={busy} className="cp-enquiry-fields">
          <label>What would you like help with?<select aria-label="Enquiry reason" required value={reason} onChange={e=>setReason(e.target.value)}><option value="">Choose a reason</option>{enquiryReasons.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
          <label>Player’s age <span>(optional)</span><input aria-label="Player age" type="number" min="3" max="99" value={age} onChange={e=>setAge(e.target.value)}/></label>
          <label>Send to<select aria-label="Send to" required value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Choose a staff contact</option>{contacts.map(p => <option key={p.userId} value={p.userId}>{p.fullName} · {staffTitle(p)}</option>)}</select></label>
          <p className="cp-muted">Contacts responsible for this training group appear first. This message goes to the selected person.</p>
          <label>Your question<textarea required rows={5} maxLength={bodyLimit} placeholder="Ask about availability, training or arranging a first visit…" value={body} onChange={e => setBody(e.target.value)}/></label>
          <p className="cp-muted">The programme or squad link is included. A place is confirmed separately by the club.</p>
          {error && <p role="alert" className="cp-error">{error}</p>}
          <button className="cp-button cp-button-primary" type="submit" disabled={!recipient || !reason || !body.trim() || busy}>{busy ? 'Sending…' : 'Send enquiry'}<ArrowRight size={16}/></button>
        </fieldset>}
      </>}
    </form>}
  </section></div>;
}
