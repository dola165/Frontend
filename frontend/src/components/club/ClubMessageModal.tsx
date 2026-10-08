import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Loader2, MessageCircle, X } from 'lucide-react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { useClubPanelMotion } from '../../features/clubs/useClubPanelMotion';

export interface ClubCommunicationOption {
    id: 'WHATSAPP' | 'FACEBOOK_MESSENGER';
    label: string;
    description: string;
    url: string;
    isRecommended: boolean;
}
interface ClubContact { userId: number; fullName?: string | null; role?: string | null; title?: string | null }
interface ClubMessageModalProps {
    clubId: number;
    clubName: string;
    options: ClubCommunicationOption[];
    onClose: () => void;
    onOpenGrassKickZChat: (userId: number) => void;
}
const safeExternalUrl = (value: string) => {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
};
export const buildClubCommunicationOptions = (
    whatsappNumber?: string | null, facebookMessengerUrl?: string | null, preferredCommunicationMethod?: string | null
) => {
    const options: ClubCommunicationOption[] = [];
    const preferred = preferredCommunicationMethod?.toUpperCase() ?? null;
    const digits = whatsappNumber?.replace(/[^\d]/g, '');
    if (digits) options.push({ id: 'WHATSAPP', label: 'WhatsApp',
        description: 'Open the club’s WhatsApp contact.', url: `https://wa.me/${digits}`, isRecommended: preferred === 'WHATSAPP' });
    const messenger = facebookMessengerUrl?.trim() ? safeExternalUrl(facebookMessengerUrl.trim()) : null;
    if (messenger) options.push({ id: 'FACEBOOK_MESSENGER', label: 'Facebook / Messenger',
        description: 'Open the club’s external Facebook or Messenger page.', url: messenger, isRecommended: preferred === 'FACEBOOK_MESSENGER' });
    return options;
};
export const openClubCommunication = (option: ClubCommunicationOption) => {
    const url = safeExternalUrl(option.url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
};

export const ClubMessageModal = ({ clubId, clubName, options, onClose, onOpenGrassKickZChat }: ClubMessageModalProps) => {
    const motion = useClubPanelMotion(onClose);
    const { sessionId, status, user } = useAuth();
    const dialog = useRef<HTMLDivElement>(null);
    const heading = useId();
    useDialogFocus(true, dialog, motion.close);
    const [retry, setRetry] = useState(0);
    const requestKey = `${clubId}:${sessionId}:${user?.id}:${retry}`;
    const [result, setResult] = useState<{ key: string; contacts: ClubContact[]; failed: boolean } | null>(null);
    const current = result?.key === requestKey ? result : null;
    const contacts = current?.contacts ?? [];
    const loading = current === null;
    const failed = current?.failed ?? false;
    const selected = useRef<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        const config: AuthSessionRequestConfig = { signal: controller.signal, _authSessionId: sessionId };
        void apiClient.get<ClubContact[]>(`/clubs/${clubId}/staff`, config).then(({ data }) => {
            if (controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            if (!Array.isArray(data)) throw new Error('Invalid club staff response');
            const unique = new Map<number, ClubContact>();
            for (const person of data) {
                if (Number.isSafeInteger(person.userId) && person.userId > 0 && person.userId !== user?.id) unique.set(person.userId, person);
            }
            setResult({ key: requestKey, contacts: [...unique.values()], failed: false });
        }).catch(() => {
            if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setResult({ key: requestKey, contacts: [], failed: true });
        });
        return () => controller.abort();
    }, [clubId, sessionId, user?.id, requestKey]);
    const message = (userId: number) => {
        if (selected.current === requestKey || !isCurrentAuthSession(sessionId) || !contacts.some((person) => person.userId === userId)) return;
        selected.current = requestKey;
        onOpenGrassKickZChat(userId);
    };
    return <div className="club-motion-backdrop theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" data-closing={motion.closing} onClick={motion.close}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={heading} onClick={(event) => event.stopPropagation()}
            data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} className="club-motion-dialog theme-surface theme-border max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--fc-border)] px-6 py-5">
                <div>
                    <h2 id={heading} className="text-xl font-semibold text-[var(--fc-text-primary)]">Contact {clubName}</h2>
                    <p className="mt-2 text-sm text-[var(--fc-text-secondary)]">Choose a staff member to message in GrassKickZ. Their message permissions still apply.</p>
                </div>
                <button type="button" aria-label="Close contacts" onClick={motion.close} className="min-h-11 min-w-11 rounded-lg p-2 text-[var(--fc-text-secondary)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 px-6 py-5">
                <h3 className="font-semibold text-[var(--fc-text-primary)]">Message a staff member</h3>
                {loading && <p role="status" className="flex items-center gap-2 text-sm text-[var(--fc-text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Loading contacts…</p>}
                {failed && <div role="alert" className="space-y-2 text-sm text-[var(--fc-text-secondary)]"><p>Couldn’t load club contacts.</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 font-semibold text-[var(--fc-accent)]">Retry contacts</button></div>}
                {!loading && !failed && contacts.length === 0 && <p className="text-sm text-[var(--fc-text-secondary)]">This club has no other public staff contacts yet.</p>}
                {contacts.map((person) => <button key={person.userId} type="button" onClick={() => message(person.userId)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--fc-border)] p-4 text-left hover:border-[var(--fc-accent)]">
                    <MessageCircle className="h-5 w-5 shrink-0 text-[var(--fc-accent)]" />
                    <span className="min-w-0"><span className="block font-medium text-[var(--fc-text-primary)]">{status === 'authenticated' ? 'Message' : 'Sign in to message'} {person.fullName?.trim() || 'staff member'}</span>
                        <span className="block text-sm text-[var(--fc-text-secondary)]">{person.title?.trim() || person.role?.replaceAll('_', ' ').toLowerCase() || 'Club staff'}</span></span>
                </button>)}
                {options.length > 0 && <div className="space-y-3 border-t border-[var(--fc-border)] pt-4">
                    <h3 className="font-semibold text-[var(--fc-text-primary)]">External contacts</h3>
                    {options.map((option) => <button key={option.id} type="button" onClick={() => openClubCommunication(option)}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--fc-border)] p-4 text-left hover:border-[var(--fc-accent)]">
                        <ExternalLink className="h-5 w-5 shrink-0 text-[var(--fc-text-secondary)]" />
                        <span><span className="block font-medium text-[var(--fc-text-primary)]">{option.label}{option.isRecommended ? ' · Club preferred' : ''}</span>
                            <span className="block text-sm text-[var(--fc-text-secondary)]">{option.description}</span></span>
                    </button>)}
                </div>}
            </div>
        </div>
    </div>;
};
