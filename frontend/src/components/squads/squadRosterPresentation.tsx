import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useRef, useState, type FormEvent } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { squadLabel } from './squadLabels';
import { MediaImage } from '../ui/MediaImage';
import { TrialistBadge } from '../workspace/TrialistBadge';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import type { SquadRosterPlayer } from './SquadRosterTable';

export const RosterAvatar = ({ player }: { player: SquadRosterPlayer }) => {
    const [failed, setFailed] = useState(false);
    const photo = resolveMediaUrl(player.photoUrl);
    const initials = player.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('');
    return (
        <span className="sr-avatar" aria-hidden="true">
            {photo && !failed ? (
                <MediaImage src={photo} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                initials || '—'
            )}
        </span>
    );
};

export const RosterManagementBadges = ({ player }: { player: SquadRosterPlayer }) => {
    const { t } = useTranslation();
    return (
        <>
            {player.isRegistered === false && (
                <span className="sr-badge">{t('squadDesign.roster.cardOnly', { defaultValue: 'Player card' })}</span>
            )}
            {player.status === 'TRIALIST' && <TrialistBadge joinedAt={player.joinedAt} />}
        </>
    );
};

export type UpdateRosterPlayer = (
    userId: number,
    jerseyNumber: number | null,
    squadRole: string | null,
) => void | Promise<void>;

export const RosterPlayerEditor = ({
    player,
    onSave,
    onClose,
}: {
    player: SquadRosterPlayer;
    onSave: UpdateRosterPlayer;
    onClose: () => void;
}) => {
    const { t } = useTranslation();
    const [number, setNumber] = useState(String(player.number ?? ''));
    const [role, setRole] = useState(player.squadRole || 'PLAYER');
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [error, setError] = useState('');
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (savingRef.current) return;
        const parsedNumber = number.trim() ? Number(number) : null;
        if (
            (parsedNumber != null && (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 99)) ||
            (player.number != null && parsedNumber == null)
        ) {
            setError(t('squadDesign.roster.numberHint', { defaultValue: 'Use a shirt number from 1 to 99.' }));
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setError('');
        try {
            await onSave(player.id, parsedNumber, role);
            onClose();
        } catch {
            setError(
                t('squadDesign.roster.saveFailed', { defaultValue: 'Could not save these changes. Please try again.' }),
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    return (
        <form
            className="sr-player-editor"
            onSubmit={(event) => void submit(event)}
            aria-label={t('squadDesign.roster.editPlayer', { defaultValue: 'Edit {{name}}', name: player.name })}
        >
            <div className="sr-editor-fields">
                <label>
                    {t('squadDesign.roster.shirtNumber', { defaultValue: 'Shirt number' })}
                    <input
                        aria-label={t('squadDesign.roster.shirtNumber', { defaultValue: 'Shirt number' })}
                        type="number"
                        min={1}
                        max={99}
                        required={player.number != null}
                        value={number}
                        onChange={(event) => setNumber(event.target.value)}
                        disabled={saving}
                        autoFocus
                    />
                </label>
                <label>
                    {t('squadDesign.roster.squadRole', { defaultValue: 'Squad role' })}
                    <select
                        aria-label={t('squadDesign.roster.squadRole', { defaultValue: 'Squad role' })}
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        disabled={saving}
                    >
                        {!['PLAYER', 'CAPTAIN', 'TRIALIST'].includes(role) && (
                            <option value={role}>{squadLabel(role, t)}</option>
                        )}
                        {['PLAYER', 'CAPTAIN', 'TRIALIST'].map((value) => (
                            <option key={value} value={value}>
                                {squadLabel(value, t)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {error && (
                <p className="sr-editor-error" role="alert">
                    {error}
                </p>
            )}
            <div className="sr-editor-actions">
                <button type="button" className="sd-button" onClick={onClose} disabled={saving}>
                    <X size={14} />
                    {t('squadDesign.roster.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button type="submit" className="sd-primary" disabled={saving}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {t('squadDesign.roster.save', { defaultValue: 'Save changes' })}
                </button>
            </div>
        </form>
    );
};

export const RosterProfileLink = ({ player, avatar = false, children }: { player: SquadRosterPlayer; avatar?: boolean; children: ReactNode }) => player.isRegistered === false
    ? <span>{children}</span>
    : <Link className="sr-profile-link" to={`/profile/${player.id}`} aria-label={avatar ? `View ${player.name}'s profile` : undefined}>{children}</Link>;
