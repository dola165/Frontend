import { Handshake, LandPlot, MoreHorizontal, Shirt, Trophy, type LucideIcon } from 'lucide-react';
import { ActionTiles } from '../../../design/ChoiceTiles';
import { createHref } from '../../pages/create/entry';
import type { BusinessKind, PageKind } from '../../pages/model/kinds';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';

const HOME = { pathname: '/home', search: '' };

/** Each kind opens the existing page creation for it: a business page of that kind, or an organiser for tournaments. */
const KINDS: { id: string; icon: LucideIcon; en: string; ka: string; kind: PageKind | null; business?: BusinessKind; draw?: boolean }[] = [
    { id: 'sponsor', icon: Handshake, en: 'Sponsor', ka: 'სპონსორი', kind: 'BUSINESS', business: 'SPONSOR' },
    { id: 'kit', icon: Shirt, en: 'Kit and equipment', ka: 'ეკიპირება და ინვენტარი', kind: 'BUSINESS', business: 'COMPANY' },
    { id: 'pitches', icon: LandPlot, en: 'Pitches and venues', ka: 'მოედნები და სივრცეები', kind: 'BUSINESS', business: 'COMPANY' },
    { id: 'events', icon: Trophy, en: 'Tournaments and events', ka: 'ტურნირები და ღონისძიებები', kind: 'PAGE', draw: true },
    { id: 'other', icon: MoreHorizontal, en: 'Other', ka: 'სხვა', kind: null },
];

/**
 * Step 2 of A business or organisation: what kind, one tap, and the page-create sheet for it opens over Home. Not now
 * in the sheet comes back here (`from=welcome`), so nobody is left on a page they did not pick.
 */
export function BusinessStep({ land, back, close }: WelcomeStepProps) {
    const copy = useJourneyCopy();
    const pick = (id: string) => {
        const item = KINDS.find(kind => kind.id === id);
        if (item) land('business', createHref(HOME, item.kind, 'welcome', item.draw === true, item.business ?? null));
    };
    return <WelcomeFrame position={2} size="choose" onClose={close} back={back} title={copy('What kind?', 'რა სახის?')} footer={null}>
        <ActionTiles label={copy('What kind?', 'რა სახის?')} onPick={pick}
            items={KINDS.map(item => ({ id: item.id, label: copy(item.en, item.ka), icon: <span className="gk-welcome__mark"><item.icon aria-hidden="true" /></span> }))} />
    </WelcomeFrame>;
}
