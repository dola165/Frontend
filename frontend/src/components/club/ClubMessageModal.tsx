import { ExternalLink, MessageSquare, PhoneCall, Shield, X } from 'lucide-react';

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

export const ClubMessageModal = ({ clubName, options, onClose }: ClubMessageModalProps) => {
    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl">
                <div className="theme-surface-strong theme-border flex items-start justify-between gap-4 border-b px-6 py-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Club Message
                        </div>
                        <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                            Contact {clubName}
                        </h2>
                        <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                            GrassKickZ will hand you off to the club's saved external channel until in-app messenger is ready.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
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
                            className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/10"
                        >
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                {option.id === 'WHATSAPP' ? <PhoneCall className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">
                                        {option.label}
                                    </p>
                                    {option.isRecommended && (
                                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                                            Recommended
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                                    {option.description}
                                </p>
                            </div>
                        </button>
                    ))}

                    <div className="flex items-start gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 opacity-70 dark:border-slate-700 dark:bg-slate-900/60">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                            <Shield className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                                    GrassKickZ Messenger
                                </p>
                                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                    Coming soon
                                </span>
                            </div>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                Visible for future compatibility, but intentionally disabled until the internal messenger is real.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
