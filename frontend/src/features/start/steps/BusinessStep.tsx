import type { CSSProperties } from 'react';
import { Building2, CalendarHeart, Handshake, Megaphone, Store, type LucideIcon } from 'lucide-react';
import { createHref } from '../../pages/create/entry';
import type { BusinessKind } from '../../pages/model/kinds';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { StepProps } from '../WelcomeDialog';

/**
 * The optional last step. Each tile opens the existing page creation as a business page of that kind. Shops, event
 * hosts and agencies have no business kind of their own yet, so they start as a general business.
 */
const TILES: { id: string; kind: BusinessKind; icon: LucideIcon; tone: string; en: string; ka: string }[] = [
    { id: 'sponsor', kind: 'SPONSOR', icon: Handshake, tone: 'var(--gk-accent)', en: 'Sponsor or brand', ka: 'სპონსორი ან ბრენდი' },
    { id: 'shop', kind: 'COMPANY', icon: Store, tone: 'var(--color-cyan)', en: 'Shop or manufacturer', ka: 'მაღაზია ან მწარმოებელი' },
    { id: 'events', kind: 'COMPANY', icon: CalendarHeart, tone: 'var(--gk-violet)', en: 'Event host', ka: 'ღონისძიებების მასპინძელი' },
    { id: 'agency', kind: 'COMPANY', icon: Building2, tone: 'var(--gk-info)', en: 'Agency', ka: 'სააგენტო' },
    { id: 'media', kind: 'MEDIA', icon: Megaphone, tone: 'var(--gk-warning)', en: 'Media', ka: 'მედია' },
];

export function BusinessStep({ leave }: StepProps) {
    const copy = useJourneyCopy();
    return <ul className="gk-welcome__tiles" aria-label={copy('Here as a business?', 'ბიზნესი ხართ?')}>
        {TILES.map(tile => <li key={tile.id}>
            <button type="button" className="gk-welcome__tile" style={{ '--tile': tile.tone } as CSSProperties}
                onClick={() => leave(createHref({ pathname: '/home', search: '' }, 'BUSINESS', 'start', false, tile.kind))}>
                <span className="gk-welcome__tile-icon"><tile.icon aria-hidden="true" /></span>
                <span>{copy(tile.en, tile.ka)}</span>
            </button>
        </li>)}
    </ul>;
}
