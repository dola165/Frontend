import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    BadgeCheck,
    Camera,
    CheckCircle2,
    Clock3,
    KeyRound,
    Loader2,
    Lock,
    Mail,
    ShieldAlert,
    ShieldCheck,
    TriangleAlert
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { EntityTabs, type EntityTabItem } from '../components/layout/EntityTabs';

type Tab = 'profile' | 'security' | 'sessions' | 'accounts' | 'danger';
type Account = {
    id: number;
    username: string;
    email: string;
    role: string;
    displayName: string;
    emailVerified: boolean;
    emailVerifiedAt?: string | null;
    passwordLoginEnabled: boolean;
    fullName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    playerProfile?: {
        primaryPosition?: string | null;
        secondaryPosition?: string | null;
        preferredFoot?: string | null;
        heightCm?: number | null;
        weightKg?: number | null;
        availabilityStatus?: string | null;
    } | null;
    agentProfile?: {
        agencyName?: string | null;
        fifaLicenseNumber?: string | null;
        verified: boolean;
    } | null;
    linkedAccounts: Array<{ provider: string; linkedAt?: string | null }>;
    sessionsSupported: boolean;
    sessionRevocationSupported: boolean;
    accountDeletionSupported: boolean;
};
type SessionSummary = {
    sessions: Array<{ id: number; current: boolean; status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'; expiresAt?: string | null }>;
    activeCount: number;
    revokedCount: number;
    expiredCount: number;
};
type ProfileForm = {
    fullName: string;
    bio: string;
    avatarUrl: string;
    bannerUrl: string;
    position: string;
    secondaryPosition: string;
    preferredFoot: string;
    heightCm: string;
    weightKg: string;
    availabilityStatus: string;
    agencyName: string;
    fifaLicenseNumber: string;
};

const tabItems: EntityTabItem[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'accounts', label: 'Linked Accounts' },
    { id: 'danger', label: 'Danger' }
];

const surfaceClass = 'bg-surface border border-subtle';
const insetClass = 'border border-subtle bg-base';
const labelClass = 'text-[11px] font-black uppercase tracking-[0.18em] text-secondary';
const inputClass = 'w-full border border-subtle bg-base px-3 py-2.5 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-accent-primary';
const textareaClass = `${inputClass} min-h-[120px] resize-none`;

const normalizeTab = (value: string | null): Tab =>
    value === 'security' || value === 'sessions' || value === 'accounts' || value === 'danger' ? value : 'profile';
const trimToUndefined = (value: string) => value.trim() || undefined;
const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString() : null);
const providerLabel = (provider: string) => (provider === 'google' ? 'Google' : provider.charAt(0).toUpperCase() + provider.slice(1));
const buildForm = (account: Account): ProfileForm => ({
    fullName: account.fullName ?? '',
    bio: account.bio ?? '',
    avatarUrl: account.avatarUrl ?? '',
    bannerUrl: account.bannerUrl ?? '',
    position: account.playerProfile?.primaryPosition ?? '',
    secondaryPosition: account.playerProfile?.secondaryPosition ?? '',
    preferredFoot: account.playerProfile?.preferredFoot ?? '',
    heightCm: account.playerProfile?.heightCm != null ? String(account.playerProfile.heightCm) : '',
    weightKg: account.playerProfile?.weightKg != null ? String(account.playerProfile.weightKg) : '',
    availabilityStatus: account.playerProfile?.availabilityStatus ?? 'AVAILABLE',
    agencyName: account.agentProfile?.agencyName ?? '',
    fifaLicenseNumber: account.agentProfile?.fifaLicenseNumber ?? ''
});
const sessionTone = (status: 'ACTIVE' | 'REVOKED' | 'EXPIRED') =>
    status === 'ACTIVE'
        ? 'border-accent-primary bg-accent-primary-soft accent-primary'
        : status === 'REVOKED'
            ? 'border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
            : 'border-subtle bg-base text-secondary';

