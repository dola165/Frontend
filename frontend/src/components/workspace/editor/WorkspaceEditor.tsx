import { Children, useEffect, useId, useRef, type FormEventHandler, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Circle, Loader2 } from 'lucide-react';
import { useCommerceDraftState } from '../commerceDraftState';
import '../opportunities/opportunities.css';
import './workspace-editor.css';

/** Steps stay mounted so uploads and unsaved field state survive navigation. */
export function WorkspaceEditor({
    title, eyebrow, description, formLabel, accent, children, preview, saveLabel,
    saving, disabled = saving, footerNote, onSubmit, onRequestClose,
    closeLabel = 'Close editor', backLabel, feedback, confirmation, stepLabels,
}: {
    title: string; eyebrow: string; description: string; formLabel: string;
    accent: 'store' | 'campaign' | 'job' | 'club'; children: ReactNode; preview: ReactNode;
    saveLabel: string; saving: boolean; disabled?: boolean; footerNote: string;
    onSubmit: FormEventHandler<HTMLFormElement>; onRequestClose: () => void;
    closeLabel?: string; backLabel: string; feedback?: ReactNode; confirmation?: ReactNode;
    stepLabels: readonly string[];
}) {
    const descriptionId = useId();
    const form = useRef<HTMLFormElement>(null);
    const [step, setStep] = useCommerceDraftState('form:editorStep', 0);
    const panels = Children.toArray(children);
    const currentStep = Math.min(step, panels.length - 1);
    const showStep = (next: number) => {
        setStep(next);
        form.current?.scrollIntoView?.({block: 'start', behavior: 'instant'});
    };
    useEffect(() => { form.current?.scrollIntoView?.({block: 'start', behavior: 'instant'}); }, []);
    const validate = (all: boolean) => {
        const controls = Array.from(form.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select') ?? []);
        const invalid = controls.find(control => control.willValidate && !control.validity.valid && (all || control.closest('[data-editor-step]')?.getAttribute('data-editor-step') === String(currentStep)));
        if (!invalid) return true;
        const panel = invalid.closest('[data-editor-step]');
        if (panel) showStep(Number(panel.getAttribute('data-editor-step')));
        requestAnimationFrame(() => {
            // Optional disclosures may contain the field that needs correction.
            let parent = invalid.parentElement;
            while (parent && parent !== form.current) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
            invalid.focus(); invalid.reportValidity();
        });
        return false;
    };
    return <form ref={form} noValidate className={`op-workspace workspace-editor workspace-editor--${accent}`} data-section={accent === 'club' ? 'club' : accent === 'store' ? 'store' : accent === 'campaign' ? 'campaigns' : 'jobs'} aria-label={formLabel}
        aria-describedby={descriptionId} aria-busy={disabled}
        onSubmit={event => {if(accent==='club' && currentStep < panels.length - 1){event.preventDefault();if(!disabled && validate(false))showStep(currentStep+1);return;}if (disabled || !validate(true)) {event.preventDefault(); return;} onSubmit(event);}}
        onKeyDown={event => {if (event.key === 'Escape' && !disabled && !event.defaultPrevented) {event.preventDefault(); onRequestClose();}}}>
        <header className="workspace-editor__header">
            <button type="button" className="workspace-editor__back" disabled={disabled} onClick={onRequestClose}><ArrowLeft size={16} aria-hidden="true"/>{backLabel}</button>
            <p className="workspace-editor__eyebrow">{eyebrow}</p><h3>{title}</h3><p id={descriptionId} className="workspace-editor__intro">{description}</p>
        </header>
        <nav className="op-steps" aria-label="Editor steps">{stepLabels.map((label, index) => <button type="button" key={label} disabled={disabled} aria-current={currentStep === index ? 'step' : undefined} className={currentStep === index ? 'active' : currentStep > index ? 'visited' : ''} onClick={() => showStep(index)}><span>{currentStep > index ? <Check size={15}/> : `0${index + 1}`}</span><strong>{label}</strong>{index < stepLabels.length - 1 && <ChevronRight size={16}/>}</button>)}</nav>
        {feedback && <div className="workspace-editor__feedback">{feedback}</div>}
        <div className="workspace-editor__layout"><fieldset disabled={disabled} className="workspace-editor__fields">{panels.map((panel, index) => <div key={index} className="workspace-editor__panel" data-editor-step={index} hidden={index !== currentStep}>{panel}</div>)}</fieldset><aside className="workspace-editor__aside" aria-label={`${formLabel} preview and guidance`}>{preview}</aside></div>
        <footer className="workspace-editor__footer"><div className="workspace-editor__savebar"><p>{footerNote}</p><div className="workspace-editor__actions">
            <button type="button" className="workspace-editor__button" disabled={disabled} onClick={onRequestClose}>{closeLabel}</button>
            {currentStep > 0 && <button type="button" className="workspace-editor__button" disabled={disabled} onClick={() => showStep(currentStep - 1)}><ArrowLeft size={15}/>Back</button>}
            {(accent!=='club' || currentStep === panels.length - 1) && <button type="submit" className={`workspace-editor__button ${currentStep === panels.length - 1 ? 'workspace-editor__button--primary' : ''}`} disabled={disabled}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden="true"/>}{saving ? 'Saving...' : saveLabel}</button>}
            {currentStep < panels.length - 1 && <button type="button" className="workspace-editor__button workspace-editor__button--primary" disabled={disabled} onClick={() => {if (validate(false)) showStep(currentStep + 1);}}>Continue<ArrowRight size={16}/></button>}
        </div></div>{confirmation}</footer>
    </form>;
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
