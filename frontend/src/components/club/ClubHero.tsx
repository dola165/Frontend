import { MediaImage } from '../ui/MediaImage';
import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { playerPath, positivePlayerId } from '../../features/parents/playerSelection';
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
import { profileKindLabel, currentProgramme } from '../../features/clubs/presentation';
import { useAuth } from '../../context/AuthContext';
import { accessibleClubs } from '../layout/clubAccess';

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
    const { user, status } = useAuth();
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

    const location=useLocation(), selectedPlayer=positivePlayerId(new URLSearchParams(location.search).get('player'));
    const bannerUrl = resolveMediaUrl(club?.bannerUrl);
    const logoUrl = resolveMediaUrl(club?.logoUrl);
    const showExternalVisitorActions = Boolean(club && !club.isMember);
    const hasClubConnection = Boolean(club && (club.isMember || club.isStaffMember || club.myRole || membershipRole || canManageClub
        || club.playerAffiliationStatus === 'ACTIVE' || club.playerAffiliationStatus === 'TRIALIST'
        || club.relationshipState === 'ACTIVE' || club.relationshipState === 'TRIALIST'
        || accessibleClubs(user?.navigationCapabilities).some(connection => connection.id === club.id)));
    const showFindTraining = status !== 'bootstrapping' && !hasClubConnection
        && Boolean(club?.presentation?.programmes.some(p => p.published && currentProgramme(p)));
    const systemActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)]/8 bg-[color:var(--color-ink)]/[0.04] px-4 py-3 text-[11px] font-semibold  text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-[color:var(--color-ink)]/[0.07]';
    const accentActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] px-5 py-3 text-[11px] font-semibold  text-[var(--color-on-accent)] transition-all hover:brightness-105';
    const challengeActionClassName = 'inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,_var(--color-orange)_30%,_transparent)] bg-[color:var(--club-accent-orange-soft)] px-5 py-3 text-[11px] font-semibold  text-[color:var(--club-accent-orange)] transition-colors hover:bg-[color-mix(in_srgb,_var(--color-orange)_18%,_transparent)]';
    return (
        <section className="club-profile-hero border-b border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-band)]">
            <div className={`cp-profile-cover ${bannerUrl ? 'cp-profile-cover--image' : ''} relative overflow-hidden`}>
                {bannerUrl ? (
                    <MediaImage src={bannerUrl} alt="Club banner" className="h-full w-full object-contain object-center" />
                ) : (
                    <div className="club-banner-fallback h-full w-full" />
                )}

                {!bannerUrl && <>
                    <div className="absolute inset-0 bg-[image:var(--color-hero-scrim)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,_var(--color-info)_8%,_transparent),transparent_30%),radial-gradient(circle_at_top_left,color-mix(in_srgb,_var(--color-accent)_8%,_transparent),transparent_26%)]" />
                </>}

                {canEditClubAssets && (
                    <div className="club-banner-actions pointer-events-none absolute inset-x-0 top-5 z-10 mx-auto flex w-full max-w-[var(--app-page-max-width)] justify-end px-[var(--app-page-gutter)]">
                        <input type="file" ref={bannerInputRef} className="hidden" accept={CROP_IMAGE_ACCEPT} onChange={(event) => handleFileChange(event, 'banner')} />
                        <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={!!uploading}
                            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)]/12 bg-[color:var(--color-ink)]/24 px-3 py-2 text-[11px] font-semibold  text-[color:var(--color-text)] backdrop-blur-md"
                        >
                            {uploading === 'banner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            Banner
                        </button>
                    </div>
                )}
            </div>

            <PageHeroSection className="bg-[color:var(--club-theme-surface)]" frameClassName="club-profile-frame club-identity-frame relative py-6 lg:py-7">
                <div className="club-identity-layout">
                    <div className="club-identity-main">
                        <div className="club-logo-position relative -mt-[76px] self-start shrink-0 sm:-mt-[80px] lg:-mt-[88px]">
                            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-[5px] border-[color:var(--club-band)] bg-[color:var(--club-theme-elevated)] text-2xl font-semibold uppercase text-[color:var(--club-theme-text-primary)] shadow-[0_18px_44px_color-mix(in_srgb,_var(--color-shadow)_35%,_transparent)] sm:h-28 sm:w-28 lg:h-36 lg:w-36">
                                {logoUrl ? <MediaImage src={logoUrl} alt="Club logo" className="h-full w-full object-cover" /> : (club?.name ?? 'CL').substring(0, 2).toUpperCase()}
                            </div>
                            {club?.isOfficial ? (
                                <div className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-[color:var(--club-band)] bg-[color:var(--club-tone-green)] text-[var(--color-on-accent)]">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                            ) : null}
                            {canEditClubAssets && (
                                <>
                                    <input type="file" ref={logoInputRef} className="hidden" accept={CROP_IMAGE_ACCEPT} onChange={(event) => handleFileChange(event, 'logo')} />
                                    <button
                                        type="button"
                                        aria-label={uploading === 'logo' ? 'Uploading club logo' : 'Change club logo'}
                                        onClick={() => logoInputRef.current?.click()}
                                        disabled={!!uploading}
                                        className="absolute -bottom-2 left-1/2 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[color:var(--color-border)]/12 bg-[color:var(--color-overlay)]/34 text-[color:var(--color-on-media)] backdrop-blur"
                                    >
                                        {uploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="club-identity-copy min-w-0 pb-2">
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <h1 className="club-profile-title text-3xl font-semibold tracking-[-0.04em] text-[color:var(--club-theme-text-primary)] sm:text-5xl">{club?.name}</h1>
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

                    <div className="club-hero-actions">
                        {showFindTraining && <Link to={playerPath(`/clubs/${club?.id}?tab=teams`,selectedPlayer)} className={accentActionClassName}>Find training</Link>}
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
                                {showApplyButton && onOpenApply && !club?.presentation?.programmes.some(p => p.published && currentProgramme(p)) && (
                                    <button
                                        type="button"
                                        onClick={onOpenApply}
                                        className={accentActionClassName}
                                    >
                                        <Send className="h-4 w-4" />
                                        Find training group
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

            {editor.error && !editor.source && <p role="alert" className="px-5 py-3 text-[color:var(--color-danger)]">{editor.error}</p>}
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
