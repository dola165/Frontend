import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { hasNavigationCapability, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchBoard } from './api';
import { needsYouCount } from './needsYou';

/** A quiet row in Home's own card, for team accounts only: Team work, how much is in progress and what waits on you. */
export function TeamWorkHomeRow({ caps }: { caps?: NavigationCapabilities }) {
    const team = hasNavigationCapability(caps, 'team.work');
    return team ? <TeamWorkLink /> : null;
}

function TeamWorkLink() {
    const copy = useJourneyCopy();
    const [counts, setCounts] = useState<{ active: number; needsYou: number } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchBoard(controller.signal).then(board => { if (!controller.signal.aborted) setCounts({ active: board.items.filter(item => item.status === 'IN_PROGRESS').length, needsYou: needsYouCount(board.items) }); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    const line = counts == null ? copy('What we’re building', 'რას ვაშენებთ')
        : [copy(`${counts.active} in progress`, `${counts.active} მიმდინარე`), counts.needsYou > 0 && copy(`${counts.needsYou} waiting on you`, `${counts.needsYou} გელოდებათ`)].filter(Boolean).join(' · ');
    return <Link to="/team-work" className="feed-side-link home-social-link tw-home-row" aria-label={`${copy('Team work', 'გუნდის სამუშაო')}. ${line}`}>
        <span className="home-nav-icon"><ListChecks size={19} aria-hidden="true" /></span>
        <span className="home-shortcut-copy"><span className="feed-side-link__title">{copy('Team work', 'გუნდის სამუშაო')}</span><span className="home-shortcut-description">{line}</span></span>
    </Link>;
}
