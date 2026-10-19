import { useRef, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { ClubJourneyPanel } from '../../journey/components/ClubJourneyPanel';
import { AccountProfileFeedback } from './AccountProfileFeedback';
import { useAccountCopy } from './accountCopy';
import { DetailRow, Field, Section } from './AccountFields';
import { btnPrimaryClass, btnSecondaryClass, inputClass, type Account } from './accountModel';
import type { ProfileForm, useAccountProfileDraft } from './useAccountProfileDraft';

const positions = ['Goalkeeper','Centre-Back','Left-Back','Right-Back','Defensive Midfield','Central Midfield','Attacking Midfield','Left Winger','Right Winger','Striker'];

export const AccountProfileTab = ({ account, form, setForm, isPlayer, profileDraft, avatarPreview, bannerPreview, initials, profileHref }: {
    account: Account; form: ProfileForm; setForm: Dispatch<SetStateAction<ProfileForm | null>>; isPlayer: boolean;
    profileDraft: ReturnType<typeof useAccountProfileDraft>; avatarPreview: string | null | undefined;
    bannerPreview: string | null | undefined; initials: string; profileHref: string;
}) => {
    const copy = useAccountCopy();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const { saving, uploading, saveProfile, uploadAsset } = profileDraft;
    const updateForm = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
    return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Section
                title={copy("Profile Draft")}
                description={copy("Your public identity data — save to persist changes across the platform.")}
                actions={
                    <button
                        type="button"
                        onClick={() => void saveProfile()}
                        disabled={saving || profileDraft.refreshing || Boolean(uploading)}
                        aria-busy={saving}
                        className={btnPrimaryClass}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {copy("Save Profile")}
                    </button>
                }
            >
                <AccountProfileFeedback draft={profileDraft} />
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={copy("Display Name")}>
                        <input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder={copy("Full name")} className={inputClass} />
                    </Field>
                    <Field label={copy("Email")}>
                        <input readOnly value={account.email} className={inputClass} />
                    </Field>
                </div>

                <div className="mt-4">
                    <Field label={copy("Bio")}>
                        <textarea value={form.bio} onChange={(event) => updateForm('bio', event.target.value)} rows={5} placeholder={copy("Football background, experience, or role summary")} className={`${inputClass} min-h-[120px] resize-none`} />
                    </Field>
                </div>

                {isPlayer && (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Field label={copy("Primary Position")}>
                            <select value={form.position} onChange={(event) => updateForm('position', event.target.value)} className={inputClass}>
                                <option value="">{copy("Select position")}</option>
                                {positions.map(p => (
                                    <option key={p} value={p}>{copy(p)}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label={copy("Secondary Position")}>
                            <input value={form.secondaryPosition} onChange={(event) => updateForm('secondaryPosition', event.target.value)} className={inputClass} />
                        </Field>
                        <Field label={copy("Preferred Foot")}>
                            <select value={form.preferredFoot} onChange={(event) => updateForm('preferredFoot', event.target.value)} className={inputClass}>
                                <option value="">{copy("Select")}</option>
                                <option value="RIGHT">{copy("Right")}</option>
                                <option value="LEFT">{copy("Left")}</option>
                                <option value="BOTH">{copy("Both")}</option>
                            </select>
                        </Field>
                        <Field label={copy("Availability")}>
                            <select value={form.availabilityStatus} onChange={(event) => updateForm('availabilityStatus', event.target.value)} className={inputClass}>
                                <option value="AVAILABLE">{copy("Available")}</option>
                                <option value="LIMITED">{copy("Limited")}</option>
                                <option value="UNAVAILABLE">{copy("Unavailable")}</option>
                            </select>
                        </Field>
                        <Field label={copy("Height (cm)")}>
                            <input type="number" value={form.heightCm} onChange={(event) => updateForm('heightCm', event.target.value)} className={inputClass} />
                        </Field>
                        <Field label={copy("Weight (kg)")}>
                            <input type="number" value={form.weightKg} onChange={(event) => updateForm('weightKg', event.target.value)} className={inputClass} />
                        </Field>
                    </div>
                )}

            </Section>

            <div className="flex flex-col gap-5">
                <Section title={copy("My Club")} description={copy("Your club journey: applications, invitations, trials and membership.")}>
                    <ClubJourneyPanel />
                </Section>

                <Section title={copy("Profile Assets")} description={copy("Banner and avatar media for your public profile.")}>
                    <div className="relative h-32 overflow-hidden rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)]">
                        {bannerPreview ? (
                            <MediaImage src={bannerPreview} alt={copy("Account banner")} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-[color:var(--fc-text-secondary)]" />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={saving || profileDraft.refreshing || Boolean(uploading)}
                            aria-busy={uploading === 'banner'}
                            className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)]/12 bg-[color:var(--color-overlay)]/24 px-3 py-2 text-xs font-semibold text-[color:var(--color-on-media)] backdrop-blur-md transition-colors hover:bg-[color:var(--color-overlay)]/40"
                        >
                            {uploading === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                            {copy("Banner")}
                        </button>
                        <input ref={bannerInputRef} aria-label={copy("Upload profile banner")} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAsset(event, 'banner')} />
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[14px] border-2 border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] text-xl font-bold text-[color:var(--fc-text-primary)]">
                            {avatarPreview ? <MediaImage src={avatarPreview} alt={account.displayName} className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={saving || profileDraft.refreshing || Boolean(uploading)}
                                aria-busy={uploading === 'avatar'}
                                className={btnSecondaryClass}
                            >
                                {uploading === 'avatar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                {copy("Avatar")}
                            </button>
                            <input ref={avatarInputRef} aria-label={copy("Upload profile avatar")} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAsset(event, 'avatar')} />
                            <p className="text-xs leading-5 text-[color:var(--fc-text-secondary)]">{copy("Uploads update the draft immediately. Save to persist.")}</p>
                        </div>
                    </div>
                </Section>

                <Section title={copy("Profile Notes")}>
                    <DetailRow label={copy("Username")} value={account.username} />
                    <DetailRow label={copy("Linked Providers")} value={account.linkedAccounts.length || copy("None")} />
                    <DetailRow label={copy("Public View")} value={<Link to={profileHref} className="app-text-action">{copy("Open profile")}</Link>} />
                </Section>
            </div>
        </div>
    );
};
