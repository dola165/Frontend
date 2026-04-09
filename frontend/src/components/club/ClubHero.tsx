import { useRef, useState } from 'react';
import {
    CalendarDays,
    Camera,
    Check,
    Loader2,
    LogOut,
    MapPin,
    MessageSquare,
    Plus,
    Settings,
    ShieldCheck,
    Swords,
    Users
} from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { PageHeroSection } from '../layout/PageHeroSection';
import { clubRoleLabel } from '../../features/clubs/domain';
import { getCroppedImg } from '../../utils/cropImageHelper';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { ImageCropperModal } from '../../ui/ImageCropperModal';
import type { ClubProfile } from '../../pages/ClubProfilePage';

interface ClubHeroProps {
    club: ClubProfile | null;
    canEditClubAssets: boolean;
    canManageClub: boolean;
    canOpenCalendar: boolean;
    canChallengeClub: boolean;
    canMessageClub: boolean;
    membershipRole?: string | null;
    showInlineLeaveAction?: boolean;
    onFollowToggle: () => void;
    onOpenManageClub: () => void;
    onOpenCalendar: () => void;
    onOpenChallengeModal: () => void;
    onOpenMessage: () => void;
    onLeaveClub?: () => Promise<void> | void;
    onRefresh: () => void;
}

