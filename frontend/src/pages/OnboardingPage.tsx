import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, refreshAccessToken } from '../api/axiosConfig';
import { Activity, Building2, Camera, ChevronRight, Loader2, User } from 'lucide-react';

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
        role: 'PLAYER',
        position: '',
        preferredFoot: 'Right',
        heightCm: '',
        weightKg: '',
        bio: '',
        avatarUrl: ''
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
            if (existingRole === 'PLAYER' || existingRole === 'FAN') {
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
                avatarUrl: formData.avatarUrl || undefined
            });
            await refreshAccessToken();
            const destination = formData.role === 'ORGANIZER' ? '/my-club' : '/feed';
            navigate(destination);
        } catch {
            navigate('/feed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        setIsLoading(true);
        try {
            if (formData.fullName.trim()) {
                await apiClient.put('/users/me/profile', {
                    fullName: formData.fullName,
                    role: formData.role
                });
                await refreshAccessToken();
            }
            const destination = formData.role === 'ORGANIZER' ? '/my-club' : '/feed';
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

    return (
        <div className="min-h-screen bg-[#fcf8f2] dark:bg-[#09090b] flex flex-col justify-center items-center p-6 selection:bg-[#00c853]/20 dark:selection:bg-[#00c853]/30 font-sans text-[#1a1a1a] dark:text-gray-100">
            <div className="w-full max-w-2xl bg-white dark:bg-[#18181b] p-8 md:p-12 rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000]">

                <div className="mb-8 border-b-2 border-gray-200 dark:border-gray-700 pb-6">
                    <h1 className="text-4xl font-serif font-bold tracking-tighter italic uppercase mb-2">Establish Your Identity</h1>
                    {fetchedUsername && (
                        <p className="text-sm text-[#00c853] font-bold uppercase tracking-wide mb-1">Your handle: @{fetchedUsername}</p>
                    )}
                    <p className="text-gray-500 font-serif italic text-sm">The database needs your credentials before granting network access.</p>
                </div>

                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <label className="block text-xs font-black uppercase tracking-widest mb-4 text-gray-500">What is your designation?</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[
                                { id: 'PLAYER', icon: Activity, label: 'Player', desc: 'Seeking clubs & tryouts' },
                                { id: 'ORGANIZER', icon: Building2, label: 'Organizer', desc: 'Building a club or squad' },
                                { id: 'FAN', icon: User, label: 'Supporter', desc: 'Following the action' }
                            ].map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setFormData({...formData, role: role.id})}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${formData.role === role.id ? 'border-[#00c853] bg-[#00c853]/10 dark:bg-[#00c853]/10 shadow-[4px_4px_0px_0px_#00c853]' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
                                >
                                    <role.icon className={`w-8 h-8 mb-3 ${formData.role === role.id ? 'text-[#00c853]' : 'text-gray-400'}`} />
                                    <h3 className="font-black uppercase tracking-widest text-sm mb-1">{role.label}</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">{role.desc}</p>
                                </button>
                            ))}
                        </div>

                        <div className="mb-8">
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Full Legal Name</label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-bold transition-colors"
                                placeholder="E.g. Khvicha Kvaratskhelia"
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setStep(2)}
                                disabled={!formData.fullName.trim()}
                                className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] hover:bg-gray-800 dark:hover:bg-gray-200 font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#00c853] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                Next Phase <ChevronRight className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSkip}
                                className="w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        {formData.role === 'PLAYER' && (
                            <>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Primary Position</label>
                                        <select value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold appearance-none">
                                            <option value="">Select position</option>
                                            {POSITION_OPTIONS.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Strong Foot</label>
                                        <select value={formData.preferredFoot} onChange={(e) => setFormData({...formData, preferredFoot: e.target.value})} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold appearance-none">
                                            <option value="Right">Right</option>
                                            <option value="Left">Left</option>
                                            <option value="Both">Both</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Height (cm)</label>
                                        <input type="number" value={formData.heightCm} onChange={(e) => setFormData({...formData, heightCm: e.target.value})} min={100} max={250} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold" placeholder="185" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Weight (kg)</label>
                                        <input type="number" value={formData.weightKg} onChange={(e) => setFormData({...formData, weightKg: e.target.value})} min={30} max={250} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold" placeholder="78" />
                                    </div>
                                </div>
                            </>
                        )}
                        {formData.role === 'ORGANIZER' && (
                            <div className="mb-6 p-6 bg-[#00c853]/5 dark:bg-[#00c853]/10 rounded-xl border-2 border-dashed border-[#00c853] flex flex-col items-center justify-center text-center">
                                <Building2 className="w-10 h-10 text-[#00c853] mb-3" />
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Ready to build your club?</p>
                                <p className="mt-2 text-xs text-gray-500 max-w-md">After setup you'll be taken to your <strong>My Club</strong> workspace, where you can create your squad, manage rosters, schedule matches, and invite players.</p>
                            </div>
                        )}
                        {formData.role === 'FAN' && (
                            <div className="mb-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Fan Profile</p>
                                <p className="mt-2 text-xs text-gray-500">You can customize your experience and follow clubs from your Account page after setup.</p>
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
                                        ? 'border-[#00c853]'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-[#00c853]'
                                }`}
                            >
                                {uploadingAvatar ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                ) : formData.avatarUrl ? (
                                    <img src={formData.avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                                ) : (
                                    <Camera className="h-6 w-6 text-gray-400" />
                                )}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                {formData.avatarUrl ? 'Tap to change profile picture' : 'Tap to add profile picture'}
                            </p>
                        </div>

                        <div className="mb-8">
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Personal Manifesto / Bio</label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-bold h-24 resize-none"
                                placeholder="Brief summary of your football philosophy..."
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-4">
                                <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 font-black uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors">
                                    Back
                                </button>
                                <button
                                    onClick={submitProfile}
                                    disabled={isLoading}
                                    className="flex-1 bg-[#00c853] hover:bg-[#00e676] text-black font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Commit to Database'}
                                </button>
                            </div>
                            <button
                                onClick={handleSkip}
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
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
