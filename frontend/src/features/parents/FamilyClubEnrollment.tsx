import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { previewPlayerLinkCode, redeemPlayerLinkCode } from '../joining-contract/api';
import type { LinkCodePreview, LinkCodeResult, RedeemLinkCode } from '../joining-contract/types';
import './family-relationships.css';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** Codes remain only in this mounted form; possession does not accept group terms. */
export function FamilyClubEnrollment({ clubId, onLinked, canContinueWithoutGroup = true }: { clubId: number; onLinked: (result: LinkCodeResult) => void; canContinueWithoutGroup?: boolean }) {
  const { sessionId } = useAuth();
  const copy=useJourneyCopy();
  const [code, setCode] = useState(''), [group, setGroup] = useState('');
  const [preview, setPreview] = useState<LinkCodePreview | null>(null), [receipt, setReceipt] = useState<LinkCodeResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const locked = useRef(false), alive = useRef(true), attempt = useRef<RedeemLinkCode | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && isCurrentAuthSession(sessionId);
  const groupOptional = canContinueWithoutGroup || preview?.status === 'ALREADY_LINKED';
  const check = async () => {
    if (locked.current || !code.trim()) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await previewPlayerLinkCode(clubId, code.trim(), sessionId);
      if (current()) { setPreview(result); setGroup(''); }
    } catch (failure) { if (current()) { setPreview(null); setError(extractApiErrorMessage(failure, copy('This code is unavailable. Ask the guardian to check its expiry and club, or share a new code.','კოდი მიუწვდომელია. სთხოვეთ მეურვეს შეამოწმოს ვადა და კლუბი, ან ახალი კოდი გააზიაროს.'))); } }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const link = async () => {
    if (locked.current || !preview || !isCurrentAuthSession(sessionId)) return;
    if (!attempt.current) {
      const selected = preview.options.find(option => String(option.id) === group);
      if (!groupOptional && !selected) { setError(copy('Choose the agreed group within your responsibility, or ask club leadership to continue the general conversation.','აირჩიეთ თქვენი პასუხისმგებლობის ფარგლებში შეთანხმებული ჯგუფი ან სთხოვეთ ხელმძღვანელობას საუბრის გაგრძელება.')); return; }
      attempt.current = { requestId: crypto.randomUUID(), code: code.trim(), groupId: selected?.id ?? null, groupVersion: selected?.version ?? null };
    }
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await redeemPlayerLinkCode(clubId, attempt.current, sessionId);
      if (current()) { setReceipt(result); setCode(''); setUncertain(false); attempt.current = null; onLinked(result); }
    } catch (failure) {
      if (current()) {
        const status = (failure as { response?: { status?: number } })?.response?.status;
        setUncertain(status === undefined || status >= 500);
        if (status !== undefined && status < 500) attempt.current = null;
        setError(extractApiErrorMessage(failure, copy('The reply was interrupted. Retry this same link to recover the recorded result.','პასუხი შეწყდა. დაფიქსირებული შედეგის მისაღებად გაიმეორეთ იგივე დაკავშირება.')));
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="family-club-enrollment" aria-label={copy('Link a player with a guardian code','მოთამაშის დაკავშირება მეურვის კოდით')}>
    <h2>{copy('Have a parent’s code?','გაქვთ მშობლის კოდი?')}</h2><p>{copy('After speaking with the family, use their short-lived Parent Hub code to continue with the same child. A visit, group place and participation terms are agreed separately.','ოჯახთან საუბრის შემდეგ იმავე ბავშვთან გასაგრძელებლად გამოიყენეთ მშობლის სივრცის დროებითი კოდი. ვიზიტი, ადგილი და მონაწილეობის პირობები ცალკე თანხმდება.')}</p>
    {receipt ? <div role="status"><strong>{receipt.status === 'ALREADY_LINKED' || receipt.status === 'RESUMED' ? copy('Existing arrangement found','არსებული შეთანხმება მოიძებნა') : copy('Player linked to intake','მოთამაშე მიღებას დაუკავშირდა')}</strong><p>{copy('Continue the request to arrange the next step.','შემდეგ ნაბიჯზე შესათანხმებლად გააგრძელეთ მოთხოვნა.')}</p><Link className="prf-button" to={receipt.staffDestination}>{copy('Open player intake','მოთამაშის მიღების გახსნა')}</Link>{receipt.conversationDestination&&<Link className="prf-button" to={receipt.conversationDestination}>{copy('Open connected conversation','დაკავშირებული საუბრის გახსნა')}</Link>}</div> : <>
      <form onSubmit={event => { event.preventDefault(); void check(); }}><label>{copy('Enrollment code','გაწევრიანების კოდი')}<input value={code} onChange={event => { setCode(event.target.value); setPreview(null); attempt.current = null; }} required maxLength={100} autoComplete="off" spellCheck={false} disabled={busy || uncertain} /></label><button type="submit" className="prf-button" disabled={busy || uncertain || !code.trim()}>{busy && !preview ? copy('Checking…','მოწმდება…') : copy('Check code','კოდის შემოწმება')}</button></form>
      {preview && <form onSubmit={event => { event.preventDefault(); void link(); }}><h3>{preview.playerName}</h3><p>{preview.status === 'ALREADY_LINKED' ? copy('This code was already used here. Recover its linked arrangement.','კოდი აქ უკვე გამოყენებულია. აღადგინეთ დაკავშირებული შეთანხმება.') : preview.existingCaseId || preview.existingInquiryId ? copy('A joining arrangement already exists here. Continue it, or select another group you have agreed with the family.','გაწევრიანების შეთანხმება უკვე არსებობს. გააგრძელეთ იგი ან აირჩიეთ ოჯახთან შეთანხმებული სხვა ჯგუფი.') : copy('Choose a group you have agreed to discuss, or continue the conversation before selecting a group.','აირჩიეთ ჯგუფი, რომლის განხილვაზეც შეთანხმდით, ან ჯგუფის არჩევამდე გააგრძელეთ საუბარი.')}</p>
        <label>{copy('Group','ჯგუფი')} {groupOptional && <span>{copy('(optional)','(არასავალდებულო)')}</span>}<select required={!groupOptional} value={group} onChange={event => setGroup(event.target.value)} disabled={busy || uncertain || preview.status === 'ALREADY_LINKED'}><option value="">{groupOptional ? copy('Continue the current conversation or request','მიმდინარე საუბრის ან მოთხოვნის გაგრძელება') : copy('Choose the agreed group','აირჩიეთ შეთანხმებული ჯგუფი')}</option>{preview.options.map(option => <option key={option.id} value={option.id} disabled={option.availability === 'CLOSED'}>{option.name} · {option.availability === 'CLOSED' ? copy('intake closed','მიღება დახურულია') : option.availability === 'WAITLIST' ? copy('waiting list','მოლოდინის სია') : `${option.remainingPlaces} ${copy('places','ადგილი')}`}</option>)}</select></label>
        <p>{copy('Code expires','კოდის მოქმედების ვადა')} {new Date(preview.expiresAt).toLocaleString()}. {copy('Linking does not enroll this player or grant consent.','დაკავშირება მოთამაშეს არ რიცხავს და თანხმობას არ ნიშნავს.')}</p><button type="submit" className="prf-button" disabled={busy}>{busy ? copy('Linking…','კავშირდება…') : uncertain ? copy('Retry the same link','იგივე დაკავშირების გამეორება') : copy('Continue with this player','ამ მოთამაშესთან გაგრძელება')}</button>
      </form>}
      {error && <p role="alert" className="family-error">{error}</p>}
      {uncertain && <p role="status">{copy('Keep this form open and retry to check the saved result.','შენახული შედეგის შესამოწმებლად დატოვეთ ფორმა ღია და გაიმეორეთ.')}</p>}
    </>}
  </section>;
}
