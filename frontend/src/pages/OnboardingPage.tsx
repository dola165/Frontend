import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, refreshAccessToken } from '../api/axiosConfig';
import { Activity, Briefcase, Building2, Camera, ChevronRight, Loader2, User } from 'lucide-react';

const POSITION_OPTIONS = [
    'Goalkeeper',
    'Centre-Back',
    'Left-Back',
    'Right-Back',
    'Defensive Midfield',
    'Central Midfield',
    'Attacking Midfield',
    'Left Winger',
    'Right Winger',
    'Striker'
] as const;

export const OnboardingPage = () => {
    const navigate = useNavigate();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        // Fetch existing data (like if Google provided their real name)
        apiClient.get('/users/me').then(res => {
            const existingName = res.data.fullName || res.data.name;
            const existingRole = res.data.role;
            const existingUsername = res.data.username;
            if (existingUsername) setFetchedUsername(existingUsername);
            if (existingName && existingName !== 'New User') {
                setFormData(prev => ({ ...prev, fullName: existingName }));
            }
            if (existingRole === 'PLAYER' || existingRole === 'FAN' || existingRole === 'AGENT') {
                setFormData(prev => ({ ...prev, role: existingRole }));
            }
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

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a] placeholder:text-[#a1a1aa]';

    return (
        <div className="bg-[#0f1117] flex min-h-screen flex-col items-center justify-center p-6">
            <div className="theme-surface theme-border w-full max-w-2xl rounded-xl border p-8 shadow-2xl md:p-12">

                <div className="mb-8 border-b border-[#ffffff0d] pb-6">
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-[#f4f4f5] mb-2">Establish Your Identity</h1>
                    {fetchedUsername && (
                        <p className="text-sm font-semibold  text-[#16a34a] mb-1">Your handle: @{fetchedUsername}</p>
                    )}
                    <p className="text-sm text-[#a1a1aa]">Complete your profile to access the full network experience.</p>
                </div>

                {step === 1 && (
                    <div>
                        <label className="text-[10px] font-semibold  text-[#a1a1aa] mb-4 block">What is your designation?</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[
                                { id: 'PLAYER', icon: Activity, label: 'Player', desc: 'Seeking clubs & tryouts' },
                                { id: 'ORGANIZER', icon: Building2, label: 'Organizer', desc: 'Building a club or squad' },
                                { id: 'AGENT', icon: Briefcase, label: 'Agent', desc: 'Representing players & talents' },
                                { id: 'FAN', icon: User, label: 'Supporter', desc: 'Following the action' }
                            ].map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setFormData({...formData, role: role.id as 'PLAYER' | 'FAN' | 'ORGANIZER' | 'AGENT'})}
                                    className={`rounded-xl border p-4 text-left transition-colors ${formData.role === role.id ? 'border-[#16a34a] bg-[#16a34a]-soft' : 'border-[#ffffff0d] hover:border-strong'}`}
                                >
                                    <role.icon className={`w-8 h-8 mb-3 ${formData.role === role.id ? 'text-[#16a34a]' : 'text-muted'}`} />
                                    <h3 className="font-semibold uppercase tracking-[0.14em] text-sm mb-1 text-[#f4f4f5]">{role.label}</h3>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa]">{role.desc}</p>
                                </button>
                            ))}
                        </div>

                        <div className="mb-8 space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">Full Legal Name</label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                className={inputClass}
                                placeholder="E.g. Khvicha Kvaratskhelia"
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setStep(2)}
                                disabled={!formData.fullName.trim()}
                                className="w-full inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] text-white px-4 py-3 text-[11px] font-semibold  transition-colors disabled:opacity-50"
                            >
                                Next Phase <ChevronRight className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={!formData.fullName.trim()}
                                className="w-full py-3 text-[11px] font-semibold  text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div>
                        {formData.role === 'PLAYER' && (
                            <>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">Primary Position</label>
                                        <select value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className={`${inputClass} appearance-none`}>
                                            <option value="">Select position</option>
                                            {POSITION_OPTIONS.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">Strong Foot</label>
                                        <select value={formData.preferredFoot} onChange={(e) => setFormData({...formData, preferredFoot: e.target.value})} className={`${inputClass} appearance-none`}>
                                            <option value="Right">Right</option>
                                            <option value="Left">Left</option>
                                            <option value="Both">Both</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">Height (cm)</label>
                                        <input type="number" value={formData.heightCm} onChange={(e) => setFormData({...formData, heightCm: e.target.value})} min={100} max={250} className={inputClass} placeholder="185" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">Weight (kg)</label>
                                        <input type="number" value={formData.weightKg} onChange={(e) => setFormData({...formData, weightKg: e.target.value})} min={30} max={250} className={inputClass} placeholder="78" />
                                    </div>
                                </div>
                            </>
                        )}
                        {formData.role === 'ORGANIZER' && (
                            <div className="mb-6 border border-[#16a34a] bg-[#16a34a]-soft rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                <Building2 className="w-10 h-10 text-[#16a34a] mb-3" />
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">Ready to build your club?</p>
                                <p className="mt-2 text-xs text-[#a1a1aa] max-w-md">After setup you'll be taken to your <strong>My Club</strong> workspace, where you can create your squad, manage rosters, schedule matches, and invite players.</p>
                            </div>
                        )}
                        {formData.role === 'FAN' && (
                            <div className="mb-6 border border-dashed border-[#ffffff0d] bg-[#0f1117] rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">Fan Profile</p>
                                <p className="mt-2 text-xs text-[#a1a1aa]">You can customize your experience and follow clubs from your Account page after setup.</p>
                            </div>
                        )}
                        {formData.role === 'AGENT' && (
                            <div className="space-y-3 mb-6">
                                <div className="border border-[#16a34a] bg-[#16a34a]-soft rounded-xl p-4 flex items-center gap-3">
                                    <Briefcase className="w-5 h-5 text-text-[#16a34a] shrink-0" />
                                    <p className="text-xs text-[#a1a1aa]">Set your agency details now or add them later from your Account page.</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold  text-[#a1a1aa] mb-1 block">Agency Name</label>
                                    <input
                                        type="text"
                                        value={formData.agencyName}
                                        onChange={e => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
                                        placeholder="e.g. Zviad Sports Management"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold  text-[#a1a1aa] mb-1 block">FIFA License Number</label>
                                    <input
                                        type="text"
                                        value={formData.fifaLicenseNumber}
                                        onChange={e => setFormData(prev => ({ ...prev, fifaLicenseNumber: e.target.value }))}
                                        placeholder="e.g. FIFA-202301"
                                        className={inputClass}
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
                            <p className="text-[10px] font-semibold  text-muted">
                                {formData.avatarUrl ? 'Tap to change profile picture' : 'Tap to add profile picture'}
                            </p>
                        </div>

                        <div className="mb-8 space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">Personal Manifesto / Bio</label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                className={`${inputClass} h-24 resize-none`}
                                placeholder="Brief summary of your football philosophy..."
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-4">
                                <button onClick={() => setStep(1)} className="border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 text-[11px] font-semibold  text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
                                    Back
                                </button>
                                <button
                                    onClick={submitProfile}
                                    disabled={isLoading || !hasName}
                                    className="flex-1 inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] text-white px-4 py-3 text-[11px] font-semibold  transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Commit to Database'}
                                </button>
                            </div>
                            <button
                                onClick={handleSkip}
                                disabled={isLoading || !hasName}
                                className="w-full py-3 text-[11px] font-semibold  text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
