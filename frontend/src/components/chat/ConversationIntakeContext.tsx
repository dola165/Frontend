import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { JoiningConversationPanel } from './JoiningConversationPanel';
import { useAuth } from '../../context/AuthContext';
import { inquiryContinuation, useInquiryCopy } from '../../features/admissions/inquiryPresentation';
import { fetchConversationEnquiries } from '../../features/joining-contract/api';
import type { ConnectedInquiry } from '../../features/joining-contract/types';
import { isCurrentAuthSession } from '../../utils/authStorage';
import './message-actions.css';

type IntakeLink = { record: ConnectedInquiry; destination: string; staff: boolean };
/** Context comes from authorized persisted records, never from the message body. */
export function ConversationIntakeContext({ conversationId, messageRevision = '' }: { conversationId: number; messageRevision?: string | number }) {
  const { sessionId, user } = useAuth();
  const authorityRevision=JSON.stringify(user?.navigationCapabilities??null);
  const { copy } = useInquiryCopy();
  const [result, setResult] = useState<{ scope: string; links: IntakeLink[]; failed: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const scope = `${sessionId}:${user?.id}:${authorityRevision}:${conversationId}`;
  useEffect(() => {
    let current = true;
    const abort = new AbortController();
    void Promise.resolve().then(() => fetchConversationEnquiries(conversationId, sessionId, abort.signal)).then(records => {
      if (!current || !isCurrentAuthSession(sessionId)) return;
      const links = new Map<number, IntakeLink>();
      for (const record of records) {
        if (record.conversationId !== conversationId) continue;
        const { staff, destination } = inquiryContinuation(record);
        if (destination) links.set(record.id, { record, destination, staff });
      }
      setResult({ scope, links: [...links.values()], failed: false });
    }).catch(() => { if (current && isCurrentAuthSession(sessionId)) setResult({ scope, links: [], failed: true }); });
    return () => { current = false; abort.abort(); };
  }, [conversationId, sessionId, scope, messageRevision, retry]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible')setRetry(v=>v+1);},15000);return()=>window.clearInterval(timer);},[]);
  if (result?.scope !== scope) return null;
  if (result.failed) return <aside className="conversation-intake-context" role="status"><span>{copy('Connected enquiries could not load.', 'დაკავშირებული კითხვები ვერ ჩაიტვირთა.')}</span><button type="button" onClick={() => setRetry(value => value + 1)}>{copy('Retry enquiry context', 'დაკავშირებული კითხვების ხელახლა ჩატვირთვა')}</button></aside>;
  if (!result.links.length) return null;
  return <div aria-label={copy('Connected player enquiry', 'დაკავშირებული კითხვა მოთამაშის შესახებ')}>{result.links.map(({record,destination,staff})=><section key={`${sessionId}:${record.id}`}>
    <JoiningConversationPanel record={record} onChanged={()=>setRetry(value=>value+1)}/>
    <Link to={destination}>{staff ? copy('Open player arrangement','მოთამაშის შეთანხმების გახსნა') : copy('View enquiry & next step','კითხვის და შემდეგი ნაბიჯის ნახვა')}</Link>
  </section>)}</div>;
}
