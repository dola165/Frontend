import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrangementEditor } from '../../features/matchExchange/ArrangementEditor';
import '../../features/matchExchange/match-exchange.css';
import { useClubPanelMotion } from '../../features/clubs/useClubPanelMotion';
export interface MatchChallengePayload {
    targetClubId: number;
    challengingSquadId?: number;
    targetSquadId?: number;
    matchType: 'FRIENDLY' | 'COMPETITIVE';
    proposedDate: string;
    location?: string;
    venuePreference?: 'HOME' | 'AWAY' | 'NEUTRAL' | 'FLEXIBLE';
    message?: string;
}

interface MatchInviteModalProps {
    sourceClubId: number;
    targetClubId: number;
    targetClubName: string;
    onClose: () => void;
    onSubmit: (inviteData: MatchChallengePayload) => Promise<void>;
}

export const MatchInviteModal = ({ sourceClubId, targetClubId, targetClubName, onClose }: MatchInviteModalProps) => {
  const motion = useClubPanelMotion(onClose);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = motion.close; }, [motion.close]);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary') ?? []).filter(item => item.getClientRects().length > 0);
        if (!items?.length) return;
        const first = items[0], last = items[items.length-1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<div className="schedule-bounded-workspace match-challenge-backdrop club-motion-backdrop" data-closing={motion.closing} role="dialog" aria-modal="true" aria-label={`Challenge ${targetClubName}`} ref={dialog} tabIndex={-1}><ArrangementEditor sourceClubId={sourceClubId} targetClubId={targetClubId} targetClubName={targetClubName} onClose={motion.close} /></div>, document.body);
};
