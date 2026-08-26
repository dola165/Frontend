import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, refreshAccessToken } from '../api/axiosConfig';
import { Activity, Briefcase, Building2, Camera, ChevronRight, Loader2, ShieldCheck, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isMinor } from '../utils/age';
import { getPendingName, clearPendingName } from '../utils/authNameCarry';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
    authInputClass,
    authPrimaryButtonClass,
    authGhostButtonClass,
    authSecondaryButtonClass,
    authLabelClass,
} from '../components/auth/authClasses';

const POSITION_OPTIONS = [
    { label: 'Goalkeeper', value: 'GOALKEEPER' },
    { label: 'Centre-Back', value: 'CENTER_BACK' },
    { label: 'Left-Back', value: 'LEFT_BACK' },
    { label: 'Right-Back', value: 'RIGHT_BACK' },
    { label: 'Defensive Midfield', value: 'DEFENSIVE_MIDFIELDER' },
    { label: 'Central Midfield', value: 'CENTRAL_MIDFIELDER' },
    { label: 'Attacking Midfield', value: 'ATTACKING_MIDFIELDER' },
    { label: 'Left Winger', value: 'LEFT_WINGER' },
    { label: 'Right Winger', value: 'RIGHT_WINGER' },
    { label: 'Striker', value: 'STRIKER' }
] as const;

const FOOT_OPTIONS = ['Right', 'Left', 'Both'] as const;