export const ClubHero = ({
    club,
    canEditClubAssets,
    canManageClub,
    canOpenCalendar,
    canChallengeClub,
    canMessageClub,
    membershipRole,
    showInlineLeaveAction = false,
    onFollowToggle,
    onOpenManageClub,
    onOpenCalendar,
    onOpenChallengeModal,
    onOpenMessage,
    onLeaveClub,
    onRefresh
}: ClubHeroProps) => {
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'banner' | 'logo' | null>(null);
    const [cropperModal, setCropperModal] = useState<{ isOpen: boolean; imageUrl: string; type: 'banner' | 'logo' } | null>(null);
    const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
    const [isLeavingClub, setIsLeavingClub] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);

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
            if (!croppedImageBlob) throw new Error('Failed to crop image.');

            const formData = new FormData();
            formData.append('file', croppedImageBlob, `${type}.jpg`);

            const uploadResponse = await apiClient.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const mediaUrl = uploadResponse.data?.url;
            if (!mediaUrl) {
                throw new Error('Media upload did not return a URL.');
            }

            await apiClient.put(`/clubs/${club.id}`, type === 'banner' ? { bannerUrl: mediaUrl } : { logoUrl: mediaUrl });
            onRefresh();
        } catch (error) {
            console.error(`Failed to upload ${type}`, error);
        } finally {
            setUploading(null);
        }
    };

    const handleLeaveClub = async () => {
        if (!onLeaveClub) return;
        setIsLeavingClub(true);
        setLeaveError(null);

        try {
            await onLeaveClub();
            setIsConfirmingLeave(false);
        } catch (error) {
            console.error('Failed to leave club', error);
            setLeaveError('Failed to leave this club.');
        } finally {
            setIsLeavingClub(false);
        }
    };

    const bannerUrl = resolveMediaUrl(club?.bannerUrl);
    const logoUrl = resolveMediaUrl(club?.logoUrl);
    const showExternalVisitorActions = Boolean(club && !club.isMember);
    const systemActionClassName = 'inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-white/[0.07]';
    const accentActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#04110a] transition-all hover:brightness-105';
    const challengeActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[rgba(255,158,88,0.3)] bg-[color:var(--club-accent-orange-soft)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-accent-orange)] transition-colors hover:bg-[rgba(255,158,88,0.18)]';
    const destructiveActionClassName = 'inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-white/[0.07]';

    return (
        <section className="border-b border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-band)]">
            <div className="relative h-[240px] overflow-hidden sm:h-[300px] lg:h-[360px]">
                {bannerUrl ? (
                    <img src={bannerUrl} alt="Club banner" className="h-full w-full object-cover" />
                ) : (
                    <div className="club-banner-fallback h-full w-full" />
                )}

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,12,0.08),rgba(2,6,12,0.68)_62%,rgba(4,9,15,0.96))]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,144,255,0.18),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_26%)]" />

                {canEditClubAssets && (
                    <div className="absolute right-5 top-5 z-10">
                        <input type="file" ref={bannerInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFileChange(event, 'banner')} />
                        <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={uploading === 'banner'}
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/24 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md"
                        >
                            {uploading === 'banner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            Banner
                        </button>
                    </div>
                )}
            </div>

            <PageHeroSection className="bg-[color:var(--club-band)]" frameClassName="club-page-frame relative py-8 lg:py-10">
                <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
                        <div className="relative -mt-[76px] shrink-0 sm:-mt-[96px] lg:-mt-[112px]">
                            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border-[5px] border-[color:var(--club-band)] bg-[rgba(6,11,18,0.92)] text-2xl font-black uppercase text-[color:var(--club-theme-text-primary)] shadow-[0_18px_44px_rgba(2,6,12,0.35)] sm:h-28 sm:w-28 lg:h-36 lg:w-36">
                                {logoUrl ? <img src={logoUrl} alt="Club logo" className="h-full w-full object-cover" /> : (club?.name ?? 'CL').substring(0, 2).toUpperCase()}
                            </div>
                            {club?.isOfficial ? (
                                <div className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-[color:var(--club-band)] bg-[color:var(--club-tone-green)] text-[#021108]">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                            ) : null}
                            {canEditClubAssets && (
                                <>
                                    <input type="file" ref={logoInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFileChange(event, 'logo')} />
                                    <button
                                        type="button"
                                        onClick={() => logoInputRef.current?.click()}
                                        className="absolute -bottom-2 left-1/2 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/12 bg-black/34 text-white backdrop-blur"
                                    >
                                        {uploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="min-w-0 pb-2">
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-black tracking-[-0.04em] text-[color:var(--club-theme-text-primary)] sm:text-5xl">{club?.name}</h1>
                                {club?.isOfficial && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--club-tone-green)]">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        Verified club
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--club-theme-text-secondary)]">
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                                    {club?.addressText || 'Location pending'}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                <span>{club?.type || 'Club profile'}</span>
                                {membershipRole && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                        <span className="inline-flex items-center gap-1.5 text-[color:var(--club-theme-text-primary)]">
                                            <Users className="h-3.5 w-3.5 text-[color:var(--club-tone-blue)]" />
                                            {clubRoleLabel(membershipRole)}
                                        </span>
                                    </>
                                )}
                            </div>

                            {club?.description && (
                                <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--club-theme-text-secondary)]">{club.description}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:max-w-[420px] xl:justify-end">
                        {canManageClub ? (
                            <>
                                {canOpenCalendar && (
                                    <button type="button" onClick={onOpenCalendar} className={systemActionClassName}>
                                        <CalendarDays className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                        Schedule
                                    </button>
                                )}
                                <button type="button" onClick={onOpenManageClub} className={systemActionClassName}>
                                    <Settings className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                    Manage Club
                                </button>
                            </>
                        ) : showExternalVisitorActions ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onFollowToggle}
                                    className={club?.isFollowedByMe ? systemActionClassName : accentActionClassName}
                                >
                                    {club?.isFollowedByMe ? <Check className="h-4 w-4 text-[color:var(--club-tone-green)]" /> : <Plus className="h-4 w-4" />}
                                    {club?.isFollowedByMe ? 'Following' : 'Follow'}
                                </button>
                                {canMessageClub && (
                                    <button type="button" onClick={onOpenMessage} className={systemActionClassName}>
                                        <MessageSquare className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                        Message
                                    </button>
                                )}
                                {canChallengeClub && (
                                    <button type="button" onClick={onOpenChallengeModal} className={challengeActionClassName}>
                                        <Swords className="h-4 w-4" />
                                        Challenge
                                    </button>
                                )}
                            </>
                        ) : null}

                        {showInlineLeaveAction && (
                            isConfirmingLeave ? (
                                <>
                                    <button type="button" onClick={() => setIsConfirmingLeave(false)} disabled={isLeavingClub} className={systemActionClassName}>
                                        Cancel
                                    </button>
                                    <button type="button" onClick={() => void handleLeaveClub()} disabled={isLeavingClub} className={destructiveActionClassName}>
                                        {isLeavingClub ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                        Confirm Leave
                                    </button>
                                </>
                            ) : (
                                <button type="button" onClick={() => setIsConfirmingLeave(true)} className={destructiveActionClassName}>
                                    <LogOut className="h-4 w-4" />
                                    Leave Club
                                </button>
                            )
                        )}
                    </div>
                </div>

                {leaveError && (
                    <div className="mt-6 rounded-[16px] border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                        {leaveError}
                    </div>
                )}
            </PageHeroSection>

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
        </section>
    );
};
