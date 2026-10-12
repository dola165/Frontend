import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { ButtonLink, EmptyNote, Panel } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { appLocale } from '../../../utils/formatting';
import { plural, useWorldCopy } from '../copy';
import { useWorldRole } from '../front/useOverviewLayout';
import { isReturn } from '../history';
import { pairBounds } from '../map/away';
import { reachBounds } from '../map/reach';
import { useWorldChild } from '../players';
import { BelowMapHead } from '../stage/BelowMap';
import { StagePanel, StageTop } from '../stage/WorldStage';
import { useStage, WIDE } from '../stage/stageContext';
import { useMediaQuery } from '../useMediaQuery';
import { ANYWHERE, useWorldArea } from '../useWorldArea';
import { useWorldSession } from '../worldSession';
import { BrowsePanel } from './BrowsePanel';
import { DirectoryResults } from './DirectoryResults';
import { ListSplit } from './ListSplit';
import { arrangeGroups } from './groups';
import { pinGroups } from './panelGroups';
import { MapExtrasContext, type MapExtras } from './mapExtras';
import { DirectorySelectionContext } from './selection';
import { useDirectoryData } from './useDirectoryData';
import { useDirectoryMap } from './useDirectoryMap';
import { usePlacedPoints } from './usePlacedPoints';
import { useDirectorySelection } from './useDirectorySelection';
import { CARRIED, SELECTED, type DirectoryState } from './useDirectoryState';
import { useRestoredScroll } from './useRestoredScroll';

const NO_PINS = new Map<string, string>();

/**
 * A tab's likely answer for who is looking, written once when it opens with no filters of its own (a link that
 * carries filters or a chosen result is never overridden). From then on they are ordinary chips, and Clear filters
 * removes them. Going Back or Forward to a list never writes them again: the person may have removed them there.
 */
function useRoleDefaults(state: DirectoryState, apply: boolean, signedIn: boolean) {
    const role = useWorldRole();
    const { child } = useWorldChild();
    const { membership } = useWorldSession();
    const { status } = useAuth();
    const [params] = useSearchParams();
    const navigation = useNavigationType();
    const done = useRef(false);
    // The role follows the person and their club; wait for both so the first defaults are the right ones.
    const settled = status !== 'bootstrapping' && (!signedIn || membership !== undefined);
    const write = useEffectEvent(() => {
        done.current = true;
        const { source, query } = state;
        const skip = !source.defaults || query.q || params.has(SELECTED) || source.filters.some(filter => !CARRIED.includes(filter.key) && !filter.nav && params.has(filter.key));
        const values = skip ? {} : source.defaults!({ role, child: Boolean(child), signedIn });
        // Writing them also names a tab chosen for who is looking.
        if (Object.keys(values).length || state.unnamed) state.setMany(values);
    });
    useEffect(() => {
        if (done.current) return;
        if (isReturn(navigation)) done.current = true;
        else if (apply && settled) write();
    }, [apply, settled, navigation]);
}

/**
 * One source's results under World's map. The map shows them as pins and, on a wide screen, lists them in its
 * "Browse area" panel with the count and the sort; folded or on a phone, the count and the sort sit above the results.
 * Under the map the tab's filters run across the page, and the results sit in one column the width of the Home feed,
 * with what is pressed beside it (`ListSplit`).
 */
