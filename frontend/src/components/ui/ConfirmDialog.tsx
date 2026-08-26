import { AlertTriangle } from 'lucide-react';

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
    if (!open) return null;

    const accentColor =
        variant === 'danger' ? 'var(--fc-error, #ef4444)'
        : variant === 'warning' ? 'var(--fc-warning, #f59e0b)'
        : 'var(--fc-accent, #16a34a)';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={onCancel}
        >
            <div
                className="rounded-[6px] border border-[#ffffff0d] bg-[#16181d] p-6 max-w-md w-full shadow-2xl"
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
                        <h3 className="text-base font-semibold text-[#f4f4f5] mb-2">
                            {title}
                        </h3>
                        <p className="text-sm text-[#a1a1aa] leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>
                {noteField && (
                    <div className="mt-4">
                        <label htmlFor="confirm-dialog-note" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                            {noteField.label}
                        </label>
                        <textarea
                            id="confirm-dialog-note"
                            value={noteField.value}
                            maxLength={noteField.maxLength}
                            onChange={(e) => noteField.onChange(e.target.value)}
                            placeholder={noteField.placeholder}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-[#ffffff0d] bg-[#0f1117] px-3 py-2 text-sm text-[#f4f4f5] outline-none placeholder:text-[#a1a1aa] focus:border-[var(--fc-accent)]"
                        />
                    </div>
                )}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm rounded-[6px] border border-[#ffffff0d] text-[#a1a1aa]
                                   hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f4f4f5] transition-colors"
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
