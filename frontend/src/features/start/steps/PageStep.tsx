import { useEffect, useState } from 'react';
import { Briefcase, FileText, Heart, Shield, type LucideIcon } from 'lucide-react';
import { Badge, Skeleton } from '../../../design/primitives';
import { ActionTiles } from '../../../design/ChoiceTiles';
import { ProfileLayout } from '../../../design/profile/ProfileLayout';
import { fetchEligibility } from '../../pages/api';
import type { PageKind } from '../../pages/model/kinds';
import type { FootballRole } from '../../roles/domain';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { pageOrder } from '../setupWords';
import { useFitWidth } from '../useFitWidth';

/** Each kind as the setup offers it, with what its page holds (pages/PageDesign.java, AVAILABLE): no promises beyond it. */
const KINDS: Partial<Record<PageKind, { icon: LucideIcon; en: [string, string]; ka: [string, string] }>> = {
    CLUB: { icon: Shield, en: ['Club', 'Squads, players, staff, fees, grounds, events, honours and posts.'], ka: ['კლუბი', 'გუნდები, მოთამაშეები, პერსონალი, საფასური, მოედნები, ღონისძიებები, ჯილდოები და პოსტები.'] },
    FAN_CLUB: { icon: Heart, en: ['Fan club', 'Members’ fees, grounds, staff, posts and ways to get involved.'], ka: ['გულშემატკივართა კლუბი', 'წევრობის საფასური, მოედნები, პერსონალი, პოსტები და ჩართვის გზები.'] },
    BUSINESS: { icon: Briefcase, en: ['Sponsor or business', 'About, contact, sponsorships, staff and posts.'], ka: ['სპონსორი ან ბიზნესი', 'შესახებ, კონტაქტი, სპონსორობა, პერსონალი და პოსტები.'] },
    PAGE: { icon: FileText, en: ['Other', 'About, contact, posts and ways to get involved. For anything else in football.'], ka: ['სხვა', 'შესახებ, კონტაქტი, პოსტები და ჩართვის გზები. ფეხბურთში სხვა ყველაფრისთვის.'] },
};
const PAGE_WIDTH = 880;
const nothing = () => undefined;

/** How a page looks: the pages' own header and tabs, scaled down, with a sample name marked as an example. */
function PageSample() {
    const copy = useJourneyCopy();
    const { pane, style } = useFitWidth(true, PAGE_WIDTH);
    return <figure className="gk-setup-sample">
        <div className="gk-setup-sample__frame" ref={pane}>
            <div className="gk-setup-sample__page" style={style} inert>
                <ProfileLayout className="gk-page-doc"
                    identity={{
                        name: copy('Riverside FC', 'რივერსაიდი FC'), square: true, badge: <Badge>{copy('Example', 'მაგალითი')}</Badge>,
                        line: copy('Club', 'კლუბი'), summary: copy('A line about your club, in your own words.', 'ერთი სტრიქონი თქვენს კლუბზე, თქვენი სიტყვებით.'),
                    }}
                    tabs={[{ id: 'posts', label: copy('Posts', 'პოსტები') }, { id: 'about', label: copy('About', 'შესახებ') }]} tab="posts" onTab={nothing}
                    tabsLabel={copy('Page sections', 'გვერდის სექციები')}>{null}</ProfileLayout>
            </div>
        </div>
        <figcaption className="gk-setup__hint">{copy('An example. Your page shows your own name, crest and cover.', 'მაგალითი. თქვენს გვერდზე იქნება თქვენი სახელი, ემბლემა და ფონი.')}</figcaption>
    </figure>;
}

/**
 * Step 5: first "Do you want to create a page?" with how a page looks; then, after "Create a page", the four kinds in
 * the order that fits. A tap goes straight into the usual page creation for that kind. Only kinds the person may
 * create are offered. Hover (or, on a phone, the grey line) says what each page holds.
 */
export function PageStep({ view, roles, business, onPick }: { view: 'ask' | 'choose'; roles: readonly FootballRole[]; business: boolean; onPick: (kind: PageKind) => void }) {
    const copy = useJourneyCopy();
    const [allowed, setAllowed] = useState<{ kinds: PageKind[]; from: number } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchEligibility(controller.signal)
            .then(answer => { if (!controller.signal.aborted) setAllowed({ kinds: answer.kinds.filter(item => item.allowed).map(item => item.kind), from: Math.min(...answer.kinds.map(item => item.minimumAge)) }); })
            .catch(() => { if (!controller.signal.aborted) setAllowed({ kinds: ['CLUB', 'FAN_CLUB', 'BUSINESS', 'PAGE'], from: 0 }); });
        return () => controller.abort();
    }, []);
    if (view === 'ask') return <PageSample />;
    if (!allowed) return <div role="status" aria-label={copy('Loading', 'იტვირთება')} className="gk-setup__loading"><Skeleton height={56} /><Skeleton height={56} /></div>;
    const items = pageOrder(roles, business).filter(item => allowed.kinds.includes(item)).map(item => {
        const words = KINDS[item]!;
        return {
            id: item, label: copy(words.en[0], words.ka[0]), more: copy(words.en[1], words.ka[1]), icon: <span className="gk-tile__icon"><words.icon aria-hidden="true" /></span>,
            hint: item === 'CLUB' ? copy('If your club isn’t on GrassKickZ yet.', 'თუ თქვენი კლუბი GrassKickZ-ზე ჯერ არ არის.') : undefined,
        };
    });
    if (!items.length) return <p className="gk-setup__hint">{copy(`Pages can be created from age ${allowed.from}.`, `გვერდის შექმნა ${allowed.from} წლიდან შეიძლება.`)}</p>;
    return <ActionTiles items={items} onPick={id => onPick(id as PageKind)} label={copy('Create a page', 'გვერდის შექმნა')} />;
}
