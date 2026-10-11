import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useDrawerPlace } from './drawerContext';
import './drawers.css';

/**
 * The frame of one drawer: its title, the way to the full page, and Close. A thing fills it with its own body.
 * Opening it moves focus to its Close, so the keyboard lands where the eye does.
 */
export function DrawerFrame({ title, page, children }: { title: string; /** The thing's full page. */ page?: { to: string; label: string }; children: ReactNode }) {
    const t = useWorldCopy();
    const { side, close } = useDrawerPlace();
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
    return (
        <section className="gk-drawer" data-side={side} aria-label={title}>
            <header className="gk-drawer__head">
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
