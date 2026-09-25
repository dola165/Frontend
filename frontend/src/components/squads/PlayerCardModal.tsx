import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, ShieldCheck, Upload, UserRound, X } from 'lucide-react';
import { createPlayerCard, updatePlayerCard, type PlayerCard } from '../../features/clubs/api';
import { apiClient } from '../../api/axiosConfig';
import { MediaImage } from '../ui/MediaImage';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import './squad-design.css';
import './player-roster-forms.css';

interface PlayerCardModalProps {
    clubId: number;
    squadId?: number | null;
    squadName?: string;
    /** Optional creation-time squad choices; existing squad-scoped callers remain supported. */
    squads?: Array<{ id: number; name: string }>;
    isOpen: boolean;
    onClose: () => void;
    onCardCreated?: () => void;
    card?: PlayerCard | null;
    onCardUpdated?: () => void;
}

const POSITIONS = [
    'GOALKEEPER',
    'CENTER_BACK',
    'FULLBACK',
    'DEFENSIVE_MIDFIELDER',
    'CENTRAL_MIDFIELDER',
    'ATTACKING_MIDFIELDER',
    'WINGER',
    'STRIKER',
];
const positionLabel = (value: string) =>
    value
        .toLowerCase()
        .split('_')
        .map((word) => (word[0]?.toUpperCase() ?? '') + word.slice(1))
        .join(' ');

export const PlayerCardModal = (props: PlayerCardModalProps) =>
    props.isOpen ? <PlayerCardForm key={props.card?.id ?? 'new'} {...props} /> : null;

