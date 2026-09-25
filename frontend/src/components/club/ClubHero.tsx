import { MediaImage } from '../ui/MediaImage';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarDays,
    Camera,
    Check,
    Loader2,
    MapPin,
    MessageSquare,
    Plus,
    Send,
    Settings,
    ShieldCheck,
    Swords,
    Users
} from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { PageHeroSection } from '../layout/PageHeroSection';
import { clubRoleLabel } from '../../features/clubs/domain';
import { CROP_IMAGE_ACCEPT } from '../../utils/cropImageHelper';
import { useIdentityImageEditor } from '../../hooks/useIdentityImageEditor';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { ImageCropperModal } from '../../ui/ImageCropperModal';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import { profileKindLabel } from '../../features/clubs/presentation';

interface ClubHeroProps {
    club: ClubProfile | null;
    canEditClubAssets: boolean;
    canManageClub: boolean;
    canOpenWorkspace?: boolean;
    canOpenCalendar: boolean;
    canChallengeClub: boolean;
    canMessageClub: boolean;
    showApplyButton?: boolean;
    membershipRole?: string | null;
    onFollowToggle: () => void;
    onOpenManageClub: () => void;
    onOpenCalendar: () => void;
    onOpenWorkspace?: () => void;
    onOpenChallengeModal: () => void;
    onOpenMessage: () => void;
    onOpenApply?: () => void;
    onRefresh: () => void;
}

