import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialogFocus } from '../workspace/useDialogFocus';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    /** Optional note textarea (phase A2 — gentle release message). */
    noteField?: {
        label: string;
        placeholder?: string;
        maxLength?: number;
        value: string;
        onChange: (value: string) => void;
    };
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    noteField,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(open, dialogRef, onCancel);

    if (!open) return null;

    const accentColor =
        variant === 'danger' ? 'var(--fc-error, #ef4444)'
        : variant === 'warning' ? 'var(--fc-warning, #f59e0b)'
        : 'var(--fc-accent, #16a34a)';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onCancel}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[6px] border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div
                        className="p-2 rounded-[6px] shrink-0"
                        style={{ backgroundColor: `${accentColor}15` }}
                    >
                        <AlertTriangle size={22} style={{ color: accentColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 id="confirm-dialog-title" className="text-base font-semibold text-[var(--fc-text-primary)] mb-2">
                            {title}
                        </h3>
                        <p id="confirm-dialog-message" className="text-sm text-[var(--fc-text-secondary)] leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>
                {noteField && (
                    <div className="mt-4">
                        <label htmlFor="confirm-dialog-note" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-secondary)]">
                            {noteField.label}
                        </label>
                        <textarea
                            id="confirm-dialog-note"
                            value={noteField.value}
                            maxLength={noteField.maxLength}
                            onChange={(e) => noteField.onChange(e.target.value)}
                            placeholder={noteField.placeholder}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)] focus:border-[var(--fc-accent)]"
                        />
                    </div>
                )}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm rounded-[6px] border border-[var(--fc-border)] text-[var(--fc-text-secondary)]
                                   hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)] transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-semibold rounded-[6px] text-white transition-colors"
                        style={{ backgroundColor: accentColor }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
