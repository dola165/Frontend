import { type ReactNode, useMemo, useState } from 'react';
import { Building2, Loader2, MapPin, MessageSquare, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';

type ClubCommunicationMethod = 'WHATSAPP' | 'FACEBOOK_MESSENGER';
type ClubType = 'GRASSROOTS' | 'ACADEMY' | 'PROFESSIONAL';

interface CreateClubModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (clubId: number) => void;
}

interface CreateClubResponse {
    id: number;
}

interface FormSectionProps {
    icon: typeof Building2;
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}

const clubTypeOptions: Array<{ value: ClubType; label: string; description: string }> = [
    { value: 'GRASSROOTS', label: 'Grassroots', description: 'Community-first clubs, local teams, and neighborhood football projects.' },
    { value: 'ACADEMY', label: 'Academy', description: 'Structured player development programs and age-group squads.' },
    { value: 'PROFESSIONAL', label: 'Professional', description: 'Senior competitive clubs with formal football operations.' }
];

const communicationOptions: Array<{ value: ClubCommunicationMethod; label: string; helper: string }> = [
    { value: 'WHATSAPP', label: 'WhatsApp', helper: 'Fastest way for players and clubs to reach you immediately.' },
    { value: 'FACEBOOK_MESSENGER', label: 'Facebook / Messenger', helper: 'Use a Facebook page or direct Messenger link.' }
];

