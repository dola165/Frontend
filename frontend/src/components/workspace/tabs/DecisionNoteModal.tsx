import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, MessageSquareText, X } from 'lucide-react';
import { useDialogFocus } from '../useDialogFocus';
import { useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import '../../squads/squad-design.css';
import '../recruitment/recruitment-design.css';

interface DecisionNoteModalProps {
    title: string;
    subtitle: string;
    saving: boolean;
    /** Confirm button label — defaults to the translated "Accept". */
    confirmLabel?: string;
    /** Danger styling for decline flows. */
    danger?: boolean;
    /** i18n key for the "Use template" copy (defaults to the trial invitation). */
    templateKey?: string;
    onClose: () => void;
    onConfirm: (message: string | null) => void;
}

const MAX_NOTE_LENGTH = 1000;

/**
 * Phase A2/A3/A6 — optional decision note shared by application-accept,
 * tryout-accept, bulk decisions, and the gentle-decline flows. Mounted fresh
 * per open; the mutation runs in the parent so the error banner stays the
 * single surface.
 */
export const DecisionNoteModal = ({
    title, subtitle, saving, confirmLabel, danger = false, templateKey = 'decisions.template', onClose, onConfirm,
}: DecisionNoteModalProps) => {
    const { t } = useTranslation();
    const r = useRecruitmentCopy();
    const [note, setNote] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);
    const close = () => { if (!saving) onClose(); };
    useDialogFocus(true, dialogRef, close, noteRef);

    const trimmed = note.trim();
    const confirm = () => { if (!saving) onConfirm(trimmed.length > 0 ? trimmed : null); };

    return (
        <div className="squad-design recruitment-design rc-overlay">
            <div className="rc-backdrop" onClick={close} />
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="decision-note-title" aria-describedby="decision-note-subtitle" className="rc-dialog">
                {/* Header */}
                <div className="rc-dialog-header">
                    <div className="flex items-start gap-3">
                        <MessageSquareText className="mt-1 h-5 w-5 shrink-0 text-[var(--fc-accent)]" />
                        <div>
                            <h2 id="decision-note-title" className="text-sm font-semibold text-[var(--fc-text-primary)]">{title}</h2>
                            <p id="decision-note-subtitle" className="mt-0.5 text-[11px] font-medium text-[var(--fc-text-secondary)]">{subtitle}</p>
                        </div>
                    </div>
                    <button type="button" onClick={close} disabled={saving} aria-label={t('decisions.close')} className="sd-icon-button">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Note */}
                <div className="rc-dialog-body">
                    <div className="rc-note-label">
                        <label htmlFor="decision-note">
                            {t('decisions.noteLabel')}
                        </label>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => setNote(t(templateKey))}
                            className="rc-link"
                        >
                            {t('decisions.templateChip')}
                        </button>
                    </div>
                    <div className="rc-form-field"><textarea
                        ref={noteRef}
                        id="decision-note"
                        value={note}
                        disabled={saving}
                        maxLength={MAX_NOTE_LENGTH}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t('decisions.notePlaceholder')}
                        rows={5}
                    /><small>{r('noteHint')}</small></div>
                    <p className="rc-note-counter">
                        {t('decisions.charCount', { count: note.length })}
                    </p>
                </div>

                {/* Footer */}
                <div className="rc-dialog-footer">
                    <button
                        type="button"
                        onClick={close}
                        disabled={saving}
                        className="sd-button"
                    >
                        {t('decisions.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={saving}
                        className={danger ? 'sd-button rc-danger' : 'sd-primary'}
                    >
                        {saving ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> {t('decisions.saving')}
                            </span>
                        ) : (
                            <>
                                <Check className="h-3.5 w-3.5" /> {confirmLabel ?? t('decisions.accept')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
