import type { LucideIcon } from 'lucide-react';
import { Hourglass, Inbox, LayoutGrid, RefreshCw, Users } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** The page's places: progress, findings to add to plans, pending, staying up to date, and the team last. */
export type TeamWorkPlace = 'overview' | 'add' | 'pending' | 'updates' | 'team';

const PLACES: [TeamWorkPlace, LucideIcon, string, string][] = [
    ['overview', LayoutGrid, 'Progress', 'პროგრესი'],
    ['add', Inbox, 'Add to plans', 'გეგმებში დამატება'],
    ['pending', Hourglass, 'Pending', 'მოლოდინში'],
    ['updates', RefreshCw, 'Stay up to date', 'განახლებები'],
    ['team', Users, 'Team', 'გუნდი'],
];

/**
 * The small side bar; on a phone it becomes one row of tabs. Add to plans shows how many findings are new to you
 * (bright), Pending how many wait (quiet).
 */
export function TeamWorkNav({ current, fresh, waiting, onGo }: { current: TeamWorkPlace; fresh: number; waiting: number; onGo: (place: TeamWorkPlace) => void }) {
    const copy = useJourneyCopy();
    return <nav className="tw-side" aria-label={copy('Team work', 'გუნდის სამუშაო')}>
        <ul>{PLACES.map(([place, Icon, en, ka]) => <li key={place} data-place={place}>
            <button type="button" aria-current={current === place ? 'page' : undefined} onClick={() => onGo(place)}>
                <Icon aria-hidden="true" /><span className="tw-side__label">{copy(en, ka)}</span>
                {place === 'add' && fresh > 0 && <span className="gk-count" title={copy('New to you', 'თქვენთვის ახალი')}>{fresh}</span>}
                {place === 'pending' && waiting > 0 && <span className="tw-side__quiet gk-num">{waiting}</span>}
            </button>
        </li>)}</ul>
    </nav>;
}