export const ClubHero = ({
    club,
    canEditClubAssets,
    canManageClub,
    canOpenWorkspace = false,
    canOpenCalendar,
    canChallengeClub,
    canMessageClub,
    showApplyButton = false,
    membershipRole,
    onFollowToggle,
    onOpenManageClub,
    onOpenCalendar,
    onOpenWorkspace,
    onOpenChallengeModal,
    onOpenMessage,
    onOpenApply,
    onRefresh
}: ClubHeroProps) => {
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const editor = useIdentityImageEditor(async (type, url) => {
        if (!club?.id || !canEditClubAssets) throw new Error('You do not have permission to update these photos.');
        await apiClient.put(`/clubs/${club.id}`, type === 'banner' ? { bannerUrl: url } : { logoUrl: url });
        onRefresh();
    }, `club:${club?.id}:${canEditClubAssets}`);
    const { uploading } = editor;
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'logo') => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (canEditClubAssets) void editor.select(file, type);
    };

    const bannerUrl = resolveMediaUrl(club?.bannerUrl);
    const logoUrl = resolveMediaUrl(club?.logoUrl);
    const showExternalVisitorActions = Boolean(club && !club.isMember);
    const systemActionClassName = 'inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold  text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-white/[0.07]';
    const accentActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] px-5 py-3 text-[11px] font-semibold  text-[#04110a] transition-all hover:brightness-105';
    const challengeActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[rgba(255,158,88,0.3)] bg-[color:var(--club-accent-orange-soft)] px-5 py-3 text-[11px] font-semibold  text-[color:var(--club-accent-orange)] transition-colors hover:bg-[rgba(255,158,88,0.18)]';
    return (
        <section className="border-b border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-band)]">
            <div className="cp-profile-cover relative overflow-hidden">
                {bannerUrl ? (
                    <MediaImage src={bannerUrl} alt="Club banner" className="h-full w-full object-cover object-top" />
                ) : (
                    <div className="club-banner-fallback h-full w-full" />
                )}

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,16,0.04)_0%,rgba(5,9,16,0.55)_40%,rgba(5,9,16,0.92)_75%,#050910_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,144,255,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_26%)]" />

                {canEditClubAssets && (
                    <div className="club-banner-actions pointer-events-none absolute inset-x-0 top-5 z-10 mx-auto flex w-full max-w-[var(--app-page-max-width)] justify-end px-[var(--app-page-gutter)]">
                        <input type="file" ref={bannerInputRef} className="hidden" accept={CROP_IMAGE_ACCEPT} onChange={(event) => handleFileChange(event, 'banner')} />
                        <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={!!uploading}
                            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/24 px-3 py-2 text-[11px] font-semibold  text-white backdrop-blur-md"
                        >
                            {uploading === 'banner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            Banner
                        </button>
                    </div>
                )}
            </div>

            <PageHeroSection className="bg-[color:var(--club-theme-surface)]" frameClassName="club-profile-frame club-identity-frame relative py-6 lg:py-7">
                <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
                        <div className="club-logo-position relative -mt-[76px] self-start shrink-0 sm:-mt-[80px] lg:-mt-[88px]">
                            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-[5px] border-[color:var(--club-band)] bg-[color:var(--club-theme-elevated)] text-2xl font-semibold uppercase text-[color:var(--club-theme-text-primary)] shadow-[0_18px_44px_rgba(2,6,12,0.35)] sm:h-28 sm:w-28 lg:h-36 lg:w-36">
                                {logoUrl ? <MediaImage src={logoUrl} alt="Club logo" className="h-full w-full object-cover" /> : (club?.name ?? 'CL').substring(0, 2).toUpperCase()}
                            </div>
                            {club?.isOfficial ? (
                                <div className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-[color:var(--club-band)] bg-[color:var(--club-tone-green)] text-[#021108]">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                            ) : null}
                            {canEditClubAssets && (
                                <>
                                    <input type="file" ref={logoInputRef} className="hidden" accept={CROP_IMAGE_ACCEPT} onChange={(event) => handleFileChange(event, 'logo')} />
                                    <button
                                        type="button"
                                        onClick={() => logoInputRef.current?.click()}
                                        disabled={!!uploading}
                                        className="absolute -bottom-2 left-1/2 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/12 bg-black/34 text-white backdrop-blur"
                                    >
                                        {uploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="min-w-0 pb-2">
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--club-theme-text-primary)] sm:text-5xl">{club?.name}</h1>
                                {club?.isOfficial && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] px-3 py-1 text-[11px] font-semibold  text-[color:var(--club-tone-green)]">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        Verified club
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold  text-[color:var(--club-theme-text-secondary)]">
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                                    {club?.addressText || 'Location pending'}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                <span>{club?.presentation ? profileKindLabel[club.presentation.profileKind] : club?.type || 'Club profile'}</span>
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
                                <p className="club-description mt-4 max-w-3xl text-base leading-7 text-[color:var(--club-theme-text-secondary)]">{club.description}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:max-w-[420px] xl:justify-end">
                        {Boolean(club?.presentation?.programmes.some(p => p.published)) && <Link to={`/clubs/${club?.id}?tab=teams`} className={accentActionClassName}>Find training</Link>}
                        {canManageClub ? (
                            <>
                                {canOpenCalendar && (
                                    <button type="button" onClick={onOpenCalendar} className={systemActionClassName}>
                                        <CalendarDays className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                        Schedule
                                    </button>
                                )}
                                <button id="club-settings-trigger" type="button" onClick={onOpenManageClub} className={systemActionClassName}>
                                    <Settings className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                    Club settings
                                </button>
                                {onOpenWorkspace && canOpenWorkspace && (
                                    <button type="button" onClick={onOpenWorkspace} className={systemActionClassName}>
                                        <Settings className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                        Open workspace
                                    </button>
                                )}

                            </>
                        ) : canOpenWorkspace && onOpenWorkspace ? <button type="button" onClick={onOpenWorkspace} className={accentActionClassName}><Settings className="h-4 w-4"/>Open workspace</button> : showExternalVisitorActions ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onFollowToggle}
                                    className={systemActionClassName}
                                >
                                    {club?.isFollowedByMe ? <Check className="h-4 w-4 text-[color:var(--club-tone-green)]" /> : <Plus className="h-4 w-4" />}
                                    {club?.isFollowedByMe ? 'Following' : 'Follow'}
                                </button>
                                {showApplyButton && onOpenApply && !club?.presentation?.programmes.some(p => p.published) && (
                                    <button
                                        type="button"
                                        onClick={onOpenApply}
                                        className={accentActionClassName}
                                    >
                                        <Send className="h-4 w-4" />
                                        Apply to Join
                                    </button>
                                )}
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

                    </div>
                </div>


            </PageHeroSection>

            {editor.error && !editor.source && <p role="alert" className="px-5 py-3 text-rose-500">{editor.error}</p>}
            {editor.source && <ImageCropperModal
                isOpen imageUrl={editor.source.imageUrl}
                title={editor.source.type === 'banner' ? 'Adjust cover photo' : 'Adjust club logo'}
                aspectRatio={editor.source.type === 'banner' ? 3 : 1}
                onClose={editor.close} onCropComplete={editor.save}
                isProcessing={!!uploading} error={editor.error}
            />}

        </section>
    );
};