const Section = ({
    title,
    description,
    actions,
    children
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) => (
    <section className={surfaceClass}>
        <div className="flex flex-col gap-3 border-b border-subtle px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="text-lg font-black uppercase tracking-[0.12em] text-primary">{title}</h2>
                {description && <p className="mt-1 text-sm leading-6 text-secondary">{description}</p>}
            </div>
            {actions}
        </div>
        <div className="p-4">{children}</div>
    </section>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <label className="flex flex-col gap-2">
        <span className={labelClass}>{label}</span>
        {children}
    </label>
);

const StatTile = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className={insetClass}>
        <div className="px-4 py-3">
            <p className={labelClass}>{label}</p>
            <div className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{value}</div>
        </div>
    </div>
);

const DetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-start justify-between gap-4 border-b border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0">
        <p className={labelClass}>{label}</p>
        <div className="max-w-[70%] text-right text-sm font-semibold text-primary">{value}</div>
    </div>
);

export const AccountPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, bootstrapSession } = useAuth();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const [account, setAccount] = useState<Account | null>(null);
    const [form, setForm] = useState<ProfileForm | null>(null);
    const [sessions, setSessions] = useState<SessionSummary | null>(null);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sessionsError, setSessionsError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [sendingVerification, setSendingVerification] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [revokingSessions, setRevokingSessions] = useState(false);
    const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);

    const activeTab = normalizeTab(searchParams.get('tab'));

    const loadAccount = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<Account>('/users/me/account');
            setAccount(response.data);
            setForm(buildForm(response.data));
            setError(null);
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, 'Failed to load your account center.'));
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async () => {
        setSessionsLoading(true);
        try {
            const response = await apiClient.get<SessionSummary>('/auth/sessions');
            setSessions(response.data);
            setSessionsError(null);
        } catch (requestError) {
            setSessions(null);
            setSessionsError(extractApiErrorMessage(requestError, 'Failed to load remembered sessions.'));
        } finally {
            setSessionsLoading(false);
        }
    };

    useEffect(() => {
        void loadAccount();
        void loadSessions();
    }, []);

    const bannerPreview = useMemo(
        () =>
            resolveMediaUrl(form?.bannerUrl) ||
            resolveMediaUrl(account?.bannerUrl) ||
            'https://images.unsplash.com/photo-1518605368461-1ee71161d91a?auto=format&fit=crop&q=80&w=1200&h=420',
        [account?.bannerUrl, form?.bannerUrl]
    );
    const avatarPreview = useMemo(() => resolveMediaUrl(form?.avatarUrl) || resolveMediaUrl(account?.avatarUrl), [account?.avatarUrl, form?.avatarUrl]);
    const initials = (account?.displayName || account?.username || 'TA').substring(0, 2).toUpperCase();
    const updateForm = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));

    const uploadAsset = async (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = event.target.files?.[0];
        if (!file) return;
        const body = new FormData();
        body.append('file', file);
        setUploading(type);
        try {
            const response = await apiClient.post<{ url?: string }>('/media/upload', body, { headers: { 'Content-Type': 'multipart/form-data' }, params: { context: type } });
            if (!response.data?.url) throw new Error('Upload did not return a media URL.');
            updateForm(type === 'avatar' ? 'avatarUrl' : 'bannerUrl', response.data.url);
            setMessage(type === 'avatar' ? 'Avatar updated in the draft form.' : 'Banner updated in the draft form.');
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, 'Failed to upload media.'));
        } finally {
            setUploading(null);
            event.target.value = '';
        }
    };

    const saveProfile = async () => {
        if (!account || !form) return;
        setSaving(true);
        try {
            await apiClient.put('/users/me', {
                fullName: trimToUndefined(form.fullName),
                bio: trimToUndefined(form.bio),
                avatarUrl: trimToUndefined(form.avatarUrl),
                bannerUrl: trimToUndefined(form.bannerUrl),
                position: account.role === 'PLAYER' ? trimToUndefined(form.position) : undefined,
                secondaryPosition: account.role === 'PLAYER' ? trimToUndefined(form.secondaryPosition) : undefined,
                preferredFoot: account.role === 'PLAYER' ? trimToUndefined(form.preferredFoot) : undefined,
                heightCm: account.role === 'PLAYER' && form.heightCm.trim() ? Number(form.heightCm) : undefined,
                weightKg: account.role === 'PLAYER' && form.weightKg.trim() ? Number(form.weightKg) : undefined,
                availabilityStatus: account.role === 'PLAYER' ? trimToUndefined(form.availabilityStatus) : undefined,
                agencyName: account.role === 'AGENT' ? trimToUndefined(form.agencyName) : undefined,
                fifaLicenseNumber: account.role === 'AGENT' ? trimToUndefined(form.fifaLicenseNumber) : undefined
            });
            await loadAccount();
            await bootstrapSession();
            setMessage('Account profile updated.');
            setError(null);
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, 'Failed to save your account profile.'));
        } finally {
            setSaving(false);
        }
    };

    const resendVerification = async () => {
        setSendingVerification(true);
        try {
            const response = await apiClient.post<{ message?: string }>('/auth/send-verification');
            await loadAccount();
            await bootstrapSession();
            setMessage(response.data?.message || 'Verification email sent.');
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, 'Failed to send verification email.'));
        } finally {
            setSendingVerification(false);
        }
    };

    const changePassword = async (event: FormEvent) => {
        event.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('New password and confirmation do not match.');
            return;
        }
        setChangingPassword(true);
        try {
            const response = await apiClient.post<{ message?: string }>('/auth/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            await loadSessions();
            setMessage(response.data?.message || 'Password changed successfully.');
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, 'Failed to change password.'));
        } finally {
            setChangingPassword(false);
        }
    };

    const revokeOtherSessions = async () => {
        setRevokingSessions(true);
        try {
            const response = await apiClient.post<{ message?: string }>('/auth/sessions/revoke-others');
            await loadSessions();
            setMessage(response.data?.message || 'Other remembered sessions have been signed out.');
        } catch (requestError) {
            setSessionsError(extractApiErrorMessage(requestError, 'Failed to sign out other remembered sessions.'));
        } finally {
            setRevokingSessions(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin accent-primary" />
            </div>
        );
    }

    if (!account || !form) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className={`${surfaceClass} max-w-xl px-8 py-10 text-center`}>
                    <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-500" />
                    <h1 className="text-xl font-black uppercase tracking-[0.18em] text-primary">Account Center Offline</h1>
                    <p className="mt-3 text-sm leading-6 text-secondary">{error || 'Your account settings could not be loaded right now.'}</p>
                    <button type="button" onClick={() => void loadAccount()} className="mt-6 border border-accent-primary bg-accent-primary-soft px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-base min-h-full pb-10">
            <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
                <header className="border-b border-subtle pb-5">
                    <Link
                        to={user?.id ? `/profile/${user.id}` : '/feed'}
                        className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                    </Link>

                    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Utility Panel</p>
                            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary">Account Center</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
                                Identity, authentication, linked providers, and session controls live here as one settings destination with local tabs.
                            </p>

                            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-subtle bg-surface text-xl font-black uppercase text-primary">
                                    {avatarPreview ? <img src={avatarPreview} alt={account.displayName} className="h-full w-full object-cover" /> : initials}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-[0.12em] text-primary">{account.displayName}</h2>
                                    <p className="mt-1 text-sm text-secondary">{account.email}</p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
                                        <span className="border border-subtle bg-surface px-2.5 py-1 text-primary">{account.role}</span>
                                        <span className={`border px-2.5 py-1 ${account.emailVerified ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                                            {account.emailVerified ? 'Email Verified' : 'Verification Pending'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <section className={`${surfaceClass} px-4 py-4`}>
                            <p className={labelClass}>Quick Actions</p>
                            <div className="mt-4 grid gap-2">
                                <Link to={user?.id ? `/profile/${user.id}` : '/feed'} className="border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                                    View Public Profile
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setSearchParams({ tab: 'security' })}
                                    className="border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                                >
                                    Security Controls
                                </button>
                                <Link to="/tournaments/setup" className="border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                                    Tournament Setup
                                </Link>
                                {account.role === 'SYSTEM_ADMIN' && (
                                    <Link to="/admin" className="border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                                        Admin Panel
                                    </Link>
                                )}
                            </div>
                        </section>
                    </div>
                </header>

                <EntityTabs items={tabItems} activeId={activeTab} onChange={(tab) => setSearchParams({ tab })} />

                {message && (
                    <div className="border border-accent-primary bg-accent-primary-soft px-4 py-3 text-sm font-semibold accent-primary">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {error}
                    </div>
                )}

                {activeTab === 'profile' && (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <Section
                            title="Profile Draft"
                            description="This tab controls the public identity data that flows into your Talanti profile."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => void saveProfile()}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    Save Profile
                                </button>
                            }
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Display Name">
                                    <input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Full name" className={inputClass} />
                                </Field>
                                <Field label="Email">
                                    <input readOnly value={account.email} className={`${inputClass} cursor-not-allowed text-secondary`} />
                                </Field>
                            </div>

                            <div className="mt-4">
                                <Field label="Bio">
                                    <textarea value={form.bio} onChange={(event) => updateForm('bio', event.target.value)} rows={5} placeholder="Football background, experience, or role summary" className={textareaClass} />
                                </Field>
                            </div>

                            {account.role === 'PLAYER' && (
                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <Field label="Primary Position">
                                        <select value={form.position} onChange={(event) => updateForm('position', event.target.value)} className={inputClass}>
                                            <option value="">Select position</option>
                                            {['Goalkeeper','Centre-Back','Left-Back','Right-Back','Defensive Midfield','Central Midfield','Attacking Midfield','Left Winger','Right Winger','Striker'].map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Secondary Position">
                                        <input value={form.secondaryPosition} onChange={(event) => updateForm('secondaryPosition', event.target.value)} className={inputClass} />
                                    </Field>
                                    <Field label="Preferred Foot">
                                        <select value={form.preferredFoot} onChange={(event) => updateForm('preferredFoot', event.target.value)} className={inputClass}>
                                            <option value="">Select</option>
                                            <option value="RIGHT">Right</option>
                                            <option value="LEFT">Left</option>
                                            <option value="BOTH">Both</option>
                                        </select>
                                    </Field>
                                    <Field label="Availability">
                                        <select value={form.availabilityStatus} onChange={(event) => updateForm('availabilityStatus', event.target.value)} className={inputClass}>
                                            <option value="AVAILABLE">Available</option>
                                            <option value="LIMITED">Limited</option>
                                            <option value="UNAVAILABLE">Unavailable</option>
                                        </select>
                                    </Field>
                                    <Field label="Height (cm)">
                                        <input type="number" value={form.heightCm} onChange={(event) => updateForm('heightCm', event.target.value)} className={inputClass} />
                                    </Field>
                                    <Field label="Weight (kg)">
                                        <input type="number" value={form.weightKg} onChange={(event) => updateForm('weightKg', event.target.value)} className={inputClass} />
                                    </Field>
                                </div>
                            )}

                            {account.role === 'AGENT' && (
                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <Field label="Agency Name">
                                        <input value={form.agencyName} onChange={(event) => updateForm('agencyName', event.target.value)} className={inputClass} />
                                    </Field>
                                    <Field label="License Number">
                                        <input value={form.fifaLicenseNumber} onChange={(event) => updateForm('fifaLicenseNumber', event.target.value)} className={inputClass} />
                                    </Field>
                                </div>
                            )}
                        </Section>

                        <div className="flex flex-col gap-5">
                            <Section title="Profile Assets" description="Banner and avatar stay here as controlled profile media, not as a separate page.">
                                <div className="relative h-32 overflow-hidden border border-subtle bg-base">
                                    <img src={bannerPreview} alt="Account banner" className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => bannerInputRef.current?.click()}
                                        className="absolute right-3 top-3 inline-flex items-center gap-2 border border-subtle bg-surface px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                    >
                                        {uploading === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                        Banner
                                    </button>
                                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAsset(event, 'banner')} />
                                </div>

                                <div className="mt-4 flex items-center gap-4">
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden border border-subtle bg-base text-xl font-black uppercase text-primary">
                                        {avatarPreview ? <img src={avatarPreview} alt={account.displayName} className="h-full w-full object-cover" /> : initials}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => avatarInputRef.current?.click()}
                                            className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                        >
                                            {uploading === 'avatar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                            Avatar
                                        </button>
                                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAsset(event, 'avatar')} />
                                        <p className="text-xs leading-5 text-secondary">Uploads update the draft immediately. Save the profile to persist them.</p>
                                    </div>
                                </div>
                            </Section>

                            <Section title="Profile Notes">
                                <DetailRow label="Username" value={account.username} />
                                <DetailRow label="Role" value={account.role} />
                                <DetailRow label="Linked Providers" value={account.linkedAccounts.length || 'None'} />
                                <DetailRow label="Public View" value={<Link to={user?.id ? `/profile/${user.id}` : '/feed'} className="accent-primary underline underline-offset-4">Open profile</Link>} />
                            </Section>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <Section title="Email And Password" description="Recovery and password flows stay in one operational section.">
                            <div className={`${insetClass} px-4 py-4`}>
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                            {account.emailVerified ? <BadgeCheck className="h-4 w-4 accent-primary" /> : <Mail className="h-4 w-4 text-amber-500" />}
                                            <span>{account.emailVerified ? 'Email verified' : 'Email verification pending'}</span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-secondary">
                                            {account.emailVerified ? `Verified for ${account.email}${fmt(account.emailVerifiedAt) ? ` on ${fmt(account.emailVerifiedAt)}` : '.'}` : `We have not confirmed ${account.email} yet.`}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void resendVerification()}
                                        disabled={account.emailVerified || sendingVerification}
                                        className="inline-flex items-center justify-center gap-2 border border-subtle bg-base px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary disabled:opacity-60"
                                    >
                                        {sendingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                        {account.emailVerified ? 'Verified' : 'Resend Email'}
                                    </button>
                                </div>
                            </div>

                            <div className={`mt-4 ${insetClass} px-4 py-4`}>
                                <div className="flex items-start gap-3">
                                    {account.passwordLoginEnabled ? <ShieldCheck className="mt-0.5 h-5 w-5 accent-primary" /> : <Lock className="mt-0.5 h-5 w-5 text-amber-500" />}
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-primary">Password State</h3>
                                        <p className="mt-2 text-sm leading-6 text-secondary">
                                            {account.passwordLoginEnabled ? 'Password sign-in is configured. Changing it revokes remembered refresh sessions across other browsers.' : 'This account currently relies on a linked provider. Use the password reset route for this email when you are ready to add a password.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {account.passwordLoginEnabled && (
                                <form onSubmit={changePassword} className="mt-4 grid gap-4">
                                    <Field label="Current Password">
                                        <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className={inputClass} />
                                    </Field>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Field label="New Password">
                                            <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className={inputClass} />
                                        </Field>
                                        <Field label="Confirm Password">
                                            <input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} className={inputClass} />
                                        </Field>
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="submit" disabled={changingPassword} className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60">
                                            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                            Change Password
                                        </button>
                                    </div>
                                </form>
                            )}
                        </Section>

                        <Section title="Deferred Controls">
                            <div className={`${insetClass} flex items-start gap-3 px-4 py-4`}>
                                <Clock3 className="mt-0.5 h-5 w-5 text-secondary" />
                                <div>
                                    <p className="text-sm font-semibold text-primary">Two-factor authentication stays intentionally deferred for a later phase.</p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">The slot remains visible so future security additions land in a stable place without changing the navigation model.</p>
                                </div>
                            </div>
                        </Section>
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <Section
                        title="Remembered Sessions"
                        description="Review active, revoked, and expired refresh sessions from one stream."
                        actions={
                            account.sessionRevocationSupported ? (
                                <button
                                    type="button"
                                    onClick={() => void revokeOtherSessions()}
                                    disabled={revokingSessions || sessionsLoading}
                                    className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60"
                                >
                                    {revokingSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                    Sign Out Others
                                </button>
                            ) : null
                        }
                    >
                        {sessionsError && (
                            <div className="mb-4 border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                                {sessionsError}
                            </div>
                        )}

                        {!account.sessionsSupported ? (
                            <div className={`${insetClass} px-4 py-4 text-sm text-secondary`}>
                                Session inventory is not exposed by the backend yet.
                            </div>
                        ) : sessionsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin accent-primary" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <StatTile label="Active" value={sessions?.activeCount ?? 0} />
                                    <StatTile label="Revoked" value={sessions?.revokedCount ?? 0} />
                                    <StatTile label="Expired" value={sessions?.expiredCount ?? 0} />
                                </div>

                                <div className="bg-surface border border-subtle">
                                    {sessions?.sessions.length ? (
                                        <div className="divide-y divide-[color:var(--border-subtle)]">
                                            {sessions.sessions.map((session) => (
                                                <article key={session.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                                                                {session.current ? 'Current Browser Session' : `Remembered Session #${session.id}`}
                                                            </p>
                                                            <span className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${sessionTone(session.status)}`}>
                                                                {session.status}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-secondary">
                                                            {fmt(session.expiresAt) ? `Refresh access expires ${fmt(session.expiresAt)}.` : 'Expiry details are not available for this session.'}
                                                        </p>
                                                    </div>
                                                    {session.current && (
                                                        <span className="border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">
                                                            Current
                                                        </span>
                                                    )}
                                                </article>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-10 text-sm text-secondary">No remembered sessions are currently recorded for this account.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </Section>
                )}

                {activeTab === 'accounts' && (
                <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                        <Section title="Capability Summary">
                            <DetailRow label="Password Sign-In" value={account.passwordLoginEnabled ? 'Enabled' : 'Not configured'} />
                            <DetailRow label="External Providers" value={account.linkedAccounts.length > 0 ? `${account.linkedAccounts.length} connected` : 'None'} />
                        </Section>

                        <Section title="Linked Providers" description="Provider visibility stays local to this destination and does not need its own page.">
                            {account.linkedAccounts.length === 0 ? (
                                <div className={`${insetClass} px-4 py-4 text-sm text-secondary`}>
                                    No linked providers are attached to this account yet.
                                </div>
                            ) : (
                                <div className="bg-surface border border-subtle">
                                    <div className="divide-y divide-[color:var(--border-subtle)]">
                                        {account.linkedAccounts.map((linked) => (
                                            <article key={`${linked.provider}-${linked.linkedAt || 'current'}`} className="flex items-center justify-between gap-4 px-4 py-4">
                                                <div>
                                                    <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">{providerLabel(linked.provider)}</p>
                                                    <p className="mt-1 text-sm text-secondary">{linked.linkedAt ? `Linked ${fmt(linked.linkedAt)}` : 'Linked account'}</p>
                                                </div>
                                                <BadgeCheck className="h-5 w-5 accent-primary" />
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={`mt-4 ${insetClass} px-4 py-4 text-sm leading-6 text-secondary`}>
                                Linking and unlinking flows beyond visibility stay intentionally deferred until the backend surface is broader.
                            </div>
                        </Section>
                    </div>
                )}

                {activeTab === 'danger' && (
                    <Section title="Danger Zone" description="Destructive account actions belong here and nowhere else in the navigation.">
                        <div className="border border-rose-300/40 bg-rose-50 px-4 py-4 dark:bg-rose-500/10">
                            <div className="flex items-start gap-3">
                                <TriangleAlert className="mt-0.5 h-5 w-5 text-rose-500" />
                                <div>
                                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                                        {account.accountDeletionSupported ? 'Account deletion is available for this account.' : 'Account deletion is not available in this phase.'}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">
                                        {account.accountDeletionSupported ? 'This control can be wired here without changing the account-center structure.' : 'The surface stays here so later destructive flows plug into the right place without pretending they work today.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
};
