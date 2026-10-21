import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { usePagesCopy } from '../copy';
import './edit.css';

/**
 * Text edited in place: it looks like the text until it is pressed, then it is a field. Saved when the person leaves
 * it or presses Enter (a paragraph: Ctrl+Enter); Escape puts the old text back. Never a Save button.
 */
export function InlineText({ value, placeholder, label, multiline = false, maxLength = 120, className, as: Tag = 'span', autoFocus = false, step, onSave }: {
  value: string; placeholder: string; label: string; multiline?: boolean; maxLength?: number; className?: string; as?: 'span' | 'h1' | 'p'; autoFocus?: boolean;
  /** The set-up step this text is (`about`): the steps list opens it here. */
  step?: string;
  onSave: (next: string) => void | boolean | Promise<void | boolean>;
}) {
  const t = usePagesCopy();
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(autoFocus);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const saving = useRef(false);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const id = useId();
  useEffect(() => { if (!open) setDraft(value); }, [open, value]);
  useEffect(() => { if (open) { field.current?.focus(); field.current?.select(); } }, [open]);
  const commit = async () => {
    if (saving.current) return;
    const next = draft.trim().replace(/\s+/g, multiline ? '\n' : ' ');
    if (next === value) { setOpen(false); return; }
    saving.current = true;
    setBusy(true);
    setFailed(false);
    try { if (await onSave(next) !== false) setOpen(false); else setFailed(true); }
    catch { setFailed(true); }
    finally { saving.current = false; setBusy(false); }
  };
  const cancel = () => { if (!saving.current) { setDraft(value); setOpen(false); } };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) { event.preventDefault(); void commit(); }
  };
  if (!open) {
    return (
      <Tag className={['gk-inline', !value && 'gk-inline--empty', className].filter(Boolean).join(' ')} data-step={step}>
        <button type="button" className="gk-inline__open" aria-label={t('Edit {thing}', { thing: label })} onClick={() => setOpen(true)}>{value || placeholder}</button>
      </Tag>
    );
  }
  const common = { id, ref: field, value: draft, maxLength, placeholder, readOnly: busy, 'aria-busy': busy, 'aria-label': label, className: `gk-inline__field${multiline ? ' gk-inline__field--area' : ''}`, onBlur: () => void commit(), onKeyDown: onKey };
  return <Tag className={['gk-inline', 'gk-inline--open', className].filter(Boolean).join(' ')} data-step={step}>
    {multiline ? <textarea {...common} rows={3} onChange={event => setDraft(event.target.value)} /> : <input {...common} type="text" onChange={event => setDraft(event.target.value)} />}
    {failed && <span className="gk-inline__error" role="alert">{t('Not saved. Check your connection and try again.')}</span>}
  </Tag>;
}
