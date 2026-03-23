import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Activity, User, ChevronRight, Loader2, Target } from 'lucide-react';

export const OnboardingPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        fullName: '',
        role: 'PLAYER', // Default
        position: '',
        preferredFoot: 'Right',
        heightCm: '',
        weightKg: '',
        bio: ''
    });

    useEffect(() => {
        // Fetch existing data (like if Google provided their real name)
        apiClient.get('/users/me').then(res => {
            const existingName = res.data.fullName || res.data.name;
            const existingRole = res.data.role;
            if (existingName && existingName !== 'New User') {
                setFormData(prev => ({ ...prev, fullName: existingName }));
            }
            if (existingRole === 'PLAYER' || existingRole === 'FAN') {
                setFormData(prev => ({ ...prev, role: existingRole }));
            }
        });
    }, []);



    const handleComplete = async () => {
        setIsLoading(true);
        try {
            // 1. Commit the profile to the DB
            await apiClient.put('/users/me/profile', formData);

            // 2. Force token rotation so the client sees the new profile-complete state.
            const refreshRes = await apiClient.post('/auth/refresh');
            localStorage.setItem('accessToken', refreshRes.data.accessToken);

            // 3. Navigate to the FRONTEND route (not the API route)
            navigate('/feed');
        } catch (err) {
            console.error("Onboarding sync failed", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fcf8f2] dark:bg-gray-900 flex flex-col justify-center items-center p-6 selection:bg-emerald-100 dark:selection:bg-emerald-900 font-sans text-[#1a1a1a] dark:text-gray-100">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-8 md:p-12 rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000]">

                <div className="mb-8 border-b-2 border-gray-200 dark:border-gray-700 pb-6">
                    <h1 className="text-4xl font-serif font-bold tracking-tighter italic uppercase mb-2">Establish Your Identity</h1>
                    <p className="text-gray-500 font-serif italic text-sm">The database needs your credentials before granting network access.</p>
                </div>

                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <label className="block text-xs font-black uppercase tracking-widest mb-4 text-gray-500">What is your designation?</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[
                                { id: 'PLAYER', icon: Activity, label: 'Player', desc: 'Seeking clubs & tryouts' },
                                { id: 'FAN', icon: User, label: 'Supporter', desc: 'Following the action' }
                            ].map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setFormData({...formData, role: role.id})}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${formData.role === role.id ? 'border-[#2a4d37] bg-emerald-50 dark:bg-emerald-900/20 shadow-[4px_4px_0px_0px_#2a4d37]' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}
                                >
                                    <role.icon className={`w-8 h-8 mb-3 ${formData.role === role.id ? 'text-[#2a4d37] dark:text-emerald-500' : 'text-gray-400'}`} />
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
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#2a4d37] dark:focus:border-emerald-500 font-bold transition-colors"
                                placeholder="E.g. Khvicha Kvaratskhelia"
                            />
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!formData.fullName.trim()}
                            className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] hover:bg-gray-800 dark:hover:bg-gray-200 font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#a34e36] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            Next Phase <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        {formData.role === 'PLAYER' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Primary Position</label>
                                        <input type="text" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold" placeholder="E.g. CAM, CB, ST" />
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
                                        <input type="number" value={formData.heightCm} onChange={(e) => setFormData({...formData, heightCm: e.target.value})} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold" placeholder="185" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Weight (kg)</label>
                                        <input type="number" value={formData.weightKg} onChange={(e) => setFormData({...formData, weightKg: e.target.value})} className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none font-bold" placeholder="78" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="mb-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center">
                                <Target className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-sm font-bold text-gray-500">Additional specific parameters will be unlocked in the Command Center after initialization.</p>
                            </div>
                        )}

                        <div className="mb-8">
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Personal Manifesto / Bio</label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#2a4d37] font-bold h-24 resize-none"
                                placeholder="Brief summary of your football philosophy..."
                            />
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 font-black uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white transition-colors">
                                Back
                            </button>
                            <button
                                onClick={handleComplete}
                                disabled={isLoading}
                                className="flex-1 bg-[#2a4d37] dark:bg-emerald-600 text-white font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Commit to Database'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
