import { Link } from 'react-router-dom';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import type { PrimaryTab } from './sections';
import { BrandMark } from '../BrandMark';
import { BrandNavigationIcon } from '../../branding/BrandNavigationIcon';

/**
 * Phone navigation at thumb reach (owner, 16 October): Home, World, the person's role tabs and My Club when they have
 * a club. Messages and "You" (the profile picture, holding pins and the account) sit in the top bar.
 */
export function PhoneTabBar({ tabs }: { tabs: PrimaryTab[] }) {
    const copy = useJourneyCopy();
    return (
        <nav className="gk gk-tabbar" aria-label={copy('Main', 'მთავარი ნავიგაცია')}>
            <ul className="gk-tabbar__list">
                {tabs.map(({ id: key, to, label, icon: Icon, current }) => (
                    <li key={key}>
                        <Link to={to} className="gk-tabbar__item" aria-current={current ? 'page' : undefined}>
                            {key === 'world' ? <BrandMark variant="map" className="gk-map-mark" /> : <BrandNavigationIcon icon={Icon} variant={key === 'home' ? 'pitch' : key === 'my-squads' ? 'squads' : key === 'parent-hub' ? 'family' : 'workspace'} strokeWidth={current ? 2.1 : 1.8} />}<span className="gk-tabbar__label">{label}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