const FormSection = ({ icon: Icon, eyebrow, title, description, children }: FormSectionProps) => (
    <section className="space-y-4 border-t border-slate-200 pt-6 first:border-t-0 first:pt-0 dark:border-slate-800">
        <div className="flex items-start gap-3">
            <div className="theme-surface-strong flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {eyebrow}
                </p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    {title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {description}
                </p>
            </div>
        </div>
        {children}
    </section>
);

export const CreateClubModal = ({ isOpen, onClose, onCreated }: CreateClubModalProps) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'GRASSROOTS' as ClubType,
        contactEmail: '',
        whatsappNumber: '',
        facebookMessengerUrl: '',
        preferredCommunicationMethod: null as ClubCommunicationMethod | null
    });
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const hasWhatsapp = formData.whatsappNumber.trim().length > 0;
    const hasMessenger = formData.facebookMessengerUrl.trim().length > 0;

    const preferredMethodHelper = useMemo(() => {
        if (!hasWhatsapp && !hasMessenger) {
            return 'Messaging links are optional during club creation. You can add them later from the club workspace.';
        }
        if (formData.preferredCommunicationMethod === 'WHATSAPP' && !hasWhatsapp) {
            return 'Add a WhatsApp number or switch the preferred contact method.';
        }
        if (formData.preferredCommunicationMethod === 'FACEBOOK_MESSENGER' && !hasMessenger) {
            return 'Add a Facebook/Messenger URL or switch the preferred contact method.';
        }
        if (!formData.preferredCommunicationMethod) {
            return 'Pick a preferred method now, or leave it unset until the club is fully configured.';
        }
        return 'This method will be marked as recommended when other clubs tap Message.';
    }, [formData.preferredCommunicationMethod, hasMessenger, hasWhatsapp]);

    if (!isOpen) {
        return null;
    }

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((current) => ({ ...current, [field]: value }));
        setErrorMessage(null);
    };

    const resetAndClose = () => {
        setErrorMessage(null);
        setSubmitting(false);
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setErrorMessage(null);

        const hasPreferredWhatsapp = formData.preferredCommunicationMethod === 'WHATSAPP';
        const hasPreferredMessenger = formData.preferredCommunicationMethod === 'FACEBOOK_MESSENGER';
        const hasValidPreferredMethod = (!hasPreferredWhatsapp || hasWhatsapp) && (!hasPreferredMessenger || hasMessenger);

        if (!hasValidPreferredMethod) {
            setSubmitting(false);
            setErrorMessage('Preferred communication method must match an available contact option.');
            return;
        }

        try {
            const response = await apiClient.post<CreateClubResponse>('/clubs', {
                name: formData.name,
                description: formData.description || null,
                type: formData.type,
                contactEmail: formData.contactEmail || null,
                whatsappNumber: formData.whatsappNumber || null,
                facebookMessengerUrl: formData.facebookMessengerUrl || null,
                preferredCommunicationMethod: formData.preferredCommunicationMethod
            });

            onCreated(response.data.id);
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to create club.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border w-full max-w-3xl overflow-hidden rounded-xl border shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                            Club Creation
                        </p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Create your club
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                            Set the essentials now, then finish the rest from the club workspace after launch.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={resetAndClose}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5">
                    <div className="space-y-8">
                        <FormSection
                            icon={Building2}
                            eyebrow="Basic Info"
                            title="Name the club and define its identity"
                            description="Keep this opening step focused on the essentials people need to recognize the organization."
                        >
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Club Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(event) => updateField('name', event.target.value)}
                                        maxLength={120}
                                        required
                                        placeholder="e.g. GrassKickZ Tbilisi Academy"
                                        className="theme-surface-muted theme-border w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Club Type
                                    </label>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {clubTypeOptions.map((option) => {
                                            const isActive = formData.type === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => updateField('type', option.value)}
                                                    className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                                                        isActive
                                                            ? 'border-emerald-500 bg-emerald-500/8 text-slate-900 dark:text-white'
                                                            : 'theme-border theme-surface-muted text-slate-600 hover:border-emerald-400/60 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                                                    }`}
                                                >
                                                    <p className="text-sm font-black tracking-tight">{option.label}</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                        {option.description}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Club Story
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(event) => updateField('description', event.target.value)}
                                        maxLength={2000}
                                        rows={4}
                                        placeholder="Tell players, parents, and partner clubs what the organization is building."
                                        className="theme-surface-muted theme-border w-full rounded-lg border px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:text-white"
                                    />
                                </div>
                            </div>
                        </FormSection>

                        <FormSection
                            icon={MapPin}
                            eyebrow="Location"
                            title="Add location details after launch"
                            description="The current creation flow does not collect address data, so we keep this step light and let you finish location details inside the club profile."
                        >
                            <div className="border-l-2 border-slate-200 pl-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                Once the club is created, you can update address and map details from the club workspace without slowing down this first setup step.
                            </div>
                        </FormSection>

                        <FormSection
                            icon={MessageSquare}
                            eyebrow="Communication"
                            title="Set how players and partner clubs can reach you"
                            description="Messaging links are helpful, but they are optional at creation and can be added later from the club workspace."
                        >
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                            Contact Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.contactEmail}
                                            onChange={(event) => updateField('contactEmail', event.target.value)}
                                            placeholder="Optional, but useful for admin follow-up"
                                            className="theme-surface-muted theme-border w-full rounded-lg border px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:text-white"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                            WhatsApp Number
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.whatsappNumber}
                                            onChange={(event) => updateField('whatsappNumber', event.target.value)}
                                            placeholder="+995555123456"
                                            className="theme-surface-muted theme-border w-full rounded-lg border px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Facebook / Messenger URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.facebookMessengerUrl}
                                        onChange={(event) => updateField('facebookMessengerUrl', event.target.value)}
                                        placeholder="https://m.me/yourclub"
                                        className="theme-surface-muted theme-border w-full rounded-lg border px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                            Preferred Communication Method
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {communicationOptions.map((option) => {
                                            const isActive = formData.preferredCommunicationMethod === option.value;
                                            const isUnavailable = option.value === 'WHATSAPP' ? !hasWhatsapp : !hasMessenger;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => updateField('preferredCommunicationMethod', option.value)}
                                                    className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                                        isActive
                                                            ? 'border-emerald-500 bg-emerald-500/8'
                                                            : 'theme-border theme-surface-muted hover:border-emerald-400/60'
                                                    }`}
                                                >
                                                    <span className={`mt-1 h-3.5 w-3.5 rounded-full border ${
                                                        isActive ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400 bg-transparent'
                                                    }`} />
                                                    <span className="min-w-0">
                                                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                                            {option.label}
                                                            {isUnavailable && (
                                                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
                                                                    Add contact
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                                                            {option.helper}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => updateField('preferredCommunicationMethod', '')}
                                        className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                            !formData.preferredCommunicationMethod
                                                ? 'border-emerald-500 bg-emerald-500/8'
                                                : 'theme-border theme-surface-muted hover:border-emerald-400/60'
                                        }`}
                                    >
                                        <span className={`mt-1 h-3.5 w-3.5 rounded-full border ${
                                            !formData.preferredCommunicationMethod ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400 bg-transparent'
                                        }`} />
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                                No preferred method yet
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                                                Safe default for brand-new clubs that want to finish setup after creation.
                                            </span>
                                        </span>
                                    </button>

                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {preferredMethodHelper}
                                    </p>
                                </div>
                            </div>
                        </FormSection>

                        {errorMessage && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
                                {errorMessage}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
                            <button
                                type="button"
                                onClick={resetAndClose}
                                className="theme-surface-muted theme-border rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                Create Club
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
