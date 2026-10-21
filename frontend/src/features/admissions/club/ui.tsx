import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { Badge, Button, EmptyNote } from '../../../design/primitives';

/**
 * Building blocks of the club's joining workspace, on the design system: a titled panel, a labelled field,
 * empty and error states, status badges, dates and quiet links. Every joining screen uses these, so the
 * whole flow shares one look.
 */
export function AdmissionPanel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="gk-panel adm-panel">
    <header className="gk-panel__head adm-panel__head"><div className="adm-panel__titles"><h2 className="gk-panel__title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
    <div className="adm-panel__body">{children}</div>
  </section>;
}

export function AdmissionField({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  type Control = { id?: string; type?: string; className?: string; 'aria-labelledby'?: string; 'aria-describedby'?: string };
  // Text inputs, selects and text areas take the design-system input look; checkboxes keep their own.
  const styled = (element: ReactElement<Control>) => ['input', 'select', 'textarea'].includes(String(element.type)) && !['checkbox', 'radio'].includes(element.props.type ?? '');
  const control = isValidElement<Control>(children)
    ? cloneElement(children, { id: children.props.id ?? id, className: [children.props.className, styled(children) && 'gk-input'].filter(Boolean).join(' ') || undefined, 'aria-labelledby': `${id}-label`, 'aria-describedby': hint ? `${id}-hint` : undefined })
    : children;
  return <label htmlFor={isValidElement<{ id?: string }>(children) ? children.props.id ?? id : id} className={`gk-field admission-field${wide ? ' admission-field-wide' : ''}`}>
    <span id={`${id}-label`} className="gk-field__label">{label}</span>{control}{hint && <small id={`${id}-hint`} className="gk-field__hint">{hint}</small>}
  </label>;
}

export function AdmissionEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <EmptyNote title={title} action={action}>{hint}</EmptyNote>;
}

export function AdmissionError({ message, onRetry, retry }: { message: string; onRetry?: () => void; retry: string }) {
  return <div className="gk-notice gk-notice--danger adm-error" role="alert"><span className="adm-error__text">{message}</span>{onRetry && <Button size="sm" onClick={onRetry}>{retry}</Button>}</div>;
}

const tones = { neutral: 'neutral', good: 'accent', attention: 'warning' } as const;
export function AdmissionPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'attention' }) {
  return <Badge tone={tones[tone]}>{children}</Badge>;
}

export function AdmissionDate({ value, locale, timezone, label }: { value: string | null | undefined; locale: string; timezone?: string; label?: string }) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>{value}</span>;
  return <span className="admission-deadline"><Clock3 aria-hidden="true" />{label && `${label} · `}<time dateTime={value}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(value.includes('T') ? { timeStyle: 'short', timeZone: timezone } : { timeZone: 'UTC' }) }).format(date)}</time>{timezone && value.includes('T') && <small>{timezone}</small>}</span>;
}

export function AdmissionLinkButton({ onClick, children, back = false }: { onClick: () => void; children: ReactNode; back?: boolean }) {
  return <button type="button" className="admission-text-button" onClick={onClick}>{back && <ArrowLeft aria-hidden="true" />}{children}{!back && <ArrowRight aria-hidden="true" />}</button>;
}

export function AdmissionSessionHeading({ title, children }: { title: string; children: ReactNode }) {
  return <div className="admission-session-heading"><CalendarDays aria-hidden="true" /><div><strong>{title}</strong>{children}</div></div>;
}
