import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, ChevronLeft, ChevronRight, Heart, Loader2, MapPin, MessageSquare, ShieldCheck, Users, X } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { MiniMap } from '../components/MiniMap';

type ClubCommunicationMethod = 'WHATSAPP' | 'FACEBOOK_MESSENGER';
type ClubType = 'GRASSROOTS' | 'ACADEMY' | 'PROFESSIONAL';
type OrgKind = 'CLUB' | 'FAN_CLUB' | 'COMPANY';

interface CreateClubResponse { id: number; }

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

const STEPS = [
    { number: 1, label: 'Type', description: 'Choose what kind of organization you want to create' },
    { number: 2, label: 'Location', description: 'Pin your club on the map so players can find you' },
    { number: 3, label: 'Details', description: 'Name your club, set the category, and add contact info' }
];

export const CreateClubPage = () => {
    const navigate = useNavigate();
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

    const hasWhatsapp = formData.whatsappNumber.trim().length > 0;
    const hasMessenger = formData.facebookMessengerUrl.trim().length > 0;
    const selectedKind = orgKindOptions.find(k => k.value === orgKind);

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((current) => ({ ...current, [field]: value }));
        setErrorMessage(null);
    };

    const canGoNext = (): boolean => {
        if (step === 0) return orgKind !== null;
        if (step === 1) return true; // location is optional, user can skip
        if (step === 2) return formData.name.trim().length > 0;
        return false;
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

            navigate(`/clubs/${response.data.id}`);
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to create club.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-[calc(100dvh-var(--app-header-height))] bg-[#fcf8f2] dark:bg-[#09090b] flex">
            {/* Left step sidebar — AWS-style */}
            <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r-2 border-[#1a1a1a] dark:border-gray-700 bg-white dark:bg-[#18181b] p-6">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors mb-8"
                >
                    <ChevronLeft className="h-5 w-5" />
                    Back
                </button>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Setup Progress</p>
                <nav className="space-y-1">
                    {STEPS.map((s, i) => {
                        const isCurrent = i === step;
                        const isComplete = i < step;
                        return (
                            <div key={s.number} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-colors ${
                                        isComplete
                                            ? 'border-[#00c853] bg-[#00c853] text-black'
                                            : isCurrent
                                            ? 'border-[#00c853] bg-[#00c853]/10 text-[#00c853]'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-400'
                                    }`}>
                                        {isComplete ? <CheckCircle className="h-4 w-4" /> : s.number}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-0.5 flex-1 mt-1 ${i < step ? 'bg-[#00c853]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    )}
                                </div>
                                <div className={`pb-6 ${!isCurrent && !isComplete ? 'opacity-50' : ''}`}>
                                    <p className="text-sm font-black uppercase tracking-widest text-[#1a1a1a] dark:text-white">{s.label}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{s.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </nav>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile step indicator */}
                <div className="lg:hidden flex items-center gap-2 px-6 py-4 border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#18181b]">
                    <button onClick={() => navigate(-1)} className="p-1 text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        {STEPS.map((s, i) => (
                            <div key={s.number} className="flex items-center gap-2">
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                                    i < step ? 'bg-[#00c853] text-black' : i === step ? 'bg-[#00c853]/10 text-[#00c853] border border-[#00c853]' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                }`}>
                                    {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : s.number}
                                </div>
                                {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${i < step ? 'bg-[#00c853]' : 'bg-gray-300 dark:bg-gray-600'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto px-6 py-8 lg:py-12">
                        {/* Step 0: Type */}
                        {step === 0 && (
                            <div>
                                <div className="mb-8">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c853]">Step 1 of 3</p>
                                    <h1 className="mt-3 text-3xl lg:text-4xl font-serif font-bold tracking-tighter italic text-[#1a1a1a] dark:text-white">What are you building?</h1>
                                    <p className="mt-3 text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Choose the type of organization that matches your goal. Each type unlocks different tools and features.
                                        Your account role determines which types you can create — options unavailable to you are shown below for transparency.
                                    </p>
                                </div>
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
                                                className={`flex items-start gap-5 rounded-xl border-2 p-6 text-left transition-all ${
                                                    isSelected
                                                        ? 'border-[#00c853] bg-[#00c853]/10 shadow-[4px_4px_0px_0px_#00c853]'
                                                        : isAvailable
                                                        ? 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-[4px_4px_0px_0px_#ccc]'
                                                        : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                                }`}
                                            >
                                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
                                                    isSelected ? 'border-[#00c853] bg-[#00c853] text-black' : 'border-gray-300 dark:border-gray-600 text-gray-400'
                                                }`}>
                                                    <Icon className="h-7 w-7" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-base font-black uppercase tracking-widest text-[#1a1a1a] dark:text-white">{kind.label}</p>
                                                        {kind.comingSoon && (
                                                            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                                Coming Soon
                                                            </span>
                                                        )}
                                                        {!kind.comingSoon && !kind.allowedRoles.includes(userRole ?? '') && (
                                                            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-gray-500">
                                                                {kind.value === 'CLUB' ? 'Requires Organizer Account' : 'Requires Fan Account'}
                                                            </span>
                                                        )}
                                                        {isAvailable && (
                                                            <span className="rounded-full bg-[#00c853]/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#00c853]">
                                                                Available to You
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{kind.description}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Step 1: Location */}
                        {step === 1 && (
                            <div>
                                <div className="mb-8">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c853]">Step 2 of 3</p>
                                    <h1 className="mt-3 text-3xl lg:text-4xl font-serif font-bold tracking-tighter italic text-[#1a1a1a] dark:text-white">Where is your club based?</h1>
                                    <p className="mt-3 text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Click anywhere on the map to drop a pin at your club's location. This helps players and other clubs find you.
                                        You can zoom in, pan around, and click to reposition the pin as many times as you like.
                                    </p>
                                </div>

                                {/* Location confirmation card */}
                                {selectedLocation ? (
                                    <div className="mb-4 rounded-xl border-2 border-[#00c853] bg-[#00c853]/10 p-4 flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00c853] text-black">
                                            <CheckCircle className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest text-[#1a1a1a] dark:text-white">Location Confirmed</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Lat: {selectedLocation.lat.toFixed(6)} &middot; Lng: {selectedLocation.lng.toFixed(6)}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLocation(null)}
                                            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="Clear selected location"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mb-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-4">
                                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                            No location selected yet — click on the map below to place your club's pin.
                                        </p>
                                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                                            You can skip this step and add a location later from your club workspace.
                                        </p>
                                    </div>
                                )}

                                <div className="rounded-xl border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000]">
                                    <MiniMap
                                        mode="picker"
                                        title="Click the map to place your club pin"
                                        selectedLocation={selectedLocation}
                                        onSelectLocation={(coords) => setSelectedLocation(coords)}
                                    />
                                </div>
                                <p className="mt-3 text-xs text-gray-400 text-center">
                                    Tip: Use the scroll wheel to zoom in for more precise pin placement. You can always update the location later.
                                </p>
                            </div>
                        )}

                        {/* Step 2: Details */}
                        {step === 2 && (
                            <div>
                                <div className="mb-8">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c853]">Step 3 of 3</p>
                                    <h1 className="mt-3 text-3xl lg:text-4xl font-serif font-bold tracking-tighter italic text-[#1a1a1a] dark:text-white">Final details</h1>
                                    <p className="mt-3 text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Give your club a name, choose its competitive level, and add optional contact information.
                                        Everything except the name can be changed later.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {/* Club type */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-500">Competitive Level</label>
                                        <p className="text-xs text-gray-400">This helps categorize your club in search results and matchmaking.</p>
                                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                                            {clubTypeOptions.map((option) => {
                                                const isActive = formData.type === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => updateField('type', option.value)}
                                                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                                                            isActive
                                                                ? 'border-[#00c853] bg-[#00c853]/10 shadow-[3px_3px_0px_0px_#00c853]'
                                                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        <p className="text-sm font-black uppercase tracking-widest text-[#1a1a1a] dark:text-white">{option.label}</p>
                                                        <p className="mt-1 text-[11px] leading-4 text-gray-500">{option.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                                            Club Name <span className="text-red-500">*</span>
                                        </label>
                                        <p className="text-xs text-gray-400">Choose a unique name that represents your organization. This is how other users will find you.</p>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            maxLength={120}
                                            required
                                            placeholder="e.g. GrassKickZ Tbilisi Academy"
                                            className="w-full bg-white dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3.5 outline-none focus:border-[#00c853] font-bold transition-colors shadow-[2px_2px_0px_0px_#1a1a1a] dark:shadow-[2px_2px_0px_0px_#000]"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-500">Club Story</label>
                                        <p className="text-xs text-gray-400">Tell players, parents, and partner clubs what your organization is about. This appears on your club profile.</p>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => updateField('description', e.target.value)}
                                            maxLength={2000}
                                            rows={3}
                                            placeholder="Describe your club's mission, history, and what makes it unique..."
                                            className="w-full bg-white dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm resize-none transition-colors shadow-[2px_2px_0px_0px_#1a1a1a] dark:shadow-[2px_2px_0px_0px_#000]"
                                        />
                                    </div>

                                    {/* Contact */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-widest text-gray-500">Contact Information</label>
                                            <p className="mt-1 text-xs text-gray-400">All optional — add now or fill in later from your club workspace.</p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <input
                                                type="email"
                                                value={formData.contactEmail}
                                                onChange={(e) => updateField('contactEmail', e.target.value)}
                                                placeholder="Contact email"
                                                className="w-full bg-white dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm transition-colors"
                                            />
                                            <input
                                                type="text"
                                                value={formData.whatsappNumber}
                                                onChange={(e) => updateField('whatsappNumber', e.target.value)}
                                                placeholder="WhatsApp number"
                                                className="w-full bg-white dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm transition-colors"
                                            />
                                        </div>
                                        <input
                                            type="url"
                                            value={formData.facebookMessengerUrl}
                                            onChange={(e) => updateField('facebookMessengerUrl', e.target.value)}
                                            placeholder="Facebook / Messenger URL (e.g. https://m.me/yourclub)"
                                            className="w-full bg-white dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium text-sm transition-colors"
                                        />
                                    </div>

                                    {/* Preferred contact */}
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-[#00c853]" />
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">Preferred Contact Method</label>
                                            </div>
                                            <p className="mt-1 text-xs text-gray-400">Let people know the best way to reach you. Only methods you've provided contact info for can be selected.</p>
                                        </div>
                                        <div className="space-y-2">
                                            {communicationOptions.map((option) => {
                                                const isActive = formData.preferredCommunicationMethod === option.value;
                                                const isUnavailable = option.value === 'WHATSAPP' ? !hasWhatsapp : !hasMessenger;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        disabled={isUnavailable}
                                                        onClick={() => updateField('preferredCommunicationMethod', option.value)}
                                                        className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                                                            isActive
                                                                ? 'border-[#00c853] bg-[#00c853]/10'
                                                                : isUnavailable
                                                                ? 'border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed'
                                                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        <span className={`mt-1 h-3.5 w-3.5 rounded-full border-2 shrink-0 ${isActive ? 'border-[#00c853] bg-[#00c853]' : 'border-gray-400'}`} />
                                                        <span>
                                                            <span className="flex items-center gap-2 text-sm font-bold text-[#1a1a1a] dark:text-white">
                                                                {option.label}
                                                                {isUnavailable && (
                                                                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:text-amber-400">
                                                                        Add contact info first
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
                                                <span className={`mt-1 h-3.5 w-3.5 rounded-full border-2 shrink-0 ${!formData.preferredCommunicationMethod ? 'border-[#00c853] bg-[#00c853]' : 'border-gray-400'}`} />
                                                <span className="text-sm font-bold text-[#1a1a1a] dark:text-white">No preference yet</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mt-6 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-400">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom navigation bar */}
                <div className="shrink-0 border-t-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#18181b] px-6 py-4">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
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
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
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
                                    {step === 1 && !selectedLocation ? 'Skip & Continue' : 'Next Step'}
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
        </div>
    );
};