export function DirectoryBody({ state, signedIn, applyDefaults, clearable, onClear, filters }: {
    state: DirectoryState; signedIn: boolean; /** Write this tab's defaults for who is looking. */ applyDefaults: boolean;
    clearable: boolean; onClear: () => void; /** The tab's filters, in a strip across the page under the map. */ filters?: ReactNode;
}) {
    const t = useWorldCopy();
    const { source, query } = state;
    const { status: authStatus } = useAuth();
    const location = useLocation();
    const sortId = useId();
    const gated = Boolean(source.signInReason) && !signedIn;
    useRoleDefaults(state, applyDefaults && !gated, signedIn);
    const loaded = useDirectoryData(source, query, gated, { pages: state.shown, onPages: state.setShown });
    // Grouped lists show their results in their groups' order, in the panel, on the map and below it alike.
    const groups = useMemo(() => source.groups ? arrangeGroups(loaded.items, item => source.groups!.of(item, query), source.groups.rest,
        { always: source.groups.always, describe: source.groups.describe }) : undefined, [source, loaded.items, query]);
    const items = useMemo(() => groups ? groups.flatMap(group => group.items) : loaded.items, [groups, loaded.items]);
    const data = { ...loaded, items };
    const { setCity } = useWorldArea();
    // Scroll returns once the results (with every page that was shown) are back, or cannot come back.
    useRestoredScroll((gated && authStatus !== 'bootstrapping') || (!data.loading && (data.items.length > 0 || Boolean(data.error || data.notice))));
    const stage = useStage();
    const wide = useMediaQuery(WIDE, true);
    const browse = stage.inStage && stage.mapOpen && wide && !gated;
    const listRef = useRef<HTMLDivElement>(null);
    const { remember } = useWorldChild();
    const session = useWorldSession();
    const [, setParams] = useSearchParams();
    const [extras, setExtras] = useState<MapExtras>({});
    /** Search for anyone: the child chosen in the World bar no longer narrows the list. */
    const clearFor = () => {
        remember.write('');
        setParams(current => { const next = new URLSearchParams(current); next.delete('player'); return next; }, { replace: true, preventScrollReset: true });
    };

    const filtered = clearable || state.activeFilters.length > 0;
    const nouns: [string, string] = [source.noun[0], source.noun[1]];
    const counted = (n: number) => {
        const things = plural(n, ...nouns);
        // A list the area only orders (nearest first) is not "near" anywhere: it holds everyone.
        return !data.area || source.area === 'nearest' || source.area === 'partly' ? things : data.area.city ? t('{count} near {city}', { count: things, city: data.area.city }) : t('{count} anywhere', { count: things });
    };
    // An unknown total is never guessed: the count says what is shown, with "+" while more remain.
    const count = gated ? '' : data.loading ? t('Searching {things}…', { things: t(nouns[1]) }) : data.error || data.notice ? ''
        : data.total != null ? counted(data.total) : data.hasMore ? t('{count}+ found', { count: data.items.length }) : data.items.length ? counted(data.items.length) : '';
    const searched = query.q && count && !data.loading ? ` · “${query.q}”` : '';
    // A live list says when it last looked ("checked 22:24"), so a quiet list is not mistaken for a stale one.
    const live = typeof source.refreshMs === 'function' ? source.refreshMs(query) : source.refreshMs;
    const checked = live && data.checkedAt && count && !data.loading ? ` · ${t('checked {time}', { time: new Date(data.checkedAt).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit', hour12: false }) })}` : '';
    const mappable = Boolean(source.place) && (source.mapped?.(query) ?? true) && !gated;
    const placed = usePlacedPoints(source, data.items, mappable && stage.mapOpen);
    // The Browse area groups by where (each ground a pin) when the source asks, else by the list's own groups, leaving
    // out empty ones (an empty lane is the list's business).
    const panelGroups = useMemo(() => source.panel === 'pin' ? (mappable ? pinGroups(data.items, source.key, placed, source.where) : undefined)
        : source.panel ? arrangeGroups(data.items, source.panel) : groups?.filter(group => group.items.length > 0),
        [source, mappable, data.items, placed, groups]);
    const choice = useDirectorySelection({ state, keys: data.items.map(source.key), placed, panel: browse && !stage.panelFolded ? stage.panel : null, list: listRef });
    const chosenItem = choice.chosen ? data.items.find(item => source.key(item) === choice.chosen) : undefined;
    const reach = chosenItem && mappable ? source.reach?.(chosenItem) ?? undefined : undefined;
    // The chosen match's away day, from where the travelling side (or the viewer's club) comes; that place shows too.
    const viewerClub = session.membership?.clubId ? Number(session.membership.clubId) : null;
    const away = chosenItem && mappable ? source.away?.(chosenItem, placed.places, { clubId: viewerClub }) ?? undefined : undefined;
    const context = away ? [...(extras.context ?? []), { id: 'away:from', lat: away.from.lat, lng: away.from.lng, label: away.from.name ?? '', tone: 'club' as const }] : extras.context;
    // The map's own card shows a pin unless a Browse row already shows its one chosen result (with its Open link).
    useDirectoryMap({ source, query, data, gated, mappable, placed, choice, open: stage.mapOpen, panel: browse, summary: count, card: !browse || stage.panelFolded || !choice.chosen,
        context, reach, away, bounds: reach ? reachBounds(reach, extras.context) : away ? pairBounds(away) : undefined, insetTop: source.Top && browse ? 72 : undefined });
    const sortable = source.sorts && source.sorts.length > 1 && (!source.sortable || source.sortable(query));
    const sort = sortable && (
        <label className="gk-world-toolbar__sort" htmlFor={sortId}>
            <span className="gk-faint">{t('Sort')}</span>
            <select id={sortId} className="gk-input" value={query.sort} onChange={event => state.setSort(event.target.value)}>
                {source.sorts!.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
        </label>
    );
    const { Tools, HeadTools, Top } = source;

    // Under the map, the list starts with its name (or where it is, a day), its count and its options (the sort, when
    // the Browse area over the map does not already offer it).
    const title = source.heading?.(query) ?? t(source.label);
    const head = (
        <BelowMapHead icon={source.icon} title={title} nav={HeadTools && <HeadTools query={query} go={state.go} />}
            hint={browse ? count + searched + checked : <><span role="status">{count}{searched}</span>{checked}</>}>
            {!browse && sort}
        </BelowMapHead>
    );

    if (gated) return <ListSplit>
        <BelowMapHead icon={source.icon} title={title} />
        <Panel>
            <EmptyNote title={t('Sign in to see {things}', { things: t(source.label).toLowerCase() })}
                action={<ButtonLink variant="primary" size="sm" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>}>
                {t(source.signInReason!)}
            </EmptyNote>
        </Panel>
    </ListSplit>;

    return (
        <MapExtrasContext.Provider value={setExtras}>
            <DirectorySelectionContext.Provider value={stage.mapOpen ? { pinOf: mappable ? placed.pinOf : NO_PINS, selectedPin: choice.selectedPin, hoverPin: choice.hoverPin,
                hover: choice.setHoverKey, chosen: choice.chosen, choose: choice.choose, clear: choice.clear, selectPin: choice.selectPin, mappable, placing: placed.loading, incomplete: placed.incomplete } : null}>
                {browse && <StagePanel><BrowsePanel source={source} data={data} groups={panelGroups} places={placed.places} count={count + searched} tools={sort} folded={stage.panelFolded} onToggle={stage.togglePanel} /></StagePanel>}
                {filters && <div className="gk-world-filterbar">{filters}</div>}
                <ListSplit>
                    {Top && <StageTop><Top query={query} go={state.go} /></StageTop>}
                    {head}
                    {Tools && <Tools query={query} go={state.go} refresh={data.retry} />}
                    <div ref={listRef}>
                        <DirectoryResults source={source} data={data} groups={groups} filtered={filtered} onClear={clearable ? onClear : undefined} go={state.go} query={query}
                            onWiden={data.area?.city && source.area === true ? () => setCity(ANYWHERE) : undefined} onClearFor={source.forWhom ? clearFor : undefined} />
                    </div>
                </ListSplit>
            </DirectorySelectionContext.Provider>
        </MapExtrasContext.Provider>
    );
}
