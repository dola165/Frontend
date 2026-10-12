import type { CareerEntry, CareerKind } from '../../roles/domain';
import { useWorldCopy } from '../copy';
import { PaneSection } from './PaneSection';

const KINDS: { kind: CareerKind; label: string; shown: number }[] = [
    { kind: 'POSITION', label: 'Experience', shown: 4 },
    { kind: 'QUALIFICATION', label: 'Qualifications', shown: 3 },
    { kind: 'ACHIEVEMENT', label: 'Achievements', shown: 2 },
    { kind: 'VOLUNTEERING', label: 'Volunteering', shown: 2 },
];

/**
 * A person's career as they published it on their profile: where they worked and as what (newest first, "2016 – now"),
 * their qualifications, achievements and volunteering, a few of each, with "View career" to their profile's Career tab.
 * Organisations are named as the person wrote them (no club link: entries carry none).
 */
export function PersonCareer({ entries, link }: { entries: CareerEntry[]; /** Their profile's Career tab, when they have one. */ link?: string }) {
    const t = useWorldCopy();
    const published = entries.filter(entry => entry.published !== false);
    if (!published.length) return null;
    const when = (entry: CareerEntry) => {
        const from = entry.startsOn?.slice(0, 4), to = entry.endsOn?.slice(0, 4);
        if (entry.kind === 'QUALIFICATION' || entry.kind === 'ACHIEVEMENT') return from;
        return from ? `${from} – ${to ?? t('now')}` : null;
    };
    return (
        <PaneSection title={t('Career')} count={published.length} more={link ? { to: link, label: t('View career') } : undefined}>
            {KINDS.map(({ kind, label, shown }) => {
                const list = published.filter(entry => entry.kind === kind).sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''));
                if (!list.length) return null;
                return (
                    <div key={kind} className="gk-pane-career">
                        <h4>{t(label)}</h4>
                        <ul className="gk-peek-list">{list.slice(0, shown).map(entry => (
                            <li key={entry.id} className="gk-pane-line"><b>{entry.title}</b><small>{[entry.organization, when(entry)].filter(Boolean).join(' · ')}</small></li>
                        ))}</ul>
                        {list.length > shown && <small className="gk-faint">{t('{count} more on the profile', { count: list.length - shown })}</small>}
                    </div>
                );
            })}
        </PaneSection>
    );
}
