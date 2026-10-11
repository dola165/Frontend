import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Compass } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { counterpartProps, DirectoryItemKey, useMapCounterpart } from './selection';
import type { AnySource, BrowseLine } from './types';
import type { DirectoryData } from './useDirectoryData';
import '../front/fields/scoreboard.css';
import './browse.css';

/** One result in the panel, linked to its pin: pointing at either lights the other. */
function BrowseRow({ line }: { line: BrowseLine }) {
    const counterpart = useMapCounterpart();
    const body = <>
        {line.when && <span className="gk-sb__when"><b>{line.when.time}</b>{line.when.day && <small>{line.when.day}</small>}</span>}
        {line.crest && <Crest src={line.crest.src} name={line.crest.name} size={28} round={line.crest.round} />}
        <span className="gk-sb__main"><strong>{line.title}</strong>{line.detail && <small>{line.detail}</small>}</span>
        {line.fact && <span className="gk-sb__fact" data-tone={line.factTone}>{line.fact}</span>}
    </>;
    const linked = counterpartProps(counterpart);
    return <li>{line.to
        ? <Link className="gk-sb__row gk-sb__row--line gk-browse__row" data-when={line.when ? true : undefined} to={line.to} {...linked}>{body}</Link>
        : <div className="gk-sb__row gk-sb__row--line gk-browse__row" data-when={line.when ? true : undefined} {...linked}>{body}</div>}</li>;
}

/**
 * "Browse area": the results on the map as a list in the glass panel over its right side, nearest the eye, with
 * how many there are and the sort at the top. It folds to its header so the whole map shows.
 */
export function BrowsePanel({ source, data, count, tools, folded, onToggle }: {
    source: AnySource; data: DirectoryData; /** "10 clubs near Tbilisi". */ count: string; /** The sort, when there is one. */ tools?: ReactNode;
    folded: boolean; onToggle: () => void;
}) {
    const t = useWorldCopy();
    const heading = useId(), bodyId = useId();
    const things = t(source.noun[1]);
    return (
        <section className="gk-browse" data-folded={folded || undefined} aria-labelledby={heading}>
            <header className="gk-browse__head">
                <span className="gk-browse__icon" aria-hidden="true"><Compass /></span>
                <span className="gk-browse__titles"><h2 id={heading}>{t('Browse area')}</h2><small role="status">{count}</small></span>
                <ChevronDown className="gk-browse__chevron" aria-hidden="true" />
                <button type="button" className="gk-browse__fold" aria-expanded={!folded} aria-controls={bodyId} onClick={onToggle}
                    aria-label={folded ? t('Show {name}', { name: t('Browse area') }) : t('Fold {name} away', { name: t('Browse area') })} />
            </header>
            {!folded && <div id={bodyId} className="gk-browse__body">
                {tools && <div className="gk-browse__tools">{tools}</div>}
                {data.notice ? <p className="gk-browse__note">{data.notice}</p>
                    : data.loading ? <div className="gk-browse__loading" aria-hidden="true">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={40} />)}</div>
                    : data.error ? <p className="gk-browse__note">{data.error} <button type="button" className="gk-browse__retry" onClick={data.retry}>{t('Try again')}</button></p>
                    : !data.items.length ? <p className="gk-browse__note">{t('No {things} to browse here', { things })}</p>
                    : <ul className="gk-sb__rows gk-browse__rows" aria-label={t(source.label)}>
                        {data.items.map(item => <DirectoryItemKey.Provider key={source.key(item)} value={source.key(item)}><BrowseRow line={source.line(item)} /></DirectoryItemKey.Provider>)}
                    </ul>}
                {data.hasMore && !data.loading && (
                    <button type="button" className="gk-browse__more" onClick={data.loadMore} disabled={data.loadingMore}>{data.loadingMore ? t('Loading…') : t('Show more {things}', { things })}</button>
                )}
            </div>}
        </section>
    );
}
