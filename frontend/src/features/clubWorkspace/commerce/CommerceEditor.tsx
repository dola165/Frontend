import { useEffect, useId, useRef, type FormEventHandler, type ReactNode } from 'react';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import { CommerceDraftNotice } from '../../../components/workspace/CommerceDraftScope';
import { Button, PageFrame, PageHeader } from '../../../design/primitives';
import './commerce.css';

/**
 * One-page editor for a role, a product or a campaign: grouped fields on the left, a live preview and a
 * readiness checklist beside them, and a save bar that stays in view. Every field stays mounted, so
 * uploads and unsaved values survive. Saving checks the whole form and focuses the first field that
 * needs attention (opening its disclosure). Escape and Close ask before discarding; a pending save or
 * upload locks the form.
 */
export function CommerceEditor({
    title, description, formLabel, children, preview, saveLabel, saving, disabled = saving, footerNote,
    onSubmit, onRequestClose, closeLabel = 'Close editor', backLabel, feedback, confirmation,
}: {
    title: string; description: string; formLabel: string; children: ReactNode; preview: ReactNode;
    saveLabel: string; saving: boolean; disabled?: boolean; footerNote: string;
    onSubmit: FormEventHandler<HTMLFormElement>; onRequestClose: () => void;
    closeLabel?: string; backLabel: string; feedback?: ReactNode; confirmation?: ReactNode;
}) {
    const descriptionId = useId();
    const form = useRef<HTMLFormElement>(null);
    useEffect(() => { form.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, []);
    const validate = () => {
        const controls = Array.from(form.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select') ?? []);
        const invalid = controls.find(control => control.willValidate && !control.validity.valid);
        if (!invalid) return true;
        // Optional disclosures may contain the field that needs correction.
        for (let parent = invalid.parentElement; parent && parent !== form.current; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
        invalid.focus(); invalid.reportValidity();
        return false;
    };
    return <PageFrame className="cw-page cm-page">
        <form ref={form} noValidate className="cm-editor" aria-label={formLabel} aria-describedby={descriptionId} aria-busy={disabled}
            onSubmit={event => { if (disabled || !validate()) { event.preventDefault(); return; } onSubmit(event); }}
            onKeyDown={event => { if (event.key === 'Escape' && !disabled && !event.defaultPrevented) { event.preventDefault(); onRequestClose(); } }}>
            <div className="cm-editor__back"><Button variant="ghost" size="sm" disabled={disabled} onClick={onRequestClose}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
            <PageHeader title={title} subtitle={<span id={descriptionId}>{description}</span>} />
            <div className="cm-editor__feedback"><CommerceDraftNotice />{feedback}</div>
            <div className="cm-editor__layout">
                <fieldset disabled={disabled} className="cm-editor__fields">{children}</fieldset>
                <aside className="cm-editor__aside" aria-label={`${formLabel} preview and guidance`}>{preview}</aside>
            </div>
            <div className="cm-editor__bar">
                <p className="cm-editor__note">{footerNote}</p>
                <div className="cm-editor__actions">
                    <Button disabled={disabled} onClick={onRequestClose}>{closeLabel}</Button>
                    <Button type="submit" variant="primary" disabled={disabled}>{saving ? 'Saving…' : saveLabel}</Button>
                </div>
                {confirmation}
            </div>
        </form>
    </PageFrame>;
}

/** A titled group of fields inside the editor. */
export function EditorSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    const titleId = useId();
    return <section className="gk-panel cm-section" aria-labelledby={titleId}>
        <header className="cm-section__head"><h2 id={titleId} className="gk-panel__title">{title}</h2>{description && <p className="cm-hint">{description}</p>}</header>
        <div className="cm-section__body">{children}</div>
    </section>;
}

export function EditorChecklist({ title = 'Before you publish', items, children }: { title?: string; items: { label: string; complete: boolean }[]; children?: ReactNode }) {
    return <section className="gk-panel cm-checklist">
        <h2 className="gk-panel__title">{title}</h2>
        <ul>{items.map(item => <li key={item.label} data-complete={item.complete}>
            {item.complete ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <span><span className="gk-visually-hidden">{item.complete ? 'Complete: ' : 'To do: '}</span>{item.label}</span>
        </li>)}</ul>
        {children && <p className="cm-hint">{children}</p>}
    </section>;
}

/** The live preview card beside the editor: what supporters or candidates will see once it is saved. */
export function EditorPreview({ label, media, children, footnote }: { label: string; media?: ReactNode; children: ReactNode; footnote?: ReactNode }) {
    return <section className="gk-panel cm-preview" aria-label={label}>
        <p className="cm-preview__label"><span>{label}</span><span>Unsaved</span></p>
        {media && <div className="cm-preview__media">{media}</div>}
        <div className="cm-preview__body">{children}</div>
        {footnote && <p className="cm-hint cm-preview__foot">{footnote}</p>}
    </section>;
}

/** Asks before unsaved edits are thrown away. Keep editing returns focus to where the person was. */
export function EditorDiscardPrompt({ disabled, onKeepEditing, onDiscard, label = 'Discard edits', question = 'Discard your unsaved changes?', detail = 'Your saved version stays as it is.', keepLabel = 'Keep editing', discardLabel = 'Discard edits' }: {
    disabled: boolean; onKeepEditing: () => void; onDiscard: () => void; label?: string; question?: string; detail?: string; keepLabel?: string; discardLabel?: string;
}) {
    const prompt = useRef<HTMLDivElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (!previousFocus.current && document.activeElement instanceof HTMLElement && !prompt.current?.contains(document.activeElement)) previousFocus.current = document.activeElement;
        prompt.current?.focus();
    }, []);
    return <div ref={prompt} tabIndex={-1} role="group" aria-label={label} className="gk-notice gk-notice--warning cm-discard">
        <div className="cm-discard__text"><strong>{question}</strong><span>{detail}</span></div>
        <div className="cm-editor__actions">
            <Button onClick={() => { onKeepEditing(); previousFocus.current?.focus(); }}>{keepLabel}</Button>
            <Button variant="danger" disabled={disabled} onClick={() => { if (!disabled) onDiscard(); }}>{discardLabel}</Button>
        </div>
    </div>;
}
