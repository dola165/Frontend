import { useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Heart, Loader2, MapPin, MessageSquare, ShieldCheck, Users, X } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { MiniMap } from '../MiniMap';

type ClubCommunicationMethod = 'WHATSAPP' | 'FACEBOOK_MESSENGER';
type ClubType = 'GRASSROOTS' | 'ACADEMY' | 'PROFESSIONAL';
type OrgKind = 'CLUB' | 'FAN_CLUB' | 'COMPANY';

interface CreateClubModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (clubId: number) => void;
}

interface CreateClubResponse {
    id: number;
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

const orgKindOptions: Array<{ value: OrgKind; label: string; description: string; allowedRoles: string[]; comingSoon?: boolean }> = [
    { value: 'CLUB', label: 'Club', description: 'Create and manage a football club, academy, or competitive team. Schedule matches, build squads, and grow your organization.', allowedRoles: ['ORGANIZER'] },
    { value: 'FAN_CLUB', label: 'Fan Club', description: 'Build a supporter community around your favorite teams. Organize watch parties, share content, and connect with fellow fans.', allowedRoles: ['FAN'], comingSoon: true },
    { value: 'COMPANY', label: 'Organization', description: 'For brands, sponsors, and businesses that want to advertise, partner with clubs, or promote football-related services.', allowedRoles: [], comingSoon: true }
];

export const CreateClubModal = ({ isOpen, onClose, onCreated }: CreateClubModalProps) => {
    const { user } = useAuth();
    const userRole = user?.role;
    const [step, setStep] = useState(0);
    const [orgKind, setOrgKind] = useState<OrgKind | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
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

    if (!isOpen) return null;

    const hasWhatsapp = formData.whatsappNumber.trim().length > 0;
    const hasMessenger = formData.facebookMessengerUrl.trim().length > 0;

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((current) => ({ ...current, [field]: value }));
        setErrorMessage(null);
    };

    const resetAndClose = () => {
        setStep(0);
        setOrgKind(null);
        setSelectedLocation(null);
        setFormData({
            name: '',
            description: '',
            type: 'GRASSROOTS' as ClubType,
            contactEmail: '',
            whatsappNumber: '',
            facebookMessengerUrl: '',
            preferredCommunicationMethod: null
        });
        setErrorMessage(null);
        setSubmitting(false);
        onClose();
    };

