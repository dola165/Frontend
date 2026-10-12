import { Link } from 'react-router-dom';
import { Section, Skeleton } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { peekClick, usePeek } from '../peek/usePeek';
import type { ArrangedGroup } from './groups';
import { DirectoryItemKey } from './selection';
import type { AnySource } from './types';
import '../scoreboard/scoreboard.css';
import './score-results.css';

/**
 * Results as a score site lists them: one calm card per group (your teams, a tournament, friendlies, a lane), cards
 * side by side across the width, score lines inside. A group's header can lead on ("Table ›"); an always-shown group
 * with nothing in it says so in one quiet line.
 */
export function ScoreResults({ source, groups, items, label }: { source: AnySource; groups?: ArrangedGroup<unknown>[]; items: unknown[]; label: string }) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const { Item } = source;
    const cards = groups?.length ? groups : [{ group: { key: 'all', label: '' }, items }];
    return (
        <div className="gk-score-groups" role="group" aria-label={label}>
            {cards.map(({ group, items: rows }) => {
                const action = group.action && (
                    <Link className="gk-section__action" to={group.action.to} onClick={peekClick(group.action.peek, drawers.open)}>{t(group.action.label)}</Link>
                );
                return (
                    <Section key={group.key} boxed level={3} className="gk-score-group" icon={group.icon} tone={group.tint} action={action}
                        title={group.label ? t(group.label) : undefined}
                        hint={group.label ? [source.groups?.uncounted ? null : String(rows.length), group.detail].filter(Boolean).join(' · ') || undefined : undefined}>
                        {rows.length
                            ? <ul className="gk-sb__rows gk-section__flush">{rows.map(item => <DirectoryItemKey.Provider key={source.key(item)} value={source.key(item)}><Item item={item} /></DirectoryItemKey.Provider>)}</ul>
                            : <p className="gk-score-group__empty gk-section__flush">{t(group.empty ?? 'Nothing here')}</p>}
                    </Section>
                );
            })}
        </div>
    );
}

/** Score cards while a list loads: shaped like what comes. */
export function ScoreSkeleton({ label }: { label: string }) {
    return (
        <div className="gk-score-groups" role="status" aria-label={label}>
            {Array.from({ length: 3 }, (_, card) => (
                <div key={card} className="gk-score-group gk-score-group--skeleton">
                    <Skeleton height={14} width="45%" />
                    {Array.from({ length: 4 }, (_, row) => <div key={row} className="gk-score-skeleton-row"><Skeleton height={14} width={40} /><span><Skeleton height={12} width="70%" /><Skeleton height={12} width="55%" /></span></div>)}
                </div>
            ))}
        </div>
    );
}
