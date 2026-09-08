import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, MessageSquareText, X } from 'lucide-react';
import { useDialogFocus } from '../useDialogFocus';

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
    const [note, setNote] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);
    useDialogFocus(true, dialogRef, onClose, noteRef);

    const trimmed = note.trim();
    const confirm = () => onConfirm(trimmed.length > 0 ? trimmed : null);

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center">
            <div className="theme-overlay absolute inset-0" onClick={onClose} />
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="decision-note-title" aria-describedby="decision-note-subtitle" className="relative z-10 mx-4 w-full max-w-md border border-[var(--fc-border)] bg-[var(--fc-page-bg)] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#ffffff0d] px-5 py-4">
                    <div className="flex items-center gap-3">
                        <MessageSquareText className="h-5 w-5 text-[var(--fc-accent)]" />
                        <div>
                            <h2 id="decision-note-title" className="text-sm font-semibold text-[var(--fc-text-primary)]">{title}</h2>
                            <p id="decision-note-subtitle" className="mt-0.5 text-[11px] font-medium text-[var(--fc-text-secondary)]">{subtitle}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('decisions.close')} className="p-1 text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Note */}
                <div className="px-5 py-4">
                    <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="decision-note" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-secondary)]">
                            {t('decisions.noteLabel')}
                        </label>
                        <button
                            type="button"
                            onClick={() => setNote(t(templateKey))}
                            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fc-accent)] hover:underline"
                        >
                            {t('decisions.templateChip')}
                        </button>
                    </div>
                    <textarea
                        ref={noteRef}
                        id="decision-note"
                        value={note}
                        maxLength={MAX_NOTE_LENGTH}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t('decisions.notePlaceholder')}
                        rows={4}
                        className="w-full resize-none rounded-lg border border-[var(--fc-border)] bg-elevated px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)] focus:border-[var(--fc-accent)]"
                    />
                    <p className="mt-1 text-right text-[10px] font-medium text-[var(--fc-text-muted)]">
                        {t('decisions.charCount', { count: note.length })}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-[var(--fc-border)] px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="border border-[var(--fc-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]"
                    >
                        {t('decisions.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={saving}
                        className={`inline-flex items-center gap-1.5 border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] disabled:opacity-50 ${
                            danger
                                ? 'border-[var(--fc-state-danger)] bg-[var(--fc-state-danger)] text-white hover:opacity-90'
                                : 'border-[#16a34a] bg-[#16a34a] text-[color:var(--accent-on-primary)] hover:bg-[#16a34a]-hover'
                        }`}
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
