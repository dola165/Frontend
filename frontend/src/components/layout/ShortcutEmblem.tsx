import type { ReactNode } from 'react';

export type ShortcutKind = 'dola' | 'family' | 'squads' | 'club' | 'venues' | 'organization' | 'referee' | 'agent' | 'schedule' | 'following' | 'clubs' | 'map';
const art: Record<ShortcutKind, ReactNode> = {
    dola: <><path fill="#065f46" d="M20 1 36 10v20L20 39 4 30V10Z"/><path fill="#00e695" d="m20 6 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/><path fill="#d1fae5" d="m31 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></>,
    family: <><path fill="#fb7185" d="M20 35 5 21C-4 11 10 1 20 12 30 1 44 11 35 21Z"/><circle cx="15" cy="18" r="4" fill="#fff1f2"/><circle cx="26" cy="23" r="3" fill="#ffe4a3"/><path d="M7 29c0-9 16-9 16 0v3H7Z" fill="#fff1f2"/><path d="M21 33c0-8 12-8 12 0Z" fill="#ffe4a3"/></>,
    squads: <><circle cx="12" cy="12" r="6" fill="#60a5fa"/><circle cx="28" cy="12" r="6" fill="#6ee7b7"/><path d="M1 32v-5c0-11 22-11 22 0v5Z" fill="#2481e8"/><path d="M18 32v-5c0-11 21-11 21 0v5Z" fill="#10b981"/><circle cx="22" cy="30" r="9" fill="#ecfdf5" stroke="#047857"/><path d="m22 24 5 4-2 6h-6l-2-6Z" fill="#047857"/></>,
    club: <><path d="M20 2 36 8v13c0 9-16 17-16 17S4 30 4 21V8Z" fill="#10b981"/><path d="M20 7 31 11v10c0 6-11 12-11 12Z" fill="#065f46"/><path d="m20 11 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" fill="#ecfdf5"/></>,
    venues: <><path d="m2 12 18-8 18 8v22H2Z" fill="#38bdf8"/><path d="M5 15h30v20H5Z" fill="#059669"/><path d="M8 18h24v14H8Zm12 0v14M8 21h4v8H8m24-8h-4v8h4" fill="none" stroke="#d1fae5" strokeWidth="1.6"/><circle cx="20" cy="25" r="4" fill="none" stroke="#d1fae5"/><path d="M3 5v9m34-9v9M0 5h7m26 0h7" stroke="#bae6fd" strokeWidth="3"/></>,
    organization: <><path d="M5 14h30v22H5Z" fill="#818cf8"/><path d="m2 14 18-12 18 12Z" fill="#c4b5fd"/><path d="M11 19v12m9-12v12m9-12v12" stroke="#ede9fe" strokeWidth="4"/><path d="M2 36h36" stroke="#6366f1" strokeWidth="4"/></>,
    referee: <><path d="m6 12 9-7 5 7 17-4v9l-11 4c-1 14-22 17-23 2-1-5 0-8 3-11Z" fill="#fb923c"/><circle cx="14" cy="23" r="6" fill="#7c2d12"/><path d="m23 12 8-2v5l-8 2Z" fill="#ffedd5"/><path d="m5 6-3-3m15 0V0" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/></>,
    agent: <><path d="M13 10V5h14v5" fill="none" stroke="#eab308" strokeWidth="4"/><rect x="2" y="10" width="36" height="26" rx="5" fill="#b7791f"/><path d="M2 12q18 16 36 0v10H2Z" fill="#fbbf24"/><rect x="17" y="19" width="6" height="8" rx="2" fill="#fef3c7"/></>,
    schedule: <><rect x="4" y="5" width="32" height="32" rx="6" fill="#60a5fa"/><path d="M4 16h32v15a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6Z" fill="#eff6ff"/><path d="M12 3v8m16-8v8" stroke="#2563eb" strokeWidth="4" strokeLinecap="round"/><path d="m13 26 5 4 10-10" fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    following: <><circle cx="27" cy="12" r="6" fill="#67e8f9"/><path d="M17 33v-7c0-10 22-10 22 0v7Z" fill="#0891b2"/><circle cx="13" cy="12" r="7" fill="#c4b5fd"/><path d="M1 35v-8c0-12 24-12 24 0v8Z" fill="#8b5cf6"/></>,
    clubs: <><path d="m25 3 13 5v12c0 8-13 14-13 14S12 28 12 20V8Z" fill="#6ee7b7"/><path d="m15 9 13 5v12c0 8-13 13-13 13S2 34 2 26V14Z" fill="#059669"/><path d="m15 18 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z" fill="#d1fae5"/></>,
    map: <><path d="m2 13 12-4 12 5 12-4v25l-12 4-12-5-12 4Z" fill="#67e8f9"/><path d="M14 9v25l12 5V14Z" fill="#0891b2"/><path d="M29 11c0 6-9 14-9 14s-9-8-9-14a9 9 0 1 1 18 0Z" fill="#fb7185"/><circle cx="20" cy="10" r="4" fill="#fff1f2"/></>,
};
export function ShortcutEmblem({ kind }: { kind: ShortcutKind }) {
    return <span className={`home-shortcut-emblem home-shortcut-emblem--${kind}`}><svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">{art[kind]}</svg></span>;
}
