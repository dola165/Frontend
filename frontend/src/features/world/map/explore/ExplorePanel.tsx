import { Crosshair, ListCollapse, ListTree, Route, X } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, Skeleton } from '../../../../design/primitives';
import { MapPanel } from '../sheet/MapPanel';
import { FiltersPanel } from './FiltersPanel';
import { PlaceDetail } from './PlaceDetail';
import { ResultsList } from './ResultsList';
import { SearchBar } from './SearchBar';
import { WalkPanel } from './WalkPanel';
import type { LayerId } from './exploreQuery';
import type { PlaceRecord } from './records';
import type { Explore } from './useExplore';
import { plural, useWorldCopy } from '../../copy';
import './explore.css';

/** The explore side of the map: search, results, filters, the selected place and walking directions. */
export function ExplorePanel({ explore, phone, allowed, planHref, onSave, embedded = false }: {
    explore: Explore; phone: boolean; allowed: LayerId[]; planHref?: string; onSave?: (record: PlaceRecord) => void; embedded?: boolean;
}) {
    const t = useWorldCopy();
    const { query, discovery, selected, walking } = explore;
    const filtersOpen = explore.surface === 'filters';
    const search = (
        <SearchBar query={query} records={discovery.records} allowed={allowed} filtersOpen={filtersOpen} compact={phone || embedded}
            onFilters={() => { explore.setSurface(filtersOpen ? 'results' : 'filters'); explore.setCollapsed(false); if (phone) explore.setSnap('full'); }}
            onPick={record => explore.open(record)} onArea={explore.goTo} />
    );
    let body;
    if (explore.surface === 'walk') body = <WalkPanel walking={walking} onBack={walking.stop} />;
    else if (explore.surface === 'filters') body = <FiltersPanel query={query} signedIn={explore.signedIn} applicant={explore.applicant} hasOrigin={Boolean(walking.origin)} onLocate={explore.locate} onDone={() => explore.setSurface(explore.placeKey ? 'place' : 'results')} />;
    else if (explore.surface === 'place' && selected) body = (
        <PlaceDetail record={selected} signedIn={explore.signedIn} offerTo={explore.offerTo} playerId={explore.applicant.player?.id}
            onBack={explore.close}
            onWalk={() => selected.latitude != null && selected.longitude != null && walking.start({ key: selected.key, title: selected.title, latitude: selected.latitude, longitude: selected.longitude })}
            onSave={onSave && (() => onSave(selected))} />
    );
    else if (explore.surface === 'place') body = explore.venue.error
        ? <EmptyNote title={t('This venue cannot be shown')} action={<Button size="sm" onClick={explore.venue.retry}>{t('Try again')}</Button>}>{explore.venue.error}</EmptyNote>
        : discovery.loading || explore.venue.loading
            ? <div className="gk-map-place" role="status" aria-label={t('Opening the place')}><Skeleton height={52} width={52} /><Skeleton height={20} width="60%" /><Skeleton height={14} width="80%" /></div>
            : <EmptyNote title={t('This place is not in the current results')} action={<Button size="sm" onClick={explore.close}>{t('Back to results')}</Button>}>{t('It may be outside the searched area or hidden by a filter.')}</EmptyNote>;
    else body = <ResultsList query={query} discovery={discovery} coverage={explore.coverage} selectedKey={explore.placeKey} returnKey={explore.closedKey} onSelect={record => explore.open(record)} onHover={explore.setHovered} onWiden={explore.widen} />;

    const summary = discovery.loading ? t('Searching…') : `${plural(discovery.records.length, 'place')} · ${explore.coverage}`;
    return (
        <>
            {phone && <div className="gk-map-topbar">{search}</div>}
            <MapPanel label={explore.surface === 'place' ? t('Selected place') : t('Places')} variant="floating" snap={explore.snap} onSnap={explore.setSnap} collapsed={explore.collapsed}
                header={phone
                    ? <div className="gk-map-sheet-summary"><p role="status">{summary}</p>{planHref && <ButtonLink size="sm" variant="ghost" to={planHref}><Route aria-hidden="true" />{t('Journeys')}</ButtonLink>}</div>
                    : <>{search}
                        <div className="gk-map-panel-tools">
                            <Button size="sm" variant="ghost" aria-expanded={!explore.collapsed} onClick={() => explore.setCollapsed(!explore.collapsed)}>
                                {explore.collapsed ? <ListTree aria-hidden="true" /> : <ListCollapse aria-hidden="true" />}{explore.collapsed ? `${t('Show list')} · ${summary}` : t('Hide list')}
                            </Button>
                            {planHref && <ButtonLink size="sm" variant="ghost" to={planHref}><Route aria-hidden="true" />{t('Plan a journey')}</ButtonLink>}
                        </div></>}>
                {body}
            </MapPanel>
            {explore.moved && query.coverage.kind === 'area' && !walking.picking && (
                <div className="gk-map-float gk-map-float--top"><Button onClick={() => explore.searchArea()}><Crosshair aria-hidden="true" />{t('Search this area')}</Button></div>
            )}
            {walking.picking && (
                <div className="gk-map-float gk-map-float--top gk-map-hint" role="status"><Crosshair aria-hidden="true" />{t('Click the map where your walk begins')}<Button size="sm" variant="ghost" iconOnly aria-label={t('Cancel choosing a start')} onClick={walking.cancelPicking}><X aria-hidden="true" /></Button></div>
            )}
        </>
    );
}
