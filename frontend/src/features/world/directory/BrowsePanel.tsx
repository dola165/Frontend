import { Fragment, useContext, useId, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Compass, MapPin, Star } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { peekClick, usePeek } from '../peek/usePeek';
import type { ArrangedGroup, ResultGroup } from './groups';
import { DirectoryItemKey, DirectorySelectionContext, useBrowseChoice } from './selection';
import type { Places } from './places';
import type { AnySource, BrowseLine, LineSide } from './types';
import type { DirectoryData } from './useDirectoryData';
import '../scoreboard/scoreboard.css';
import './browse.css';

/**
 * One result in the panel. Pressing it chooses it: the map flies to its pin, the row turns more opaque and its
 * detail gives way to one action ("Open club"). Pointing at the row lights its pin, and the other way round.
 */
function BrowseRow({ line, picture }: { line: BrowseLine; /** A bigger crest, the row's picture. */ picture?: boolean }) {
    const t = useWorldCopy();
    const choice = useBrowseChoice();
    const peek = usePeek();
    const chosen = Boolean(choice?.chosen);
    const open = chosen && line.to && line.action;
    const hover = choice && {
        onMouseEnter: () => choice.hover(true), onMouseLeave: () => choice.hover(false),
        onFocus: () => choice.hover(true), onBlur: () => choice.hover(false),
    };
    // Chosen, the line keeps only its title: the action takes the detail's place. A result with no place says so
    // once the places are known.
    const where = chosen && choice?.mappable && !choice.placed && !choice.placing ? <small>{choice.incomplete ? t('Could not be placed') : t('Not on the map')}</small> : null;
    return (
        <li className="gk-browse__item" data-chosen={chosen || undefined}>
            <button type="button" className="gk-sb__row gk-sb__row--line gk-browse__row" data-when={line.when ? true : undefined}
                aria-current={chosen || undefined} data-at-pin={choice?.atPin || undefined} data-highlighted={choice?.highlighted || undefined}
                onClick={choice?.choose} {...hover}>
                {line.when && <span className="gk-sb__when"><b>{line.when.time}</b>{line.when.day && <small>{line.when.day}</small>}</span>}
                {line.sides ? <Sides sides={line.sides} title={line.title} />
                    : <>{line.crest && <Crest src={line.crest.src} name={line.crest.name} size={picture ? 44 : 28} round={line.crest.round} />}
                        <span className="gk-sb__main"><strong title={line.title}>{line.title}</strong>{chosen ? where : line.detail && <small>{line.detail}</small>}</span></>}
                {line.sides && chosen && where}
                {!chosen && line.fact && <span className="gk-sb__fact" data-tone={line.factTone}>{line.fact}</span>}
            </button>
            {open && <Link className="gk-browse__open" to={line.to!} title={line.action} aria-label={t('{action}: {name}', { action: line.action!, name: line.title })}
                onClick={peekClick(line.peek, peek.open)}>
                <span>{line.action}</span><ArrowRight aria-hidden="true" />
            </Link>}
        </li>
    );
}

/** A match's two sides stacked, as on a score line, with the score when it counts. */
function Sides({ sides, title }: { sides: { home: LineSide; away: LineSide }; title: string }) {
    const t = useWorldCopy();
    const side = (one: LineSide) => <span className="gk-sb__team" data-mine={one.mine || undefined}>
        <Crest src={one.crest} name={one.name} size={18} round />{one.mine && <Star className="gk-sb__mine" role="img" aria-label={t('Your team')} />}<span>{one.name}</span>
        {one.score != null && <b className="gk-browse__score">{one.score}</b>}
    </span>;
    return <span className="gk-sb__teams gk-browse__sides" title={title}>{side(sides.home)}{side(sides.away)}</span>;
}

/** A group's header: its crest or place, its name, how many and when. When its results share a pin, pressing it chooses the pin. */
function GroupHeader({ group, count }: { group: ResultGroup; count: number }) {
    const t = useWorldCopy();
    const selection = useContext(DirectorySelectionContext);
    const pin = group.pin && selection?.pinOf && [...selection.pinOf.values()].includes(group.pin) ? group.pin : undefined;
    const face = group.crest ? <Crest src={group.crest.src} name={group.crest.name} size={20} round={group.crest.round} /> : group.pin ? <MapPin aria-hidden="true" /> : null;
    const content = <>{face}<span className="gk-browse__group-name">{t(group.label)}</span>{group.detail && <span className="gk-browse__group-detail">{group.detail}</span>}<span className="gk-browse__group-count">{count}</span></>;
    return (
        <li className="gk-browse__group" role="presentation">
            {pin && selection?.selectPin
                ? <button type="button" className="gk-browse__group-head" aria-pressed={selection.selectedPin === pin} onClick={() => selection.selectPin!(selection.selectedPin === pin ? undefined : pin)}>{content}</button>
                : <span className="gk-browse__group-head">{content}</span>}
        </li>
    );
}