function PlayerCardForm({
    clubId,
    squadId,
    squadName,
    squads,
    onClose,
    onCardCreated,
    card,
    onCardUpdated,
}: PlayerCardModalProps) {
    const { t } = useTranslation();
    const editing = card != null;
    const personalDetailsLocked = card?.registered === true;
    const [fullName, setFullName] = useState(card?.fullName ?? '');
    const [birthYear, setBirthYear] = useState(card?.birthYear != null ? String(card.birthYear) : '');
    const [position, setPosition] = useState(card?.position ?? 'GOALKEEPER');
    const [jerseyNumber, setJerseyNumber] = useState(card?.jerseyNumber != null ? String(card.jerseyNumber) : '');
    const [parentEmail, setParentEmail] = useState(card?.parentEmail ?? '');
    const [photoUrl, setPhotoUrl] = useState<string | null>(card?.photoUrl ?? null);
    const [selectedSquadId, setSelectedSquadId] = useState<number | null>(squadId ?? card?.squadId ?? null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discarding, setDiscarding] = useState(false);
    const busy = useRef(false);
    const uploadBusy = useRef(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const uploadRef = useRef<HTMLInputElement>(null);
    const id = useId();
    const currentYear = new Date().getFullYear();
    const needsConsent = birthYear !== '' && currentYear - Number(birthYear) < 18;
    const under13 = birthYear !== '' && currentYear - Number(birthYear) < 13;
    const snapshot = JSON.stringify([
        fullName,
        birthYear,
        position,
        jerseyNumber,
        parentEmail,
        photoUrl,
        selectedSquadId,
    ]);
    const [initialSnapshot] = useState(snapshot);
    const close = () => {
        if (busy.current || uploadBusy.current) return;
        if (snapshot !== initialSnapshot) setDiscarding(true);
        else onClose();
    };
    useDialogFocus(true, dialogRef, close, personalDetailsLocked ? dialogRef : nameRef);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || uploadBusy.current || busy.current || personalDetailsLocked || under13) return;
        uploadBusy.current = true;
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('context', 'player-card');
            const res = await apiClient.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPhotoUrl(res.data.url);
        } catch {
            setError(t('minors.playerCard.photoFailed'));
        } finally {
            uploadBusy.current = false;
            setUploading(false);
            if (uploadRef.current) uploadRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy.current || uploadBusy.current) return;
        if (!personalDetailsLocked && !fullName.trim()) {
            setError(t('minors.playerCard.nameRequired'));
            return;
        }
        const year = Number(birthYear);
        if (!personalDetailsLocked && (!Number.isInteger(year) || year < currentYear - 100 || year > currentYear - 4)) {
            setError(t('minors.playerCard.birthYearInvalid'));
            return;
        }
        busy.current = true;
        setSaving(true);
        setError(null);
        try {
            if (editing && card) {
                const roster = {
                    position: position || null,
                    jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
                    ...(squadId != null && squadId !== card.squadId ? { squadId } : {}),
                };
                await updatePlayerCard(
                    clubId,
                    card.id,
                    personalDetailsLocked
                        ? roster
                        : {
                              ...roster,
                              fullName: fullName.trim(),
                              birthYear: year,
                              photoUrl: under13 ? null : photoUrl,
                              ...(card.claimed ? {} : { parentEmail: parentEmail.trim() || null }),
                          },
                );
                onCardUpdated?.();
            } else {
                await createPlayerCard(clubId, {
                    fullName: fullName.trim(),
                    birthYear: year,
                    position: position || null,
                    jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
                    photoUrl: under13 ? null : photoUrl,
                    parentEmail: parentEmail.trim() || null,
                    ...(selectedSquadId != null && !needsConsent ? { squadId: selectedSquadId } : {}),
                });
                onCardCreated?.();
            }
            onClose();
        } catch (err: unknown) {
            const apiData = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
            setError(
                apiData?.message ??
                    apiData?.error ??
                    (err instanceof Error ? err.message : t('minors.playerCard.failed')),
            );
        } finally {
            busy.current = false;
            setSaving(false);
        }
    };

    const selectedSquadName = squads?.find((squad) => squad.id === selectedSquadId)?.name ?? squadName;
    const title = personalDetailsLocked
        ? t('minors.playerCard.editRosterTitle')
        : t(editing ? 'minors.playerCard.editTitle' : 'minors.playerCard.title');
    const initials = fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('');
    return (
        <div
            className="prf-overlay squad-design"
            onClick={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div
                className="prf-dialog prf-card-dialog"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                tabIndex={-1}
            >
                <header className="prf-header">
                    <div>
                        <p className="prf-eyebrow">
                            {t('squadDesign.playerDetails', { defaultValue: 'Player details' })}
                        </p>
                        <h2 id={`${id}-title`}>
                            {title}
                            <span aria-hidden="true">.</span>
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="prf-icon"
                        onClick={close}
                        disabled={saving || uploading}
                        aria-label={t('squads.design.close', { defaultValue: 'Close' })}
                    >
                        <X size={20} />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="prf-form">
                    <div className="prf-body prf-card-body">
                        <div className="prf-fields">
                            {error && (
                                <p className="prf-error" role="alert">
                                    {error}
                                </p>
                            )}
                            {personalDetailsLocked && (
                                <p className="prf-note">
                                    <ShieldCheck size={18} />
                                    {t('minors.playerCard.activatedEditHint')}
                                </p>
                            )}
                            <fieldset disabled={saving || uploading} className="prf-section">
                                <legend>{t('squadDesign.identity', { defaultValue: 'The player' })}</legend>
                                <label htmlFor={`${id}-name`}>{t('minors.playerCard.fullName')}</label>
                                <input
                                    ref={nameRef}
                                    id={`${id}-name`}
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required={!personalDetailsLocked}
                                    disabled={personalDetailsLocked}
                                    maxLength={120}
                                    placeholder={t('minors.playerCard.namePlaceholder')}
                                    autoComplete="off"
                                />
                                <div className="prf-two-columns prf-photo-line">
                                    <div>
                                        <label htmlFor={`${id}-year`}>{t('minors.playerCard.birthYear')}</label>
                                        <input
                                            id={`${id}-year`}
                                            type="number"
                                            min={currentYear - 100}
                                            max={currentYear - 4}
                                            value={birthYear}
                                            onChange={(e) => setBirthYear(e.target.value)}
                                            required={!personalDetailsLocked}
                                            disabled={personalDetailsLocked}
                                            placeholder={t('minors.playerCard.yearPlaceholder')}
                                        />
                                    </div>
                                    <div>
                                        <label>{t('minors.playerCard.photo')}</label>
                                        {personalDetailsLocked ? (
                                            <p className="prf-hint">{t('minors.playerCard.activatedPhotoHint')}</p>
                                        ) : under13 ? (
                                            <p className="prf-hint">
                                                {t(
                                                    editing && photoUrl
                                                        ? 'minors.playerCard.photoRemovedOnFlip'
                                                        : 'minors.playerCard.photoRule',
                                                )}
                                            </p>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="prf-button prf-upload"
                                                    onClick={() => uploadRef.current?.click()}
                                                    disabled={uploading}
                                                >
                                                    <Upload size={15} />
                                                    {t(
                                                        uploading
                                                            ? 'minors.playerCard.uploading'
                                                            : photoUrl
                                                              ? 'minors.playerCard.replacePhoto'
                                                              : 'minors.playerCard.uploadPhoto',
                                                    )}
                                                </button>
                                                <input
                                                    ref={uploadRef}
                                                    type="file"
                                                    accept="image/*"
                                                    hidden
                                                    tabIndex={-1}
                                                    onChange={handlePhotoUpload}
                                                    disabled={uploading}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </fieldset>
                            <fieldset disabled={saving || uploading} className="prf-section">
                                <legend>{t('squadDesign.footballDetails', { defaultValue: 'On the pitch' })}</legend>
                                <div className="prf-two-columns prf-football-columns">
                                    <div>
                                        <label htmlFor={`${id}-position`}>{t('minors.playerCard.position')}</label>
                                        <select
                                            id={`${id}-position`}
                                            value={position}
                                            onChange={(e) => setPosition(e.target.value)}
                                        >
                                            {!POSITIONS.includes(position) && (
                                                <option value={position}>{positionLabel(position)}</option>
                                            )}
                                            {POSITIONS.map((value) => (
                                                <option key={value} value={value}>
                                                    {t(`squadDesign.positions.${value}`, {
                                                        defaultValue: positionLabel(value),
                                                    })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor={`${id}-number`}>{t('minors.playerCard.jerseyNumber')}</label>
                                        <input
                                            id={`${id}-number`}
                                            type="number"
                                            min={1}
                                            max={99}
                                            value={jerseyNumber}
                                            onChange={(e) => setJerseyNumber(e.target.value)}
                                            placeholder={t('minors.playerCard.numberPlaceholder')}
                                        />
                                    </div>
                                </div>
                                {!editing && squads && (
                                    <div className="prf-field">
                                        <label htmlFor={`${id}-squad`}>{t('minors.playerCard.squad')}</label>
                                        <select
                                            id={`${id}-squad`}
                                            value={selectedSquadId ?? ''}
                                            onChange={(e) =>
                                                setSelectedSquadId(e.target.value ? Number(e.target.value) : null)
                                            }
                                        >
                                            <option value="">{t('minors.playerCard.noSquad')}</option>
                                            {squads.map((squad) => (
                                                <option key={squad.id} value={squad.id}>
                                                    {squad.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {!editing && selectedSquadId != null && needsConsent && (
                                    <p className="prf-note" role="status">
                                        {t('minors.playerCard.consentBeforeSquad')}
                                    </p>
                                )}
                            </fieldset>
                            <fieldset disabled={saving || uploading} className="prf-section">
                                <legend>{t('squadDesign.guardian', { defaultValue: 'Parent or guardian' })}</legend>
                                <label htmlFor={`${id}-guardian`}>{t('minors.playerCard.parentEmail')}</label>
                                <input
                                    id={`${id}-guardian`}
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    disabled={personalDetailsLocked || card?.claimed === true}
                                    placeholder={t('minors.playerCard.parentEmailPlaceholder')}
                                    aria-describedby={`${id}-guardian-hint`}
                                />
                                <p className="prf-hint" id={`${id}-guardian-hint`}>
                                    {t('minors.playerCard.parentEmailHint')}
                                </p>
                            </fieldset>
                        </div>
                        <aside
                            className="prf-preview"
                            aria-label={t('squadDesign.playerPreview', { defaultValue: 'Player preview' })}
                        >
                            <p className="prf-eyebrow">
                                {t('squadDesign.rosterPreview', { defaultValue: 'On your roster' })}
                            </p>
                            <div className="prf-preview-avatar">
                                {!under13 && resolveMediaUrl(photoUrl) ? (
                                    <MediaImage src={resolveMediaUrl(photoUrl)} alt="" />
                                ) : initials ? (
                                    <span>{initials}</span>
                                ) : (
                                    <UserRound size={44} />
                                )}
                                {jerseyNumber && <b>#{jerseyNumber}</b>}
                            </div>
                            <h3>{fullName || t('squadDesign.newPlayer', { defaultValue: 'New player' })}</h3>
                            <p>{t(`squadDesign.positions.${position}`, { defaultValue: positionLabel(position) })}</p>
                            {birthYear && (
                                <p>{t('squadDesign.bornYear', { defaultValue: 'Born {{year}}', year: birthYear })}</p>
                            )}
                            {selectedSquadName && <p className="prf-preview-squad">{selectedSquadName}</p>}
                            <div className="prf-preview-status">
                                <Check size={14} />
                                {t(personalDetailsLocked ? 'minors.playerCard.registered' : 'squadDesign.accountFree', {
                                    defaultValue: 'No account needed',
                                })}
                            </div>
                        </aside>
                    </div>
                    <footer className="prf-footer">
                        {discarding ? (
                            <>
                                <p role="alert">
                                    {t('squadDesign.discardChanges', { defaultValue: 'Discard your changes?' })}
                                </p>
                                <div>
                                    <button type="button" className="prf-button" onClick={() => setDiscarding(false)}>
                                        {t('squadDesign.keepEditing', { defaultValue: 'Keep editing' })}
                                    </button>
                                    <button type="button" className="prf-button prf-danger" onClick={onClose}>
                                        {t('squadDesign.discard', { defaultValue: 'Discard' })}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="prf-hint">
                                    {personalDetailsLocked
                                        ? t('minors.playerCard.activatedSubtitle')
                                        : t('squadDesign.cardAccountHint', {
                                              defaultValue: 'Add to the club before creating an account.',
                                          })}
                                </p>
                                <div>
                                    <button
                                        type="button"
                                        className="prf-button"
                                        onClick={close}
                                        disabled={saving || uploading}
                                    >
                                        {t('minors.playerCard.cancel')}
                                    </button>
                                    <button type="submit" className="prf-primary" disabled={saving || uploading}>
                                        {saving && <Loader2 size={16} className="animate-spin" />}
                                        {t(editing ? 'minors.playerCard.save' : 'minors.playerCard.create')}
                                    </button>
                                </div>
                            </>
                        )}
                    </footer>
                </form>
            </div>
        </div>
    );
}
