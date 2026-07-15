import { ExternalLink, MessageSquare, PhoneCall, X } from 'lucide-react';
import { MessageCircle } from 'lucide-react';

export interface ClubCommunicationOption {
    id: 'WHATSAPP' | 'FACEBOOK_MESSENGER';
    label: string;
    description: string;
    url: string;
    isRecommended: boolean;
}

interface ClubMessageModalProps {
    clubName: string;
    options: ClubCommunicationOption[];
    onClose: () => void;
    onOpenGrassKickZChat?: () => void;
}

export const buildClubCommunicationOptions = (
    whatsappNumber?: string | null,
    facebookMessengerUrl?: string | null,
    preferredCommunicationMethod?: string | null
) => {
    const options: ClubCommunicationOption[] = [];
    const preferred = preferredCommunicationMethod?.toUpperCase() ?? null;

    if (whatsappNumber?.trim()) {
        const normalizedDigits = whatsappNumber.replace(/[^\d]/g, '');
        if (normalizedDigits) {
            options.push({
                id: 'WHATSAPP',
                label: 'WhatsApp',
                description: 'Open a direct club conversation through WhatsApp.',
                url: `https://wa.me/${normalizedDigits}`,
                isRecommended: preferred === 'WHATSAPP'
            });
        }
    }

    if (facebookMessengerUrl?.trim()) {
        options.push({
            id: 'FACEBOOK_MESSENGER',
            label: 'Facebook / Messenger',
            description: 'Open the club page or Messenger thread in a new tab.',
            url: facebookMessengerUrl,
            isRecommended: preferred === 'FACEBOOK_MESSENGER'
        });
    }

    return options;
};

export const openClubCommunication = (option: ClubCommunicationOption) => {
    window.open(option.url, '_blank', 'noopener,noreferrer');
};

export const ClubMessageModal = ({ clubName, options, onClose, onOpenGrassKickZChat }: ClubMessageModalProps) => {
    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-[#ffffff0d] px-6 py-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#16a34a]/20 bg-[#16a34a]-soft px-3 py-1 text-[10px] font-semibold  text-[#16a34a]">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Club Message
                        </div>
                        <h2 className="mt-4 text-xl font-semibold uppercase tracking-tight text-[#f4f4f5]">
                            Contact {clubName}
                        </h2>
                        <p className="mt-2 text-sm text-[#a1a1aa]">
                            Choose how you'd like to reach {clubName}. In-app chat is available as a demo.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center border border-[#ffffff0d] bg-[#0f1117] text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-3 px-6 py-6">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => openClubCommunication(option)}
                            className="flex w-full items-start gap-4 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-4 text-left transition-colors hover:border-[#16a34a] hover:bg-[#16a34a]-soft"
                        >
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-[#ffffff0d] bg-[#0f1117] text-[#16a34a]">
                                {option.id === 'WHATSAPP' ? <PhoneCall className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">
                                        {option.label}
                                    </p>
                                    {option.isRecommended && (
                                        <span className="rounded-full border border-[#16a34a]/20 bg-[#16a34a]-soft px-2 py-0.5 text-[9px] font-semibold  text-[#16a34a]">
                                            Recommended
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                                    {option.description}
                                </p>
                            </div>
                        </button>
                    ))}

                    <button
                        type="button"
                        onClick={onOpenGrassKickZChat}
                        className="flex w-full items-start gap-4 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-4 text-left transition-colors hover:border-[#16a34a] hover:bg-[#16a34a]-soft"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-[#ffffff0d] bg-[#0f1117] text-[#16a34a]">
                            <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">
                                    GrassKickZ Messenger
                                </p>
                                <span className="rounded-full border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning-soft)] px-2 py-0.5 text-[9px] font-semibold  text-[color:var(--state-warning)]">
                                    Demo
                                </span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                                Chat directly with {clubName} using the built-in GrassKickZ messenger.
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
