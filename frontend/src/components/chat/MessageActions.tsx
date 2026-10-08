import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ReportControl } from '../../features/moderation/Reporting';
import './message-actions.css';

/** Safety stays available from the keyboard and touch without dominating each message. */
export function MessageActions({ messageId, conversationId, senderId }: { messageId: number; conversationId: number; senderId: number }) {
  const [open, setOpen] = useState(false);
  const id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[data-message-actions] button')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={root} className="message-actions" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && !document.querySelector('dialog[open]')) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label="Message actions" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}><MoreHorizontal size={16} aria-hidden="true" /></button>
    {open && <div id={id} data-message-actions className="message-actions-panel" role="group" aria-label="Message actions">
      <ReportControl targetType="MESSAGE" targetId={messageId} conversationId={conversationId} personId={senderId} className="message-action-report" />
    </div>}
  </div>;
}
