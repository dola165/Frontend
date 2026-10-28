import { Link } from 'react-router-dom';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import type { PrimaryTab } from './sections';

/**
 * Phone navigation at thumb reach (owner, 16 October): Home, World and the person's work tabs, Club office last.
 * Messages and "You" (the profile picture, holding pins and the account) sit in the top bar.
 */
export function PhoneTabBar({ tabs }: { tabs: PrimaryTab[] }) {
    const copy = useJourneyCopy();
    return (
        <nav className="gk gk-tabbar" aria-label={copy('Main', 'მთავარი ნავიგაცია')}>
            <ul className="gk-tabbar__list">
                {tabs.map(({ id: key, to, label, icon: Icon, current }) => (
                    <li key={key}>
                        <Link to={to} className="gk-tabbar__item" aria-current={current ? 'page' : undefined}>
                            <Icon aria-hidden="true" strokeWidth={current ? 2.1 : 1.8} /><span className="gk-tabbar__label">{label}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
