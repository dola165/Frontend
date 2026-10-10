import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronDown, X } from 'lucide-react';
import { Button } from '../../../../design/primitives';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { exploreDestinations } from './pinCatalog';
import { pinIcons, type PinIcon } from './pinIcons';
import type { RouteDescription } from './describeRoute';
import type { Pin, usePins } from './usePins';

export interface PinsPanelProps {
    state: ReturnType<typeof usePins>;
    page: RouteDescription & { title: string | null };
    work: Pin[];
    titleId: string;
    onNavigate: () => void;
}

export function PinGlyph({ icon }: { icon: PinIcon }) {
    const Icon = pinIcons[icon];
    return <Icon aria-hidden="true" />;
}

function PinLink({ pin, meta, onNavigate }: { pin: Pin; meta?: string; onNavigate: () => void }) {
    return (
        <Link to={pin.path} className="gk-prow__link" onClick={onNavigate}>
            <span className="gk-prow__icon"><PinGlyph icon={pin.icon} /></span>
            <span className="gk-prow__text"><span className="gk-prow__title">{pin.label}</span>{meta && <span className="gk-prow__meta">{meta}</span>}</span>
        </Link>
    );
}

/** Pin this page, manage pins, take a suggestion or browse everything that can become a tab. */
export function PinsPanel({ state, page, work, titleId, onNavigate }: PinsPanelProps) {
    const copy = useJourneyCopy();
    const { pins, suggestions, isPinned, pin, unpin, move, full } = state;
    const pageLabel = page.label ?? page.title ?? copy('This page', 'ეს გვერდი');
    const toggle = (item: Pin) => isPinned(item.path) ? unpin(item.path) : pin(item);
    const pinButton = (item: Pin, emphasis: 'secondary' | 'ghost' = 'secondary') => {
        const pinned = isPinned(item.path);
        return (
            <Button size="sm" variant={pinned ? 'ghost' : emphasis} disabled={!pinned && full} aria-pressed={pinned}
                aria-label={`${pinned ? copy('Unpin', 'მოხსნა') : copy('Pin', 'მიმაგრება')} ${item.label}`} onClick={() => toggle(item)}>
                {pinned ? copy('Unpin', 'მოხსნა') : copy('Pin', 'მიმაგრება')}
            </Button>
        );
    };
    const catalogue = (title: string, items: Pin[]) => items.length > 0 && (
        <>
            <h4 className="gk-pop__label">{title}</h4>
            <ul className="gk-list">{items.map(item => <li key={item.path} className="gk-prow"><PinLink pin={item} onNavigate={onNavigate} />{pinButton(item, 'ghost')}</li>)}</ul>
        </>
    );

    return (
        <>
            <div className="gk-pop__head"><h2 id={titleId} className="gk-pop__title">{copy('Pins', 'მიმაგრებული')}</h2></div>
            <p className="gk-pop__hint">{copy('Your own tabs next to Home, World and My Club.', 'თქვენი ჩანართები მთავარის, სამყაროსა და ჩემი კლუბის გვერდით.')}</p>

            {page.pinnable && (
                <section className="gk-pop__section" aria-label={copy('This page', 'ეს გვერდი')}>
                    <div className="gk-prow gk-prow--current">
                        <span className="gk-prow__link">
                            <span className="gk-prow__icon"><PinGlyph icon={page.icon} /></span>
                            <span className="gk-prow__text"><span className="gk-prow__title">{pageLabel}</span><span className="gk-prow__meta">{copy('This page', 'ეს გვერდი')}</span></span>
                        </span>
                        {isPinned(page.path)
                            ? <Button size="sm" variant="ghost" onClick={() => unpin(page.path)}>{copy('Unpin', 'მოხსნა')}</Button>
                            : <Button size="sm" variant="primary" disabled={full} onClick={() => pin({ path: page.path, label: pageLabel, icon: page.icon })}>{copy('Pin this page', 'გვერდის მიმაგრება')}</Button>}
                    </div>
                </section>
            )}

            <section className="gk-pop__section" aria-labelledby={`${titleId}-yours`}>
                <h3 id={`${titleId}-yours`} className="gk-pop__label">{copy('Your pins', 'თქვენი პინები')}</h3>
                {pins.length === 0
                    ? <p className="gk-pop__note">{copy('Nothing pinned yet. Open a page you use often and pin it, or pick one below.', 'ჯერ არაფერია მიმაგრებული. გახსენით ხშირად გამოყენებული გვერდი და მიამაგრეთ.')}</p>
                    : <ul className="gk-list">{pins.map((item, index) => (
                        <li key={item.path} className="gk-prow">
                            <PinLink pin={item} onNavigate={onNavigate} />
                            <span className="gk-prow__actions">
                                <Button size="sm" variant="ghost" iconOnly disabled={index === 0} aria-label={copy(`Move ${item.label} earlier`, `${item.label} — წინ`)} title={copy('Move earlier', 'წინ')} onClick={() => move(item.path, -1)}><ArrowUp /></Button>
                                <Button size="sm" variant="ghost" iconOnly disabled={index === pins.length - 1} aria-label={copy(`Move ${item.label} later`, `${item.label} — უკან`)} title={copy('Move later', 'უკან')} onClick={() => move(item.path, 1)}><ArrowDown /></Button>
                                <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Unpin ${item.label}`, `${item.label} — მოხსნა`)} title={copy('Unpin', 'მოხსნა')} onClick={() => unpin(item.path)}><X /></Button>
                            </span>
                        </li>
                    ))}</ul>}
                {full && <p className="gk-pop__note">{copy('You can keep up to 12 pins. Unpin one to add another.', 'შეგიძლიათ 12 პინამდე. ახლისთვის ერთი მოხსენით.')}</p>}
            </section>

            {suggestions.length > 0 && (
                <section className="gk-pop__section" aria-labelledby={`${titleId}-suggested`}>
                    <h3 id={`${titleId}-suggested`} className="gk-pop__label">{copy('Suggested', 'შემოთავაზებული')}</h3>
                    <ul className="gk-list">{suggestions.map(item => (
                        <li key={item.path} className="gk-prow">
                            <PinLink pin={item} onNavigate={onNavigate} meta={item.visits
                                ? copy(`Opened ${item.visits} times in two weeks`, `${item.visits}-ჯერ გახსნილი ორ კვირაში`)
                                : item.reason} />
                            {pinButton(item)}
                        </li>
                    ))}</ul>
                </section>
            )}

            <section className="gk-pop__section">
                <details>
                    <summary>{copy('More places to pin', 'სხვა გვერდები')}<ChevronDown aria-hidden="true" /></summary>
                    {catalogue(copy('Your work', 'თქვენი საქმე'), work)}
                    {catalogue(copy('Explore', 'აღმოაჩინეთ'), exploreDestinations)}
                </details>
            </section>
        </>
    );
}
