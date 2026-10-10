import './design.css';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** Root of every redesigned surface: applies the `.gk` palette, type and scales. */
export function GkRoot({ className, light, ...rest }: ComponentPropsWithoutRef<'div'> & { light?: boolean }) {
    return <div className={cx('gk', light && 'gk-light', className)} {...rest} />;
}

/** Full-width page frame with the shared gutter; `profile` uses the narrower profile width. */
export function PageFrame({ width = 'wide', className, ...rest }: ComponentPropsWithoutRef<'div'> & { width?: 'wide' | 'profile' }) {
    return <div className={cx('gk-frame', width === 'profile' && 'gk-frame--profile', className)} {...rest} />;
}

export interface Crumb { label: string; to?: string }
export function PageHeader({ title, subtitle, crumbs, actions, className }: { title: ReactNode; subtitle?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; className?: string }) {
    return (
        <header className={cx('gk-page-header', className)}>
            <div className="gk-page-header__text">
                {crumbs && crumbs.length > 0 && (
                    <nav aria-label="Breadcrumb" className="gk-page-header__crumbs">
                        {crumbs.map((crumb, index) => (
                            <span key={`${crumb.label}-${index}`}>
                                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
                                {index < crumbs.length - 1 && <span aria-hidden="true"> /</span>}
                            </span>
                        ))}
                    </nav>
                )}
                <h1>{title}</h1>
                {subtitle && <p className="gk-page-header__subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="gk-page-header__actions">{actions}</div>}
        </header>
    );
}

/** A titled group of content. The title is plain sentence case; `action` is an optional link at the right. */
export function Section({ title, hint, action, children, className, id }: { title?: ReactNode; hint?: ReactNode; action?: { label: string; to: string } | ReactNode; children: ReactNode; className?: string; id?: string }) {
    const actionNode = action && typeof action === 'object' && 'to' in (action as object) && 'label' in (action as object)
        ? <Link className="gk-section__action" to={(action as { to: string }).to}>{(action as { label: string }).label}</Link>
        : action as ReactNode;
    return (
        <section className={cx('gk-section', className)} id={id} aria-labelledby={id && title ? `${id}-title` : undefined}>
            {(title || actionNode) && (
                <div className="gk-section__head">
                    <div className="gk-row" style={{ gap: 'var(--gk-2)', alignItems: 'baseline' }}>
                        {title && <h2 className="gk-section__title" id={id ? `${id}-title` : undefined}>{title}</h2>}
                        {hint && <span className="gk-section__hint">{hint}</span>}
                    </div>
                    {actionNode}
                </div>
            )}
            {children}
        </section>
    );
}

export function Panel({ title, action, footer, padded, flush, children, className, as: Tag = 'div' }: { title?: ReactNode; action?: ReactNode; footer?: ReactNode; padded?: boolean; flush?: boolean; children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'aside' }) {
    return (
        <Tag className={cx('gk-panel', flush && 'gk-panel--flush', className)}>
            {(title || action) && (
                <div className="gk-panel__head">
                    {title && <h3 className="gk-panel__title">{title}</h3>}
                    {action}
                </div>
            )}
            {padded ? <div className="gk-panel--pad">{children}</div> : children}
            {footer && <div className="gk-panel__foot">{footer}</div>}
        </Tag>
    );
}

export function List({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
    return <ul className={cx('gk-list', className)} aria-label={label}>{children}</ul>;
}

interface RowContent { lead?: ReactNode; title: ReactNode; meta?: ReactNode; trail?: ReactNode }
const RowBody = ({ lead, title, meta, trail }: RowContent) => (
    <>
        {lead && <span className="gk-list-row__lead">{lead}</span>}
        <span className="gk-list-row__main">
            <span className="gk-list-row__title">{title}</span>
            {meta && <span className="gk-list-row__meta">{meta}</span>}
        </span>
        {trail && <span className="gk-list-row__trail">{trail}</span>}
    </>
);
/** One line of a list: optional leading visual, title, one line of detail, trailing status. */
export function ListRow({ to, onClick, className, ...content }: RowContent & { to?: string; onClick?: () => void; className?: string }) {
    if (to) return <li><Link className={cx('gk-list-row', className)} to={to}><RowBody {...content} /></Link></li>;
    if (onClick) return <li><button type="button" className={cx('gk-list-row', className)} onClick={onClick}><RowBody {...content} /></button></li>;
    return <li><div className={cx('gk-list-row', className)}><RowBody {...content} /></div></li>;
}

export type FixtureTone = 'match' | 'training' | 'event' | 'trial';
/** The GrassKickZ fixture line: a time column in scoreboard numerals, then what, where and status. */
export function FixtureRow({ time, day, title, meta, trail, tone = 'event', to, onClick, label }: { time: ReactNode; day?: ReactNode; title: ReactNode; meta?: ReactNode; trail?: ReactNode; tone?: FixtureTone; to?: string; onClick?: () => void; label?: string }) {
    const when = <span className="gk-fixture__when"><span className="gk-fixture__time">{time}</span>{day && <span className="gk-fixture__day">{day}</span>}</span>;
    const main = <span className="gk-fixture__main"><span className="gk-fixture__title">{title}</span>{meta && <span className="gk-fixture__meta">{meta}</span>}</span>;
    const trailNode = trail && <span className="gk-fixture__trail">{trail}</span>;
    if (to) return <li><Link className="gk-fixture" data-tone={tone} to={to} aria-label={label}>{when}{main}{trailNode}</Link></li>;
    // With an action and its own trailing controls, only the time and title open the entry, so the controls stay separate buttons.
    if (onClick) return <li><div className="gk-fixture gk-fixture--action" data-tone={tone}><button type="button" className="gk-fixture__open" onClick={onClick} aria-label={label}>{when}{main}</button>{trailNode}</div></li>;
    return <li><div className="gk-fixture" data-tone={tone}>{when}{main}{trailNode}</div></li>;
}

export function StatTile({ label, value, hint, to, onClick, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; to?: string; onClick?: () => void; tone?: 'attention' | 'good' }) {
    const body = <><span className="gk-stat__label">{label}</span><span className="gk-stat__value">{value}</span>{hint && <span className="gk-stat__hint">{hint}</span>}</>;
    if (to) return <Link className="gk-stat" data-tone={tone} to={to}>{body}</Link>;
    if (onClick) return <button type="button" className="gk-stat" data-tone={tone} onClick={onClick}>{body}</button>;
    return <div className="gk-stat" data-tone={tone}>{body}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonClass = (variant: ButtonVariant, size: 'md' | 'sm', iconOnly: boolean, className?: string) =>
    cx('gk-btn', `gk-btn--${variant}`, size === 'sm' && 'gk-btn--sm', iconOnly && 'gk-btn--icon', className);
export function Button({ variant = 'secondary', size = 'md', iconOnly = false, className, type = 'button', ...rest }: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant; size?: 'md' | 'sm'; iconOnly?: boolean }) {
    return <button type={type} className={buttonClass(variant, size, iconOnly, className)} {...rest} />;
}
export function ButtonLink({ variant = 'secondary', size = 'md', iconOnly = false, className, ...rest }: LinkProps & { variant?: ButtonVariant; size?: 'md' | 'sm'; iconOnly?: boolean }) {
    return <Link className={buttonClass(variant, size, iconOnly, className)} {...rest} />;
}

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'info' | 'violet';
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
    return <span className={cx('gk-badge', tone !== 'neutral' && `gk-badge--${tone}`, className)}>{children}</span>;
}
/** A small count badge. `atLeast` marks a number that may be higher (some sources could not load). */
export function Count({ value, label, atLeast = false }: { value: number; label?: string; atLeast?: boolean }) {
    if (!value) return null;
    return <span className="gk-count" aria-label={label}>{value > 99 ? '99+' : atLeast ? `${value}+` : value}</span>;
}

const initials = (name?: string | null) => (name ?? '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?';
export function Avatar({ src, name, size = 36, square = false }: { src?: string | null; name?: string | null; size?: number; square?: boolean }) {
    return (
        <span className={cx('gk-avatar', square && 'gk-avatar--square')} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden={!name}>
            {src ? <img src={src} alt="" loading="lazy" /> : initials(name)}
        </span>
    );
}

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
    return (
        <div className="gk-field">
            <label className="gk-field__label" htmlFor={htmlFor}>{label}</label>
            {children}
            {error ? <span className="gk-field__error" role="alert">{error}</span> : hint && <span className="gk-field__hint">{hint}</span>}
        </div>
    );
}

export function SearchInput({ className, ...rest }: ComponentPropsWithoutRef<'input'>) {
    return <span className={cx('gk-search', className)}><SearchIcon aria-hidden="true" /><input type="search" className="gk-input" {...rest} /></span>;
}

export function Chip({ pressed, className, ...rest }: ComponentPropsWithoutRef<'button'> & { pressed?: boolean }) {
    return <button type="button" aria-pressed={pressed} className={cx('gk-chip', className)} {...rest} />;
}

/** An empty or unavailable state: say what is missing and offer the next step. */
export function EmptyNote({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
    return (
        <div className="gk-empty">
            <div className="gk-empty__text"><p className="gk-empty__title">{title}</p>{children && <p>{children}</p>}</div>
            {action}
        </div>
    );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
    return <span className="gk-skeleton" style={{ display: 'block', height, width }} aria-hidden="true" />;
}
