import type { LucideIcon } from 'lucide-react';
import { Hourglass, Inbox, LayoutGrid, RefreshCw, Users } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** The page's places: the overview, ideas, waiting, what changed, and the team last. */
export type TeamWorkPlace = 'overview' | 'ideas' | 'waiting' | 'changes' | 'team';

const PLACES: [TeamWorkPlace, LucideIcon, string, string][] = [
    ['overview', LayoutGrid, 'Overview', 'მიმოხილვა'],
    ['ideas', Inbox, 'Ideas', 'იდეები'],
    ['waiting', Hourglass, 'Waiting', 'მოლოდინში'],
    ['changes', RefreshCw, 'What changed', 'რა შეიცვალა'],
    ['team', Users, 'Team', 'გუნდი'],
];

/**
 * The small side bar; on a phone it becomes one row of tabs. Overview shows how much waits on the owner (tasks that
 * need his look, plus open questions; bright), Ideas how many are new to you (bright), Waiting how many wait (quiet).
 */
export function TeamWorkNav({ current, needsYou, fresh, waiting, onGo }: { current: TeamWorkPlace; needsYou: number; fresh: number; waiting: number; onGo: (place: TeamWorkPlace) => void }) {
    const copy = useJourneyCopy();
    return <nav className="tw-side" aria-label={copy('Team work', 'გუნდის სამუშაო')}>
        <ul>{PLACES.map(([place, Icon, en, ka]) => <li key={place} data-place={place}>
            <button type="button" aria-current={current === place ? 'page' : undefined} onClick={() => onGo(place)}>
                <Icon aria-hidden="true" /><span className="tw-side__label">{copy(en, ka)}</span>
                {place === 'overview' && needsYou > 0 && <span className="gk-count" title={copy('Waiting on you: tasks to look at and open questions', 'გელოდებათ: სანახავი საქმეები და ღია კითხვები')}>{needsYou}</span>}
                {place === 'ideas' && fresh > 0 && <span className="gk-count" title={copy('New to you', 'თქვენთვის ახალი')}>{fresh}</span>}
                {place === 'waiting' && waiting > 0 && <span className="tw-side__quiet gk-num">{waiting}</span>}
            </button>
        </li>)}</ul>
    </nav>;
}
