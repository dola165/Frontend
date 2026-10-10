import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BrandMark } from '../BrandMark';

interface HeaderTabProps { to: string; label: string; icon: LucideIcon; current: boolean; pin?: boolean }

/** A primary tab or a pin: an icon and a readable label, with the accent underline when it is the current place. */
export function HeaderTab({ to, label, icon: Icon, current, pin = false }: HeaderTabProps) {
    return (
        <Link to={to} className={pin ? 'gk-htab gk-htab--pin' : 'gk-htab'} aria-current={current ? 'page' : undefined} title={pin ? label : undefined}>
            <span className="gk-htab__body"><Icon aria-hidden="true" strokeWidth={current ? 2.1 : 1.8} /><span className="gk-htab__label">{label}</span></span>
        </Link>
    );
}

export function HeaderBrand({ to }: { to: string }) {
    return (
        <Link to={to} className="gk-header__brand" aria-label="GrassKickZ, home">
            <BrandMark /><span className="gk-header__brand-name" aria-hidden="true">GrassKickZ</span>
        </Link>
    );
}
