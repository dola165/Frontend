import { useRef, useState } from 'react';
import { ArrowLeft, ShieldCheck, MapPin, Settings, UserPlus, Swords, MessageSquare, Camera, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';

interface ClubHeroProps {
    club: any;
    isOwnClubAdmin: boolean;
    isOtherClubAdmin: boolean;
    onFollowToggle: () => void;
    onOpenManageOrg: () => void;
    onOpenChallengeModal: () => void;
    onRefresh: () => void;
}

export const ClubHero = ({ club, isOwnClubAdmin, isOtherClubAdmin, onFollowToggle, onOpenManageOrg, onOpenChallengeModal, onRefresh }: ClubHeroProps) => {
    const navigate = useNavigate();
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'banner' | 'logo' | null>(null);

    const initials = club?.name?.substring(0, 2).toUpperCase() || 'FC';
    const bannerUrl = club?.bannerUrl || "https://images.unsplash.com/photo-1518605368461-1ee71161d91a?auto=format&fit=crop&q=80&w=1200&h=400";

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'logo') => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        setUploading(type);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 1. Upload to Media storage (using POST to match your @PostMapping)
            const mediaRes = await apiClient.post('/api/media/upload', formData);
            const imageUrl = mediaRes.data.url;

            // 2. Update Club Profile with new URL
            await apiClient.put(`/api/clubs/${club.id}`, {
                [type === 'banner' ? 'bannerUrl' : 'logoUrl']: imageUrl
            });

            onRefresh();
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to update image.");
        } finally {
            setUploading(null);
            if (e.target) e.target.value = '';
        }
    };

    return (
        <div className="relative">
            {/* Banner Section */}
            <div className="h-48 md:h-80 w-full relative group bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <img src={bannerUrl} alt="Club Banner" className="w-full h-full object-cover" />

                {/* BACK BUTTON */}
                <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-20 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all">
                    <ArrowLeft className="w-5 h-5" />
                </button>

                {isOwnClubAdmin && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <input type="file" ref={bannerInputRef} onChange={(e) => handleImageUpload(e, 'banner')} className="hidden" accept="image/*" />
                        <button
                            disabled={uploading !== null}
                            onClick={() => bannerInputRef.current?.click()}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-md flex items-center gap-2 font-bold transition-all border border-white/30"
                        >
                            {uploading === 'banner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            Change Cover
                        </button>
                    </div>
                )}
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative -mt-12 sm:-mt-16 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div className="flex flex-col md:flex-row md:items-end gap-4 sm:gap-6">
                        {/* Logo Section */}
                        <div className="relative group">
                            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-2xl bg-slate-900 border-4 border-white dark:border-slate-950 shadow-xl overflow-hidden flex items-center justify-center">
                                {club?.logoUrl ? (
                                    <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl sm:text-4xl font-black text-emerald-500">{initials}</span>
                                )}
                            </div>
                            {isOwnClubAdmin && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                    <input type="file" ref={logoInputRef} onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" accept="image/*" />
                                    <button
                                        disabled={uploading !== null}
                                        onClick={() => logoInputRef.current?.click()}
                                        className="text-white p-2 rounded-full hover:bg-white/20 transition-all"
                                    >
                                        {uploading === 'logo' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-6 h-6" />}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{club?.name}</h1>
                                {club?.isOfficial && <ShieldCheck className="w-6 h-6 text-emerald-500 fill-emerald-500/10" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400 text-sm font-bold">
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {club?.addressText || 'Location TBD'}</span>
                                <span className="flex items-center gap-1.5 uppercase tracking-wider text-emerald-500">{club?.type}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* RESTORED ALL SCENARIO LOGIC */}
                        {isOwnClubAdmin ? (
                            <>
                                <button onClick={onOpenManageOrg} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#10b981] active:translate-y-0.5 active:shadow-none border-2 border-slate-900">
                                    <Settings className="w-4 h-4" /> Manage Org
                                </button>
                                <button className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 border-2 border-slate-900">
                                    <MessageSquare className="w-4 h-4" /> Message
                                </button>
                            </>
                        ) : isOtherClubAdmin ? (
                            <>
                                <button onClick={onOpenChallengeModal} className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none border-2 border-slate-900">
                                    <Swords className="w-4 h-4" /> Challenge
                                </button>
                                <button onClick={onFollowToggle} className={`flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none border-2 ${club?.isFollowedByMe ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 hover:bg-slate-300 dark:hover:bg-slate-700' : 'bg-emerald-600 text-white border-slate-900 hover:bg-emerald-500'}`}>
                                    {club?.isFollowedByMe ? 'Following' : <><UserPlus className="w-4 h-4" /> Follow</>}
                                </button>
                                <button className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 border-2 border-slate-900">
                                    <MessageSquare className="w-4 h-4" /> Message
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={onFollowToggle} className={`flex items-center gap-2 px-8 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none border-2 ${club?.isFollowedByMe ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 hover:bg-slate-300 dark:hover:bg-slate-700' : 'bg-emerald-600 text-white border-slate-900 hover:bg-emerald-500'}`}>
                                    {club?.isFollowedByMe ? 'Following' : <><UserPlus className="w-4 h-4" /> Follow</>}
                                </button>
                                <button className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 border-2 border-slate-900">
                                    <MessageSquare className="w-4 h-4" /> Message
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};