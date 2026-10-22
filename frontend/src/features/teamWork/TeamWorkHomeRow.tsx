import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { hasNavigationCapability, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchBoard } from './api';

/** A quiet row in Home's own card, for team accounts only: Team work and how much is in progress. */
export function TeamWorkHomeRow({ caps }: { caps?: NavigationCapabilities }) {
    const team = hasNavigationCapability(caps, 'team.work');
    return team ? <TeamWorkLink /> : null;
}

function TeamWorkLink() {
    const copy = useJourneyCopy();
    const [active, setActive] = useState<number | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchBoard(controller.signal).then(board => { if (!controller.signal.aborted) setActive(board.items.filter(item => item.status === 'IN_PROGRESS').length); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    const line = active == null ? copy('What we’re building', 'რას ვაშენებთ') : copy(`${active} in progress`, `${active} მიმდინარე`);
    return <Link to="/team-work" className="feed-side-link home-social-link tw-home-row" aria-label={`${copy('Team work', 'გუნდის სამუშაო')}. ${line}`}>
        <span className="home-nav-icon"><ListChecks size={19} aria-hidden="true" /></span>
        <span className="home-shortcut-copy"><span className="feed-side-link__title">{copy('Team work', 'გუნდის სამუშაო')}</span><span className="home-shortcut-description">{line}</span></span>
    </Link>;
}
