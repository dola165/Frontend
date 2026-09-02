import { useEffect, useRef } from 'react';
import { ArrowUpRight, Building2, MapPin, ShieldCheck, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

export interface VisibleClubListItem {
    key: string;
    clubId: number;
    name: string;
    logoUrl?: string | null;
    typeLabel?: string | null;
    city?: string | null;
    country?: string | null;
    address?: string | null;
    official: boolean;
    memberCount: number;
    distanceKm?: number | null;
    ageGroups: string[];
    level?: string | null;
}

interface VisibleClubsRailProps {
    isVisible: boolean;
    clubs: VisibleClubListItem[];
    selectedKey: string | null;
    loading: boolean;
    clubsEnabled: boolean;
    radiusKm: number;
    onSelect: (key: string) => void;
    onClose: () => void;
}

const initialsFor = (name: string) => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase();

export const VisibleClubsRail = ({
    isVisible,
    clubs,
    selectedKey,
    loading,
    clubsEnabled,
    radiusKm,
    onSelect,
    onClose
}: VisibleClubsRailProps) => {
    const scrollBodyRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!selectedKey || !isVisible) return;
        const selectedCard = scrollBodyRef.current?.querySelector<HTMLElement>(`[data-club-key="${CSS.escape(selectedKey)}"]`);
        selectedCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [isVisible, selectedKey]);

    return (
        <>
            <div
                className={`map-modal-backdrop fixed inset-x-0 bottom-0 top-[var(--app-active-header-height)] z-[1070] bg-slate-950/25 backdrop-blur-[1px] transition-opacity ${isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
                onClick={onClose}
            />
            <aside
                aria-label="Clubs visible on the map"
                data-visible={isVisible}
                className={`map-club-rail pointer-events-auto fixed bottom-0 right-0 top-[var(--app-active-header-height)] z-[1090] flex w-[min(94vw,360px)] flex-col border-l border-[var(--map-panel-border)] bg-[var(--map-panel-bg)] shadow-[var(--map-shadow-strong)] transition-transform duration-200 ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <header className="shrink-0 border-b border-[var(--map-panel-border)] px-5 pb-4 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                                <Building2 className="h-4 w-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.18em]">Browse the area</p>
                            </div>
                            <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">Visible clubs</h2>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                                {clubsEnabled ? `${clubs.length} club${clubs.length === 1 ? '' : 's'} within ${radiusKm} km` : 'Clubs are hidden by the current map filter.'}
                            </p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close visible clubs" className="map-icon-button h-8 w-8 shrink-0">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <p className="mt-3 border-l-2 border-[var(--accent-primary)] pl-3 text-[11px] leading-4 text-[var(--text-secondary)]">
                        Choose a club to spotlight its pin. Use “View club” when you are ready to leave the map.
                    </p>
                </header>

                <div ref={scrollBodyRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
                    {loading && clubs.length === 0 ? (
                        <div className="px-5 py-8 text-sm text-[var(--text-secondary)]">Finding clubs in this area…</div>
                    ) : !clubsEnabled ? (
                        <div className="px-5 py-8">
                            <p className="text-sm font-bold text-[var(--text-primary)]">Clubs are not selected</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Turn on Clubs in the filter to show the local club list and its pins.</p>
                        </div>
                    ) : clubs.length === 0 ? (
                        <div className="px-5 py-8">
                            <p className="text-sm font-bold text-[var(--text-primary)]">No clubs in this search</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Try a wider radius or remove one location or club filter.</p>
                        </div>
                    ) : (
                        <ol>
                            {clubs.map((club, index) => {
                                const selected = club.key === selectedKey;
                                const logoUrl = resolveMediaUrl(club.logoUrl);
                                const location = [club.city, club.country].filter(Boolean).join(', ') || club.address || 'Location available on map';
                                const badges = [...club.ageGroups.slice(0, 2), ...(club.level ? [club.level] : [])];
                                return (
                                    <li
                                        key={club.key}
                                        data-club-key={club.key}
                                        className={`map-club-row ${selected ? 'map-club-row--selected' : ''}`}
                                    >
                                        <button type="button" onClick={() => onSelect(club.key)} className="block w-full px-5 py-4 text-left">
                                            <div className="flex items-start gap-3">
                                                <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border text-xs font-black ${selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : 'border-[var(--map-panel-border)] bg-[var(--map-card-muted)] text-[var(--text-secondary)]'}`}>
                                                    {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : initialsFor(club.name)}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-start justify-between gap-2">
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-black text-[var(--text-primary)]">{club.name}</span>
                                                            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{club.typeLabel || 'Football club'}</span>
                                                        </span>
                                                        <span className="text-[10px] font-black text-[var(--text-muted)]">{String(index + 1).padStart(2, '0')}</span>
                                                    </span>
                                                    <span className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                                                        <span className="truncate">{location}</span>
                                                    </span>
                                                </span>
                                            </div>
                                            <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                                                {club.official && <span className="flex items-center gap-1 text-[var(--accent-primary)]"><ShieldCheck className="h-3.5 w-3.5" />Verified</span>}
                                                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{club.memberCount} members</span>
                                                {club.distanceKm != null && <span>{club.distanceKm.toFixed(club.distanceKm < 10 ? 1 : 0)} km away</span>}
                                            </span>
                                            {badges.length > 0 && (
                                                <span className="mt-3 flex flex-wrap gap-1.5">
                                                    {badges.map((badge) => <span key={badge} className="map-club-tag">{badge}</span>)}
                                                </span>
                                            )}
                                        </button>
                                        <Link to={`/clubs/${club.clubId}`} className="map-club-profile-link">
                                            View club <ArrowUpRight className="h-3.5 w-3.5" />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </aside>
        </>
    );
};
