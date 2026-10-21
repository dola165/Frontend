import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink, X } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useDrawerPlace } from './drawerContext';
import './drawers.css';

/**
 * The frame of one thing, in a drawer or in the pane beside the list: its title, the way to the full page, and Close.
 * A thing fills it with its own body. A drawer moves focus to its Close, so the keyboard lands where the eye does; the
 * pane leaves focus in the list (the pane takes it itself when the keyboard opened it). In the pane, who is behind a
 * thing stacks over it with a way back.
 */
export function DrawerFrame({ title, page, children }: { title: string; /** The thing's full page. */ page?: { to: string; label: string }; children: ReactNode }) {
    const t = useWorldCopy();
    const { side, close, place, back } = useDrawerPlace();
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (place === 'drawer') closeRef.current?.focus({ preventScroll: true }); }, [place]);
    return (
        <section className="gk-drawer" data-side={place === 'drawer' ? side : undefined} data-place={place} aria-label={title}>
            <header className="gk-drawer__head">
                {back && <button type="button" className="gk-drawer__close gk-drawer__back" onClick={back} aria-label={t('Back')}><ChevronLeft aria-hidden="true" /></button>}
                <h2 className="gk-drawer__title">{title}</h2>
                {page && <Link className="gk-drawer__page" to={page.to}><ExternalLink aria-hidden="true" />{page.label}</Link>}
                <button ref={closeRef} type="button" className="gk-drawer__close" onClick={close} aria-label={t('Close {name}', { name: title })}><X aria-hidden="true" /></button>
            </header>
            <div className="gk-drawer__body">{children}</div>
        </section>
    );
}

/** A drawer's body while it loads: shaped like what comes. */
export function DrawerLoading() {
    return <div className="gk-drawer__loading" aria-hidden="true"><Skeleton height={64} width={64} /><Skeleton height={18} width="60%" /><Skeleton height={14} width="40%" /><Skeleton height={160} /></div>;
}