export const OnboardingPage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { bootstrapSession } = useAuth();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [isMinorUser, setIsMinorUser] = useState(false);
    const [existingRole, setExistingRole] = useState<'PLAYER' | 'FAN' | 'ORGANIZER' | 'AGENT' | null>(null);

    const [formData, setFormData] = useState({
        fullName: '',
        role: 'PLAYER' as 'PLAYER' | 'FAN' | 'ORGANIZER' | 'AGENT',
        position: '',
        preferredFoot: 'Right',
        heightCm: '',
        weightKg: '',
        bio: '',
        avatarUrl: '',
        agencyName: '',
        fifaLicenseNumber: ''
    });

    const [fetchedUsername, setFetchedUsername] = useState('');

    useEffect(() => {
        // Fetch existing data (like if Google provided their real name).
        // The name typed on the register form rides in sessionStorage (authNameCarry)
        // and wins over the server name — /auth/register has no name field.
        apiClient.get('/users/me').then(res => {
            const existingName = res.data.fullName || res.data.name;
            const roleValue = res.data.role;
            const existingUsername = res.data.username;
            if (existingUsername) setFetchedUsername(existingUsername);
            const pending = getPendingName();
            if (pending) {
                setFormData(prev => ({ ...prev, fullName: pending }));
                clearPendingName();
            } else if (existingName && existingName !== 'New User') {
                setFormData(prev => ({ ...prev, fullName: existingName }));
            }
            // Every self-registered account already chose a role at sign-up, so
            // onboarding must not ask again (and must prefill ORGANIZER too —
            // it was previously excluded, letting organizers self-downgrade).
            if (roleValue === 'PLAYER' || roleValue === 'FAN' || roleValue === 'ORGANIZER' || roleValue === 'AGENT') {
                setFormData(prev => ({ ...prev, role: roleValue }));
                setExistingRole(roleValue);
            }
            // Missing DOB = adult, mirroring backend MinorPolicy.
            setIsMinorUser(isMinor(res.data.dob));
        });
    }, []);

    const submitProfile = async () => {
        setIsLoading(true);
        try {
            await apiClient.put('/users/me/profile', {
                fullName: formData.fullName,
                role: formData.role,
                position: formData.position || undefined,
                preferredFoot: formData.preferredFoot,
                heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
                weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
                bio: formData.bio || undefined,
                avatarUrl: formData.avatarUrl || undefined,
                agencyName: formData.agencyName || undefined,
                fifaLicenseNumber: formData.fifaLicenseNumber || undefined
            });
            await refreshAccessToken();
            // Refresh the auth user BEFORE navigating: the App-level guard
            // redirects any authenticated user with profileComplete=false back
            // to /onboarding, and a stale user object caused the endless
            // register → onboarding → register loop.
            await bootstrapSession();
            const destination = formData.role === 'ORGANIZER' ? '/my-club'
                : formData.role === 'AGENT' ? '/agent/dashboard'
                : '/feed';
            navigate(destination);
        } catch {
            navigate('/feed');
        } finally {
            setIsLoading(false);
        }
    };

    const hasName = formData.fullName.trim().length > 0;

    const handleSkip = async () => {
        if (!hasName) return; // Prevent skip without entering name
        setIsLoading(true);
        try {
            await apiClient.put('/users/me/profile', {
                fullName: formData.fullName,
                role: formData.role
            });
            await refreshAccessToken();
            await bootstrapSession();
            const destination = formData.role === 'ORGANIZER' ? '/my-club'
                : formData.role === 'AGENT' ? '/agent/dashboard'
                : '/feed';
            navigate(destination);
        } catch {
            navigate('/feed');
        } finally {
            setIsLoading(false);
        }
    };

    const uploadAvatar = async (file: File) => {
        const body = new FormData();
        body.append('file', file);
        setUploadingAvatar(true);
        try {
            const response = await apiClient.post<{ url?: string }>('/media/upload', body, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { context: 'avatar' }
            });
            if (response.data?.url) {
                setFormData(prev => ({ ...prev, avatarUrl: response.data.url! }));
            }
        } catch {
            // Ignore upload failure, user can add later
        } finally {
            setUploadingAvatar(false);
        }
    };

    const roleOptions: ReadonlyArray<{ id: 'PLAYER' | 'FAN' | 'ORGANIZER' | 'AGENT'; icon: typeof Activity; label: string; desc: string }> = [
        { id: 'PLAYER', icon: Activity, label: t('onboarding.rolePlayer'), desc: t('onboarding.rolePlayerDesc') },
        { id: 'ORGANIZER', icon: Building2, label: t('onboarding.roleOrganizer'), desc: t('onboarding.roleOrganizerDesc') },
        { id: 'FAN', icon: User, label: t('onboarding.roleFan'), desc: t('onboarding.roleFanDesc') },
    ];

    return (
        <div className="relative min-h-screen bg-[#0f1117] text-[#f4f4f5]">
            {/* same glow backdrop as the auth split shell */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,200,83,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,200,83,0.07),transparent_42%)]" />

            <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
                <div className="theme-surface theme-border w-full max-w-2xl rounded-xl border p-8 shadow-2xl md:p-12">
                    <div className="mb-8 border-b border-[#ffffff0d] pb-6">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                {[1, 2].map((s) => (
                                    <span
                                        key={s}
                                        className={`h-2 w-2 rounded-full ${
                                            s === step ? 'bg-[#16a34a]' : s < step ? 'bg-[#a1a1aa]' : 'bg-[#ffffff0d]'
                                        }`}
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                                {t('onboarding.stepOf', { current: step, total: 2 })}
                            </span>
                        </div>
                        <h1 className="text-3xl font-semibold uppercase tracking-tight text-[#f4f4f5] mb-2">
                            {t('onboarding.title')}
                        </h1>
                        {fetchedUsername && (
                            <p className="text-sm font-semibold text-[#16a34a] mb-1">
                                {t('onboarding.handleLabel', { username: fetchedUsername })}
                            </p>
                        )}
                        <p className="text-sm text-[#a1a1aa]">{t('onboarding.subtitle')}</p>
                    </div>

                    {step === 1 && (
                        <div>
                            <label className={`${authLabelClass} mb-4 block`}>{t('onboarding.designation')}</label>
                            {existingRole ? (
                                <div className="mb-8 flex items-center gap-3 rounded-xl border border-[#ffffff0d] bg-[#0f1117] p-4">
                                    <StatusBadge tone="neutral">{formData.role}</StatusBadge>
                                    <p className="text-xs font-semibold text-[#a1a1aa]">
                                        Chosen at sign-up — continue with your name below.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    {roleOptions.map(role => (
                                        <button
                                            key={role.id}
                                            onClick={() => setFormData({...formData, role: role.id})}
                                            className={`rounded-xl border p-4 text-left transition-colors ${formData.role === role.id ? 'border-[#16a34a] bg-[#16a34a]/10' : 'border-[#ffffff0d] hover:border-strong'}`}
                                        >
                                            <role.icon className={`w-8 h-8 mb-3 ${formData.role === role.id ? 'text-[#16a34a]' : 'text-muted'}`} />
                                            <h3 className="font-semibold uppercase tracking-[0.14em] text-sm mb-1 text-[#f4f4f5]">{role.label}</h3>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa]">{role.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="mb-8 space-y-2">
                                <label htmlFor="onboarding-name" className={authLabelClass}>
                                    {t('onboarding.labelName')}
                                </label>
                                <input
                                    id="onboarding-name"
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                    className={authInputClass}
                                    placeholder={t('onboarding.namePlaceholder')}
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!hasName}
                                    className={authPrimaryButtonClass}
                                >
                                    {t('onboarding.next')} <ChevronRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleSkip}
                                    disabled={!hasName}
                                    className={authGhostButtonClass}
                                >
                                    {t('onboarding.skip')}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            {formData.role === 'ORGANIZER' && (
                                <div className="mb-6 border border-[#16a34a] bg-[#16a34a]/10 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                    <Building2 className="w-10 h-10 text-[#16a34a] mb-3" />
                                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">
                                        {t('onboarding.orgCardTitle')}
                                    </p>
                                    <p className="mt-2 text-xs text-[#a1a1aa] max-w-md">{t('onboarding.orgCardBody')}</p>
                                </div>
                            )}
                            {formData.role === 'FAN' && (
                                <div className="mb-6 border border-dashed border-[#ffffff0d] bg-[#0f1117] rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">
                                        {t('onboarding.fanCardTitle')}
                                    </p>
                                    <p className="mt-2 text-xs text-[#a1a1aa]">{t('onboarding.fanCardBody')}</p>
                                </div>
                            )}
                            {formData.role === 'AGENT' && (
                                <div className="mb-6 border border-[#16a34a] bg-[#16a34a]/10 rounded-xl p-4 flex items-center gap-3">
                                    <Briefcase className="w-5 h-5 text-[#16a34a] shrink-0" />
                                    <p className="text-xs text-[#a1a1aa]">{t('onboarding.agencyHint')}</p>
                                </div>
                            )}

                            {!isMinorUser ? (
                                <div className="mb-6 rounded-xl border border-[#ffffff0d] bg-[#0f1117] p-6">
                                    <div className="mb-5 flex items-center gap-3">
                                        <StatusBadge tone="neutral">{t('onboarding.optionalBadge')}</StatusBadge>
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">
                                                {t('onboarding.optionalTitle')}
                                            </h3>
                                            <p className="mt-0.5 text-xs text-[#a1a1aa]">{t('onboarding.optionalNote')}</p>
                                        </div>
                                    </div>

                                    {formData.role === 'PLAYER' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="onboarding-position" className={authLabelClass}>
                                                        {t('onboarding.labelPosition')}
                                                    </label>
                                                    <select
                                                        id="onboarding-position"
                                                        value={formData.position}
                                                        onChange={(e) => setFormData({...formData, position: e.target.value})}
                                                        className={`${authInputClass} appearance-none`}
                                                    >
                                                        <option value="">{t('onboarding.positionPlaceholder')}</option>
                                                        {POSITION_OPTIONS.map(p => (
                                                            <option key={p.value} value={p.value}>{p.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="onboarding-foot" className={authLabelClass}>
                                                        {t('onboarding.labelFoot')}
                                                    </label>
                                                    <select
                                                        id="onboarding-foot"
                                                        value={formData.preferredFoot}
                                                        onChange={(e) => setFormData({...formData, preferredFoot: e.target.value})}
                                                        className={`${authInputClass} appearance-none`}
                                                    >
                                                        {FOOT_OPTIONS.map(f => (
                                                            <option key={f} value={f}>
                                                                {f === 'Right' ? t('onboarding.footRight') : f === 'Left' ? t('onboarding.footLeft') : t('onboarding.footBoth')}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div className="space-y-2">
                                                    <label htmlFor="onboarding-height" className={authLabelClass}>
                                                        {t('onboarding.labelHeight')}
                                                    </label>
                                                    <input
                                                        id="onboarding-height"
                                                        type="number"
                                                        value={formData.heightCm}
                                                        onChange={(e) => setFormData({...formData, heightCm: e.target.value})}
                                                        min={100}
                                                        max={250}
                                                        className={authInputClass}
                                                        placeholder="185"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="onboarding-weight" className={authLabelClass}>
                                                        {t('onboarding.labelWeight')}
                                                    </label>
                                                    <input
                                                        id="onboarding-weight"
                                                        type="number"
                                                        value={formData.weightKg}
                                                        onChange={(e) => setFormData({...formData, weightKg: e.target.value})}
                                                        min={30}
                                                        max={250}
                                                        className={authInputClass}
                                                        placeholder="78"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {formData.role === 'AGENT' && (
                                        <div className="space-y-3 mb-6">
                                            <div>
                                                <label htmlFor="onboarding-agency" className={`${authLabelClass} mb-1 block`}>
                                                    {t('onboarding.labelAgency')}
                                                </label>
                                                <input
                                                    id="onboarding-agency"
                                                    type="text"
                                                    value={formData.agencyName}
                                                    onChange={e => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
                                                    placeholder={t('onboarding.agencyPlaceholder')}
                                                    className={authInputClass}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="onboarding-fifa" className={`${authLabelClass} mb-1 block`}>
                                                    {t('onboarding.labelFifa')}
                                                </label>
                                                <input
                                                    id="onboarding-fifa"
                                                    type="text"
                                                    value={formData.fifaLicenseNumber}
                                                    onChange={e => setFormData(prev => ({ ...prev, fifaLicenseNumber: e.target.value }))}
                                                    placeholder={t('onboarding.fifaPlaceholder')}
                                                    className={authInputClass}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-6 flex flex-col items-center gap-3">
                                        <input
                                            ref={avatarInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) uploadAvatar(file);
                                                e.target.value = '';
                                            }}
                                        />
                                        <div
                                            onClick={() => avatarInputRef.current?.click()}
                                            className={`flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${
                                                formData.avatarUrl
                                                    ? 'border-[#16a34a]'
                                                    : 'border-[#ffffff0d] hover:border-[#16a34a]'
                                            }`}
                                        >
                                            {uploadingAvatar ? (
                                                <Loader2 className="h-6 w-6 animate-spin text-muted" />
                                            ) : formData.avatarUrl ? (
                                                <img src={formData.avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                                            ) : (
                                                <Camera className="h-6 w-6 text-muted" />
                                            )}
                                        </div>
                                        <p className="text-[10px] font-semibold text-muted">
                                            {formData.avatarUrl ? t('onboarding.avatarChange') : t('onboarding.avatarAdd')}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="onboarding-bio" className={authLabelClass}>
                                            {t('onboarding.labelBio')}
                                        </label>
                                        <textarea
                                            id="onboarding-bio"
                                            value={formData.bio}
                                            onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                            className={`${authInputClass} h-24 resize-none`}
                                            placeholder={t('onboarding.bioPlaceholder')}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#ffffff0d] bg-[#0f1117] p-6">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#16a34a]" />
                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">
                                            {t('onboarding.minorNoteTitle')}
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">
                                            {t('onboarding.minorNoteBody')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setStep(1)}
                                        className={authSecondaryButtonClass}
                                    >
                                        {t('onboarding.back')}
                                    </button>
                                    <button
                                        onClick={submitProfile}
                                        disabled={isLoading || !hasName}
                                        className="flex-1 inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] text-white px-4 py-3 text-[11px] font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.submit')}
                                    </button>
                                </div>
                                <button
                                    onClick={handleSkip}
                                    disabled={isLoading || !hasName}
                                    className={authGhostButtonClass}
                                >
                                    {t('onboarding.skip')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
