import { useEffect, useState } from 'react';
import { Briefcase, FileText, Heart, Shield, type LucideIcon } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { ChoiceTiles } from '../../../design/ChoiceTiles';
import { fetchEligibility } from '../../pages/api';
import type { PageKind } from '../../pages/model/kinds';
import type { FootballRole } from '../../roles/domain';
import { pageOrder } from '../setupWords';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

const KINDS: Partial<Record<PageKind, { icon: LucideIcon; en: string; ka: string }>> = {
    CLUB: { icon: Shield, en: 'Club', ka: 'კლუბი' },
    FAN_CLUB: { icon: Heart, en: 'Fan club', ka: 'გულშემატკივართა კლუბი' },
    BUSINESS: { icon: Briefcase, en: 'Sponsor or business', ka: 'სპონსორი ან ბიზნესი' },
    PAGE: { icon: FileText, en: 'Other', ka: 'სხვა' },
};

/**
 * Step 5: one page to create, each kind leading into the usual page creation with that kind chosen. Nothing is chosen
 * for them, only kinds they may create are offered, and "Not now" finishes the setup.
 */
export function PageStep({ roles, business, kind, onKind }: { roles: readonly FootballRole[]; business: boolean; kind: PageKind | null; onKind: (kind: PageKind) => void }) {
    const copy = useJourneyCopy();
    const [allowed, setAllowed] = useState<{ kinds: PageKind[]; from: number } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchEligibility(controller.signal)
            .then(answer => { if (!controller.signal.aborted) setAllowed({ kinds: answer.kinds.filter(item => item.allowed).map(item => item.kind), from: Math.min(...answer.kinds.map(item => item.minimumAge)) }); })
            .catch(() => { if (!controller.signal.aborted) setAllowed({ kinds: ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE'], from: 0 }); });
        return () => controller.abort();
    }, []);
    if (!allowed) return <div role="status" aria-label={copy('Loading', 'იტვირთება')} className="gk-setup__loading"><Skeleton height={56} /><Skeleton height={56} /></div>;
    const items = pageOrder(roles, business).filter(item => allowed.kinds.includes(item)).map(item => {
        const words = KINDS[item]!;
        return {
            id: item, label: copy(words.en, words.ka), icon: <span className="gk-tile__icon"><words.icon aria-hidden="true" /></span>,
            hint: item === 'CLUB' ? copy('If your club isn’t on GrassKickZ yet.', 'თუ თქვენი კლუბი GrassKickZ-ზე ჯერ არ არის.') : undefined,
        };
    });
    if (!items.length) return <p className="gk-setup__hint">{copy(`Pages can be created from age ${allowed.from}.`, `გვერდის შექმნა ${allowed.from} წლიდან შეიძლება.`)}</p>;
    return <ChoiceTiles compact single items={items} chosen={kind ? [kind] : []} onToggle={id => onKind(id as PageKind)} label={copy('Create a page', 'გვერდის შექმნა')} />;
}
