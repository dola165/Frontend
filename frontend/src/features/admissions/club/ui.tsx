import { cloneElement, isValidElement, useId, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';

export function AdmissionPanel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="admission-panel"><header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header><div className="admission-panel-body">{children}</div></section>;
}

export function AdmissionField({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const control=isValidElement<{id?:string;'aria-labelledby'?:string;'aria-describedby'?:string}>(children)?cloneElement(children,{id:children.props.id??id,'aria-labelledby':`${id}-label`,'aria-describedby':hint?`${id}-hint`:undefined}):children;
  return <label htmlFor={isValidElement<{id?:string}>(children)?children.props.id??id:id} className={`admission-field${wide ? ' admission-field-wide' : ''}`}><span id={`${id}-label`}>{label}</span>{control}{hint && <small id={`${id}-hint`}>{hint}</small>}</label>;
}

export function AdmissionEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="admission-empty"><CheckCircle2 size={24} aria-hidden="true"/><strong>{title}</strong>{hint && <p>{hint}</p>}{action}</div>;
}

export function AdmissionError({ message, onRetry, retry }: { message: string; onRetry?: () => void; retry: string }) {
  return <div className="admission-error" role="alert"><p>{message}</p>{onRetry && <button type="button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>{retry}</button>}</div>;
}

export function AdmissionPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'attention' }) {
  return <span className={`admission-pill admission-pill-${tone}`}>{children}</span>;
}

export function AdmissionDate({ value, locale, timezone, label }: { value: string | null | undefined; locale: string; timezone?: string; label?: string }) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>{value}</span>;
  return <span className="admission-deadline"><Clock3 size={14} aria-hidden="true"/>{label && `${label} · `}<time dateTime={value}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(value.includes('T') ? { timeStyle: 'short', timeZone: timezone } : { timeZone: 'UTC' }) }).format(date)}</time>{timezone && value.includes('T') && <small>{timezone}</small>}</span>;
}

export function AdmissionLinkButton({ onClick, children, back = false }: { onClick: () => void; children: ReactNode; back?: boolean }) {
  return <button type="button" className="admission-text-button" onClick={onClick}>{back && <ArrowLeft size={16} aria-hidden="true"/>}{children}{!back && <ArrowRight size={16} aria-hidden="true"/>}</button>;
}

export function AdmissionSessionHeading({ title, children }: { title: string; children: ReactNode }) {
  return <div className="admission-session-heading"><CalendarDays size={20} aria-hidden="true"/><div><strong>{title}</strong>{children}</div></div>;
}
