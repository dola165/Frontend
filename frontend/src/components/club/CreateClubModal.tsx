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

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
            <div className="bg-white dark:bg-[#18181b] w-full max-w-2xl rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000] flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b-2 border-gray-200 dark:border-gray-700 px-6 py-5 shrink-0">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#00c853]">
                            {step === 0 ? 'Choose Type' : step === 1 ? 'Set Location' : 'Club Details'}
                        </p>
                        <h2 className="mt-2 text-2xl font-serif font-bold tracking-tighter italic text-[#1a1a1a] dark:text-white">
                            {step === 0 ? 'What are you building?' : step === 1 ? 'Where is it based?' : 'Final details'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={resetAndClose}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
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
                                        className={`flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                                            isSelected
                                                ? 'border-[#00c853] bg-[#00c853]/10 shadow-[4px_4px_0px_0px_#00c853]'
                                                : isAvailable
                                                ? 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                                                : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 ${
                                            isSelected ? 'border-[#00c853] bg-[#00c853] text-white' : 'border-gray-300 dark:border-gray-600 text-gray-400'
                                        }`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-black uppercase tracking-widest text-[#1a1a1a] dark:text-white">
                                                    {kind.label}
                                                </p>
                                                {kind.comingSoon && (
                                                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                        Coming Soon
                                                    </span>
                                                )}
                                                {!kind.comingSoon && !kind.allowedRoles.includes(userRole ?? '') && (
                                                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-gray-500">
                                                        {kind.value === 'CLUB' ? 'Organizer Only' : 'Fan Only'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-5">{kind.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Step 1: Location */}
                    {step === 1 && (
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Click anywhere on the map to place your club's pin. You can update this later from the club workspace.
                            </p>
                            <MiniMap
                                mode="picker"
                                title="Club Location"
                                selectedLocation={selectedLocation}
                                onSelectLocation={(coords) => setSelectedLocation(coords)}
                                className="rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700"
                            />
                            {selectedLocation && (
                                <p className="mt-3 text-xs font-bold text-[#00c853] uppercase tracking-wider">
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
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Club Type</label>
                                <div className="grid gap-2 grid-cols-3">
                                    {clubTypeOptions.map((option) => {
                                        const isActive = formData.type === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => updateField('type', option.value)}
                                                className={`rounded-lg border-2 px-3 py-3 text-left transition-colors ${
                                                    isActive
                                                        ? 'border-[#00c853] bg-[#00c853]/10'
                                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                                }`}
                                            >
                                                <p className="text-xs font-black uppercase tracking-wider text-[#1a1a1a] dark:text-white">{option.label}</p>
                                                <p className="mt-1 text-[10px] leading-4 text-gray-500">{option.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Club name */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Club Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    maxLength={120}
                                    required
                                    placeholder="e.g. GrassKickZ Tbilisi Academy"
                                    className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-bold text-sm transition-colors"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Club Story</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    maxLength={2000}
                                    rows={3}
                                    placeholder="Tell players, parents, and partner clubs what the organization is building."
                                    className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm resize-none transition-colors"
                                />
                            </div>

                            {/* Contact */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Contact (optional)</label>
                                <div className="grid gap-3 grid-cols-2">
                                    <input
                                        type="email"
                                        value={formData.contactEmail}
                                        onChange={(e) => updateField('contactEmail', e.target.value)}
                                        placeholder="Contact email"
                                        className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm transition-colors"
                                    />
                                    <input
                                        type="text"
                                        value={formData.whatsappNumber}
                                        onChange={(e) => updateField('whatsappNumber', e.target.value)}
                                        placeholder="WhatsApp number"
                                        className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm transition-colors"
                                    />
                                </div>
                                <input
                                    type="url"
                                    value={formData.facebookMessengerUrl}
                                    onChange={(e) => updateField('facebookMessengerUrl', e.target.value)}
                                    placeholder="Facebook / Messenger URL"
                                    className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm transition-colors"
                                />
                            </div>

                            {/* Preferred communication */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-[#00c853]" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Preferred Contact Method</p>
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
                                                className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                                                    isActive ? 'border-[#00c853] bg-[#00c853]/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                                }`}
                                            >
                                                <span className={`mt-1 h-3.5 w-3.5 rounded-full border-2 ${isActive ? 'border-[#00c853] bg-[#00c853]' : 'border-gray-400'}`} />
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-2 text-sm font-bold text-[#1a1a1a] dark:text-white">
                                                        {option.label}
                                                        {isUnavailable && (
                                                            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:text-amber-400">
                                                                Add contact
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-gray-500">{option.helper}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => updateField('preferredCommunicationMethod', '')}
                                        className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                                            !formData.preferredCommunicationMethod ? 'border-[#00c853] bg-[#00c853]/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                        }`}
                                    >
                                        <span className={`mt-1 h-3.5 w-3.5 rounded-full border-2 ${!formData.preferredCommunicationMethod ? 'border-[#00c853] bg-[#00c853]' : 'border-gray-400'}`} />
                                        <span className="text-sm font-bold text-[#1a1a1a] dark:text-white">No preferred method yet</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-400">
                            {errorMessage}
                        </div>
                    )}
                </div>

                {/* Footer with navigation */}
                <div className="flex items-center justify-between gap-3 border-t-2 border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
                    <div>
                        {step > 0 && (
                            <button
                                type="button"
                                onClick={() => setStep((s) => s - 1)}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 font-black uppercase tracking-widest text-sm text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="px-4 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        {step < 2 ? (
                            <button
                                type="button"
                                onClick={() => setStep((s) => s + 1)}
                                disabled={!canGoNext()}
                                className="inline-flex items-center gap-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] hover:bg-gray-800 dark:hover:bg-gray-200 font-black uppercase tracking-widest text-sm px-6 py-3 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#00c853] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting || !canGoNext()}
                                className="inline-flex items-center gap-2 bg-[#00c853] hover:bg-[#00e676] text-black font-black uppercase tracking-widest text-sm px-6 py-3 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
                                Create Club
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
