import { useEffect, useId, useRef, type FormEventHandler, type ReactNode } from 'react';
import { ArrowLeft, Check, Circle, Loader2 } from 'lucide-react';
import './workspace-editor.css';

/** A workspace page, not a modal: staff can still navigate and return to their draft. */
export function WorkspaceEditor({
    title, eyebrow, description, formLabel, accent, children, preview, saveLabel,
    saving, disabled = saving, footerNote, onSubmit, onRequestClose,
    closeLabel = 'Close editor', backLabel, feedback, confirmation,
}: {
    title: string;
    eyebrow: string;
    description: string;
    formLabel: string;
    accent: 'store' | 'campaign' | 'job';
    children: ReactNode;
    preview: ReactNode;
    saveLabel: string;
    saving: boolean;
    disabled?: boolean;
    footerNote: string;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onRequestClose: () => void;
    closeLabel?: string;
    backLabel: string;
    feedback?: ReactNode;
    confirmation?: ReactNode;
}) {
    const descriptionId = useId();
    const form = useRef<HTMLFormElement>(null);
    useEffect(() => {
        form.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    }, []);
    return (
        <form ref={form} className={`workspace-editor workspace-editor--${accent}`} aria-label={formLabel}
            aria-describedby={descriptionId} aria-busy={disabled} onSubmit={onSubmit}
            onKeyDown={event => {
                if (event.key === 'Escape' && !disabled && !event.defaultPrevented) {
                    event.preventDefault(); onRequestClose();
                }
            }}>
            <header className="workspace-editor__header">
                <button type="button" className="workspace-editor__back" disabled={disabled} onClick={onRequestClose}>
                    <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
                </button>
                <p className="workspace-editor__eyebrow">{eyebrow}</p>
                <h3>{title}</h3>
                <p id={descriptionId} className="workspace-editor__intro">{description}</p>
                <p className="workspace-editor__required-note"><span aria-hidden="true">*</span> Required to save. You can review the details before saving.</p>
            </header>
            {feedback && <div className="workspace-editor__feedback">{feedback}</div>}
            <div className="workspace-editor__layout">
                <fieldset disabled={disabled} className="workspace-editor__fields">{children}</fieldset>
                <aside className="workspace-editor__aside" aria-label={`${formLabel} preview and guidance`}>{preview}</aside>
            </div>
            <footer className="workspace-editor__footer">
                <div className="workspace-editor__savebar">
                    <p>{footerNote}</p>
                    <div className="workspace-editor__actions">
                        <button type="button" className="workspace-editor__button" disabled={disabled} onClick={onRequestClose}>{closeLabel}</button>
                        <button type="submit" className="workspace-editor__button workspace-editor__button--primary" disabled={disabled}>
                            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                            {saving ? 'Saving...' : saveLabel}
                        </button>
                    </div>
                </div>
                {confirmation}
            </footer>
        </form>
    );
}

export function EditorSection({ number, title, description, children }: {
    number: string; title: string; description: string; children: ReactNode;
}) {
    const titleId = useId();
    return <section className="workspace-editor__section" aria-labelledby={titleId}>
        <header><span className="workspace-editor__step" aria-hidden="true">{number}</span><div><h4 id={titleId}>{title}</h4><p>{description}</p></div></header>
        <div className="workspace-editor__section-body">{children}</div>
    </section>;
}

export function EditorChecklist({ title = 'Before you publish', items, children }: {
    title?: string;
    items: { label: string; complete: boolean }[];
    children?: ReactNode;
}) {
    return <section className="workspace-editor__checklist">
        <h4>{title}</h4>
        <ul>{items.map(item => <li key={item.label} data-complete={item.complete}>
            {item.complete ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
            <span><span className="sr-only">{item.complete ? 'Complete: ' : 'To do: '}</span>{item.label}</span>
        </li>)}</ul>
        {children && <div className="workspace-editor__hint">{children}</div>}
    </section>;
}

export function EditorDiscardPrompt({ disabled, onKeepEditing, onDiscard, label = 'Discard edits' }: {
    disabled: boolean; onKeepEditing: () => void; onDiscard: () => void; label?: string;
}) {
    const prompt = useRef<HTMLDivElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (!previousFocus.current && document.activeElement instanceof HTMLElement && !prompt.current?.contains(document.activeElement)) {
            previousFocus.current = document.activeElement;
        }
        prompt.current?.focus();
    }, []);
    return <div ref={prompt} tabIndex={-1} role="group" aria-label={label} className="workspace-editor__discard">
        <div><strong>Discard your unsaved changes?</strong><p>Your saved version will stay as it is. Keep editing to continue this draft.</p></div>
        <div className="workspace-editor__actions">
            <button type="button" className="workspace-editor__button" onClick={() => { onKeepEditing(); previousFocus.current?.focus(); }}>Keep editing</button>
            <button type="button" className="workspace-editor__button workspace-editor__button--danger" disabled={disabled} onClick={() => { if (!disabled) onDiscard(); }}>Discard edits</button>
        </div>
    </div>;
}
