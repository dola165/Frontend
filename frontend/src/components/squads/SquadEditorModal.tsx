import { useId, useRef, useState, type FormEvent } from 'react';
import { Loader2, Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { extractApiErrorMessage } from '../../utils/apiError';
import { squadLabel } from './squadLabels';
import './squad-workspace.css';

export interface SquadDetails {
    name: string;
    category: string;
    gender: string;
}

interface SquadEditorModalProps {
    initial?: SquadDetails;
    onClose: () => void;
    onSave: (details: SquadDetails) => Promise<void>;
}

/** Mount for each edit session so a different squad never inherits an unfinished form. */
export const SquadEditorModal = ({ initial, onClose, onSave }: SquadEditorModalProps) => {
    const { t } = useTranslation();
    const id = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const savingRef = useRef(false);
    const initialDetails = {
        name: initial?.name ?? '',
        category: initial?.category ?? 'SENIOR',
        gender: initial?.gender ?? 'MALE',
    };
    const [details, setDetails] = useState<SquadDetails>(initialDetails);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discarding, setDiscarding] = useState(false);
    const close = () => {
        if (savingRef.current) return;
        if (
            details.name !== initialDetails.name ||
            details.category !== initialDetails.category ||
            details.gender !== initialDetails.gender
        )
            setDiscarding(true);
        else onClose();
    };
    useDialogFocus(true, dialogRef, close, nameRef);

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (savingRef.current || !details.name.trim() || !details.category.trim()) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            await onSave({ ...details, name: details.name.trim(), category: details.category.trim().toUpperCase() });
            onClose();
        } catch (err) {
            setError(
                extractApiErrorMessage(
                    err,
                    t('squads.design.saveError', { defaultValue: 'Could not save the squad. Please try again.' }),
                ),
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <div
            className="sw-dialog-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-intro`}
                className="sw-dialog"
            >
                <header className="sw-dialog-header">
                    <div>
                        <p className="sd-eyebrow">
                            {t('squads.design.clubFootball', { defaultValue: 'Club football' })}
                        </p>
                        <h2 id={`${id}-title`}>
                            {initial
                                ? t('squads.design.editSquad', { defaultValue: 'Edit squad' })
                                : t('squads.design.newSquad', { defaultValue: 'New squad' })}
                        </h2>
                        <p id={`${id}-intro`} className="sd-muted">
                            {t('squads.design.editorIntro', {
                                defaultValue: 'A home for your team. Add the players next.',
                            })}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="sd-icon-button"
                        aria-label={t('squads.design.close', { defaultValue: 'Close' })}
                        onClick={close}
                        disabled={saving}
                    >
                        <X size={18} />
                    </button>
                </header>
                <form onSubmit={(event) => void save(event)}>
                    <div className="sw-dialog-fields">
                        {error && (
                            <p className="sw-error" role="alert">
                                {error}
                            </p>
                        )}
                        <label htmlFor={`${id}-name`}>
                            <span>{t('squads.design.squadName', { defaultValue: 'Squad name' })}</span>
                            <input
                                ref={nameRef}
                                id={`${id}-name`}
                                value={details.name}
                                onChange={(event) => setDetails((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder={t('squads.design.nameExample', {
                                    defaultValue: 'e.g. U16 Boys or First Team',
                                })}
                                required
                                disabled={saving}
                                autoComplete="off"
                            />
                        </label>
                        <div className="sw-dialog-pair">
                            <label htmlFor={`${id}-category`}>
                                <span>{t('squads.design.ageGroup', { defaultValue: 'Age group' })}</span>
                                <input
                                    id={`${id}-category`}
                                    list={`${id}-categories`}
                                    value={details.category}
                                    onChange={(event) =>
                                        setDetails((prev) => ({ ...prev, category: event.target.value.toUpperCase() }))
                                    }
                                    required
                                    disabled={saving}
                                    autoComplete="off"
                                />
                                <datalist id={`${id}-categories`}>
                                    {[
                                        'SENIOR',
                                        'U23',
                                        'U21',
                                        'U19',
                                        'U18',
                                        'U17',
                                        'U16',
                                        'U15',
                                        'U14',
                                        'U13',
                                        'U12',
                                        'U11',
                                        'U10',
                                        'U9',
                                        'U8',
                                    ].map((category) => (
                                        <option key={category} value={category} />
                                    ))}
                                </datalist>
                            </label>
                            <label htmlFor={`${id}-gender`}>
                                <span>{t('squads.design.teamType', { defaultValue: 'Team type' })}</span>
                                <select
                                    id={`${id}-gender`}
                                    value={details.gender}
                                    onChange={(event) =>
                                        setDetails((prev) => ({ ...prev, gender: event.target.value }))
                                    }
                                    disabled={saving}
                                >
                                    <option value="MALE">{t('squads.design.male', { defaultValue: 'Male' })}</option>
                                    <option value="FEMALE">
                                        {t('squads.design.female', { defaultValue: 'Female' })}
                                    </option>
                                    <option value="MIXED">{t('squads.design.mixed', { defaultValue: 'Mixed' })}</option>
                                </select>
                            </label>
                        </div>
                        <div className="sw-squad-preview">
                            <Shield size={28} aria-hidden="true" />
                            <div>
                                <strong>
                                    {details.name.trim() ||
                                        t('squads.design.yourSquad', { defaultValue: 'Your new squad' })}
                                </strong>
                                <span>
                                    {details.category.trim() ? squadLabel(details.category.trim(), t) : '—'} ·{' '}
                                    {t(`squads.design.${details.gender.toLowerCase()}`, {
                                        defaultValue: details.gender,
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <footer className="sw-dialog-footer">
                        {discarding ? (
                            <>
                                <p role="alert">
                                    {t('squadDesign.discardChanges', { defaultValue: 'Discard your changes?' })}
                                </p>
                                <button type="button" className="sd-button" onClick={() => setDiscarding(false)}>
                                    {t('squadDesign.keepEditing', { defaultValue: 'Keep editing' })}
                                </button>
                                <button type="button" className="sd-button sw-discard" onClick={onClose}>
                                    {t('squadDesign.discard', { defaultValue: 'Discard' })}
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="sd-button" onClick={close} disabled={saving}>
                                    {t('squads.design.cancel', { defaultValue: 'Cancel' })}
                                </button>
                                <button
                                    type="submit"
                                    className="sd-primary"
                                    disabled={saving || !details.name.trim() || !details.category.trim()}
                                >
                                    {saving && <Loader2 size={16} className="animate-spin" />}
                                    {initial
                                        ? t('squads.design.saveChanges', { defaultValue: 'Save changes' })
                                        : t('squads.design.createSquad', { defaultValue: 'Create squad' })}
                                </button>
                            </>
                        )}
                    </footer>
                </form>
            </div>
        </div>
    );
};

