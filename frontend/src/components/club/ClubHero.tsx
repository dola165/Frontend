import { useRef, useState } from 'react';
import { ShieldCheck, MapPin, Settings, Swords, Camera, Loader2, CalendarDays, Check, Plus, MessageSquare } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { getCroppedImg } from '../../utils/cropImageHelper';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { ImageCropperModal } from "../../ui/ImageCropperModal.tsx";
import type { ClubProfile } from '../../pages/ClubProfilePage';

interface ClubHeroProps {
    club: ClubProfile | null;
    canEditClubAssets: boolean;
    canManageClub: boolean;
    canOpenCalendar: boolean;
    canChallengeClub: boolean;
    canMessageClub: boolean;
    onFollowToggle: () => void;
    onOpenManageClub: () => void;
    onOpenCalendar: () => void;
    onOpenChallengeModal: () => void;
    onOpenMessage: () => void;
    onRefresh: () => void;
}

export const ClubHero = ({
    club,
    canEditClubAssets,
    canManageClub,
    canOpenCalendar,
    canChallengeClub,
    canMessageClub,
    onFollowToggle,
    onOpenManageClub,
    onOpenCalendar,
    onOpenChallengeModal,
    onOpenMessage,
    onRefresh
}: ClubHeroProps) => {
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'banner' | 'logo' | null>(null);

    const [cropperModal, setCropperModal] = useState<{
        isOpen: boolean;
        imageUrl: string;
        type: 'banner' | 'logo';
    } | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'logo') => {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        setCropperModal({ isOpen: true, imageUrl, type });

        if (event.target) event.target.value = '';
    };

    const handleCropComplete = async (croppedAreaPixels: any) => {
        if (!cropperModal || !club?.id) return;
        setUploading(cropperModal.type);
        const type = cropperModal.type;
        setCropperModal(null);

        try {
            const croppedImageBlob = await getCroppedImg(cropperModal.imageUrl, croppedAreaPixels);
            if (!croppedImageBlob) throw new Error("Failed to crop image into a valid Blob.");

            const formData = new FormData();
            formData.append('file', croppedImageBlob, `${type}.jpg`);

            const uploadResponse = await apiClient.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const mediaUrl = uploadResponse.data?.url;
            if (!mediaUrl) {
                throw new Error('Media upload did not return a URL.');
            }

            await apiClient.put(`/clubs/${club.id}`, type === 'banner'
                ? { bannerUrl: mediaUrl }
                : { logoUrl: mediaUrl });
            onRefresh();
        } catch (error) {
            console.error(`Failed to upload ${type}`, error);
        } finally {
            setUploading(null);
        }
    };

    return (
        <div className="theme-page relative">
            {/* 1. SEAMLESS BANNER SECTION */}
            <div className="theme-surface-strong h-48 md:h-80 w-full relative group flex items-center justify-center overflow-hidden border-b theme-border">

                {resolveMediaUrl(club?.bannerUrl) ? (
                    <img
                        src={resolveMediaUrl(club?.bannerUrl)}
                        alt="Club Banner"
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                    />
                ) : (
                    <div className="theme-surface-inset w-full h-full flex items-center justify-center">
                        <Camera className="w-12 h-12 text-slate-700" />
                    </div>
                )}

                {canEditClubAssets && (
                    <div className="absolute top-4 right-4 z-30">
                        <input type="file" ref={bannerInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileChange(e, 'banner')} />
                        <button
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={uploading === 'banner'}
                            className="theme-overlay hover:bg-emerald-600 text-white p-2 rounded-full backdrop-blur-md transition-all border border-transparent hover:border-emerald-400"
                        >
                            {uploading === 'banner' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                        </button>
                    </div>
                )}
            </div>

            {/* 2. HEADER CONTENT */}
            <div className="px-4 sm:px-8 pb-6 relative z-20 -mt-12 sm:-mt-16">
                <div className="flex flex-col md:flex-row items-center md:items-end md:justify-between gap-4">

                    {/* Logo & Club Info */}
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left w-full md:w-auto">
                        <div className="relative group w-32 h-32 sm:w-40 sm:h-40 shrink-0">
                            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                            <div className="theme-surface-inset w-full h-full rounded-full border-4 border-slate-50 dark:theme-border-strong overflow-hidden relative z-10 shadow-xl">
                                {resolveMediaUrl(club?.logoUrl) ? (
                                    <img src={resolveMediaUrl(club?.logoUrl)} alt="Club Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><ShieldCheck className="w-16 h-16 text-slate-600" /></div>
                                )}

                                {canEditClubAssets && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                                        {uploading === 'logo' ? <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={logoInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileChange(e, 'logo')} />
                        </div>

                        <div className="mb-2 w-full md:w-auto">
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center justify-center md:justify-start gap-3">
                                {club?.name}
                                {club?.isOfficial && <ShieldCheck className="w-7 h-7 text-emerald-500 shrink-0 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]" />}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> {club?.addressText || 'Unknown Location'}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                <span className="text-emerald-600 dark:text-emerald-500">{club?.type}</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. CHUNKY, BOLD BUTTONS */}
                    <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 mt-4 md:mt-0 w-full md:w-auto">
                        {canManageClub ? (
                            <>
                                {canOpenCalendar && (
                                    <button onClick={onOpenCalendar} className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-orange-500 hover:bg-orange-600 text-white border-2 border-slate-900">
                                        <CalendarDays className="w-4 h-4" /> Calendar
                                    </button>
                                )}
                                <button onClick={onOpenManageClub} className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 border-2 border-slate-900">
                                    <Settings className="w-4 h-4" /> Manage Club
                                </button>
                            </>
                        ) : (
                            <>
                                {canChallengeClub && (
                                    <button onClick={onOpenChallengeModal} className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-rose-600 hover:bg-rose-500 text-white border-2 border-slate-900">
                                        <Swords className="w-4 h-4" /> Challenge
                                    </button>
                                )}

                                <button
                                    onClick={onOpenMessage}
                                    disabled={!canMessageClub}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none border-2 ${
                                        canMessageClub
                                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 border-slate-900'
                                            : 'bg-slate-200/60 dark:bg-slate-900 text-slate-500 border-slate-700 cursor-not-allowed shadow-none'
                                    }`}
                                >
                                    <MessageSquare className="w-4 h-4" /> Message
                                </button>

                                <button onClick={onFollowToggle} className={`flex items-center gap-2 px-6 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none border-2 ${club?.isFollowedByMe ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500 hover:bg-emerald-500/30' : 'bg-emerald-600 text-white border-slate-900 hover:bg-emerald-500'}`}>
                                    {club?.isFollowedByMe ? <><Check className="w-4 h-4"/> Following</> : <><Plus className="w-4 h-4" /> Follow</>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Cropper Modal */}
            {cropperModal && (
                <ImageCropperModal
                    isOpen={cropperModal.isOpen}
                    imageUrl={cropperModal.imageUrl}
                    title={cropperModal.type === 'banner' ? 'Adjust Cover Photo' : 'Adjust Club Logo'}
                    aspectRatio={cropperModal.type === 'banner' ? 3 / 1 : 1 / 1}
                    onClose={() => setCropperModal(null)}
                    onCropComplete={handleCropComplete}
                    isProcessing={uploading !== null}
                />
            )}
        </div>
    );
};