/**
 * "Browse area": the results on the map as a list in the glass panel over its right side, nearest the eye, with
 * how many there are and the sort at the top. It folds to its header so the whole map shows. Grouped lists show
 * each group under a header that chooses its pin.
 */
export function BrowsePanel({ source, data, groups, places, count, tools, folded, onToggle, picture, outside }: {
    source: AnySource; data: DirectoryData; groups?: ArrangedGroup<unknown>[]; /** Crests for lines that show them. */ places?: Places; /** "10 clubs near Tbilisi". */ count: string; /** The sort, when there is one. */ tools?: ReactNode;
    folded: boolean; onToggle: () => void;
    /** Lines lead with a bigger crest, their picture. */ picture?: boolean;
    /** The list follows the map: how many results are off screen, and the way to frame every pin again. */ outside?: { count: number; showAll: () => void };
}) {
    const t = useWorldCopy();
    const heading = useId(), bodyId = useId();
    const selection = useContext(DirectorySelectionContext);
    const things = t(source.noun[1]);
    const hidden = outside?.count ?? 0;
    /** Escape ends the choice; focus goes back to the row (from its Open link too). The camera stays. */
    const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        if (event.key !== 'Escape' || !selection?.chosen || event.defaultPrevented) return;
        event.preventDefault();
        const row = (event.target as HTMLElement).closest('li')?.querySelector('button');
        selection.clear();
        row?.focus();
    };
    const row = (item: unknown) => <DirectoryItemKey.Provider key={source.key(item)} value={source.key(item)}><BrowseRow line={source.line(item, places)} picture={picture} /></DirectoryItemKey.Provider>;
    return (
        <section className="gk-browse" data-folded={folded || undefined} data-picture={picture || undefined} aria-labelledby={heading}>
            <header className="gk-browse__head">
                <span className="gk-browse__icon" aria-hidden="true"><Compass /></span>
                <span className="gk-browse__titles"><h2 id={heading}>{t('Browse area')}</h2><small role="status">{count}</small></span>
                <ChevronDown className="gk-browse__chevron" aria-hidden="true" />
                <button type="button" className="gk-browse__fold" aria-expanded={!folded} aria-controls={bodyId} onClick={onToggle}
                    aria-label={folded ? t('Show {name}', { name: t('Browse area') }) : t('Fold {name} away', { name: t('Browse area') })} />
            </header>
            {!folded && <div id={bodyId} className="gk-browse__body" data-browse-scroll>
                {tools && <div className="gk-browse__tools">{tools}</div>}
                {data.notice ? <p className="gk-browse__note">{data.notice}</p>
                    : data.loading ? <div className="gk-browse__loading" aria-hidden="true">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={40} />)}</div>
                    : data.error ? <p className="gk-browse__note">{data.error} <button type="button" className="gk-browse__retry" onClick={data.retry}>{t('Try again')}</button></p>
                    : !data.items.length ? <p className="gk-browse__note">{hidden ? t('Nothing on this part of the map') : t('No {things} to browse here', { things })}</p>
                    : <ul className="gk-sb__rows gk-browse__rows" aria-label={t(source.label)} onKeyDown={onKeyDown}>
                        {groups && groups.length > 1
                            ? groups.map(({ group, items }) => <Fragment key={group.key}><GroupHeader group={group} count={items.length} />{items.map(row)}</Fragment>)
                            : data.items.map(row)}
                    </ul>}
                {/* What the map does not show right now, and the way to see it all again. */}
                {hidden > 0 && !data.loading && (
                    <p className="gk-browse__outside"><span>{t('{count} more outside the map', { count: hidden })}</span><button type="button" onClick={outside!.showAll}>{t('Show all')}</button></p>
                )}
                {data.hasMore && !data.loading && (
                    <button type="button" className="gk-browse__more" onClick={data.loadMore} disabled={data.loadingMore}>{data.loadingMore ? t('Loading…') : t('Show more {things}', { things })}</button>
                )}
            </div>}
        </section>
    );
}