    const handleSubmit = async () => {
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
                preferredCommunicationMethod: formData.preferredCommunicationMethod,
                latitude: selectedLocation?.lat ?? null,
                longitude: selectedLocation?.lng ?? null
            });

            resetAndClose();
            onCreated(response.data.id);
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to create club.'));
        } finally {
            setSubmitting(false);
        }
    };

    const canGoNext = (): boolean => {
        if (step === 0) return orgKind !== null;
        if (step === 1) return true; // location is optional
        if (step === 2) return formData.name.trim().length > 0;
        return false;
    };

    const selectedKind = orgKindOptions.find(k => k.value === orgKind);
    const isKindAvailable = selectedKind ? selectedKind.allowedRoles.includes(userRole ?? '') && !selectedKind.comingSoon : false;

    // Shared input class
    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary placeholder:text-secondary';

    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-subtle px-6 py-5 shrink-0">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">
                            {step === 0 ? 'Choose Type' : step === 1 ? 'Set Location' : 'Club Details'}
                        </p>
                        <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-primary">
                            {step === 0 ? 'What are you building?' : step === 1 ? 'Where is it based?' : 'Final details'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={resetAndClose}
                        className="inline-flex h-10 w-10 items-center justify-center border border-subtle bg-base text-secondary transition-colors hover:text-primary"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Step content — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* Step 0: Type selection */}
                    {step === 0 && (
                        <div className="grid gap-4">
                            {orgKindOptions.map((kind) => {
                                const isAvailable = kind.allowedRoles.includes(userRole ?? '') && !kind.comingSoon;
                                const isSelected = orgKind === kind.value;
                                let Icon = Building2;
                                if (kind.value === 'FAN_CLUB') Icon = Heart;
                                if (kind.value === 'COMPANY') Icon = Users;

                                return (
                                    <button
                                        key={kind.value}
                                        type="button"
                                        disabled={!isAvailable}
                                        onClick={() => setOrgKind(kind.value)}
                                        className={`flex items-start gap-4 rounded-xl border p-5 text-left transition-colors ${
                                            isSelected
                                                ? 'border-accent-primary bg-accent-primary-soft'
                                                : isAvailable
                                                ? 'border-subtle hover:border-strong'
                                                : 'border-subtle opacity-50 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                                            isSelected ? 'border-accent-primary bg-accent-primary text-white' : 'border-subtle text-muted'
                                        }`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                                                    {kind.label}
                                                </p>
                                                {kind.comingSoon && (
                                                    <span className="rounded-full bg-[color:var(--state-warning-soft)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[color:var(--state-warning)]">
                                                        Coming Soon
                                                    </span>
                                                )}
                                                {!kind.comingSoon && !kind.allowedRoles.includes(userRole ?? '') && (
                                                    <span className="rounded-full bg-inset px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-secondary">
                                                        {kind.value === 'CLUB' ? 'Organizer Only' : 'Fan Only'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs leading-5 text-secondary">{kind.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Step 1: Location */}
                    {step === 1 && (
                        <div>
                            <p className="text-sm text-secondary mb-4">
                                Click anywhere on the map to place your club's pin. You can update this later from the club workspace.
                            </p>
                            <MiniMap
                                mode="picker"
                                title="Club Location"
                                selectedLocation={selectedLocation}
                                onSelectLocation={(coords) => setSelectedLocation(coords)}
                                className="rounded-xl overflow-hidden border border-subtle"
                            />
                            {selectedLocation && (
                                <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] accent-primary">
                                    Location set: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Step 2: Details */}
                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Club type subtype */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Club Type</label>
                                <div className="grid gap-2 grid-cols-3">
                                    {clubTypeOptions.map((option) => {
                                        const isActive = formData.type === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => updateField('type', option.value)}
                                                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                                    isActive
                                                        ? 'border-accent-primary bg-accent-primary-soft'
                                                        : 'border-subtle hover:border-strong'
                                                }`}
                                            >
                                                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">{option.label}</p>
                                                <p className="mt-1 text-[10px] leading-4 text-secondary">{option.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Club name */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Club Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    maxLength={120}
                                    required
                                    placeholder="e.g. GrassKickZ Tbilisi Academy"
                                    className={inputClass}
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Club Story</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    maxLength={2000}
                                    rows={3}
                                    placeholder="Tell players, parents, and partner clubs what the organization is building."
                                    className={`${inputClass} resize-none`}
                                />
                            </div>

                            {/* Contact */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Contact (optional)</label>
                                <div className="grid gap-3 grid-cols-2">
                                    <input
                                        type="email"
                                        value={formData.contactEmail}
                                        onChange={(e) => updateField('contactEmail', e.target.value)}
                                        placeholder="Contact email"
                                        className={inputClass}
                                    />
                                    <input
                                        type="text"
                                        value={formData.whatsappNumber}
                                        onChange={(e) => updateField('whatsappNumber', e.target.value)}
                                        placeholder="WhatsApp number"
                                        className={inputClass}
                                    />
                                </div>
                                <input
                                    type="url"
                                    value={formData.facebookMessengerUrl}
                                    onChange={(e) => updateField('facebookMessengerUrl', e.target.value)}
                                    placeholder="Facebook / Messenger URL"
                                    className={inputClass}
                                />
                            </div>

                            {/* Preferred communication */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 accent-primary" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Preferred Contact Method</p>
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
                                                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                                    isActive ? 'border-accent-primary bg-accent-primary-soft' : 'border-subtle hover:border-strong'
                                                }`}
                                            >
                                                <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${isActive ? 'border-accent-primary bg-accent-primary' : 'border-strong'}`} />
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-primary">
                                                        {option.label}
                                                        {isUnavailable && (
                                                            <span className="rounded-full bg-[color:var(--state-warning-soft)] px-2 py-0.5 text-[9px] font-black uppercase text-[color:var(--state-warning)]">
                                                                Add contact
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-secondary">{option.helper}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => updateField('preferredCommunicationMethod', '')}
                                        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                            !formData.preferredCommunicationMethod ? 'border-accent-primary bg-accent-primary-soft' : 'border-subtle hover:border-strong'
                                        }`}
                                    >
                                        <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${!formData.preferredCommunicationMethod ? 'border-accent-primary bg-accent-primary' : 'border-strong'}`} />
                                        <span className="text-sm font-black uppercase tracking-[0.12em] text-primary">No preferred method yet</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mt-4 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                            {errorMessage}
                        </div>
                    )}
                </div>

                {/* Footer with navigation */}
                <div className="flex items-center justify-between gap-3 border-t border-subtle px-6 py-4 shrink-0">
                    <div>
                        {step > 0 && (
                            <button
                                type="button"
                                onClick={() => setStep((s) => s - 1)}
                                className="inline-flex items-center gap-2 border border-subtle bg-base px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary transition-colors hover:text-primary"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="border border-subtle bg-base px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary transition-colors hover:text-primary"
                        >
                            Cancel
                        </button>
                        {step < 2 ? (
                            <button
                                type="button"
                                onClick={() => setStep((s) => s + 1)}
                                disabled={!canGoNext()}
                                className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary transition-colors disabled:opacity-50"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting || !canGoNext()}
                                className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                Create Club
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
