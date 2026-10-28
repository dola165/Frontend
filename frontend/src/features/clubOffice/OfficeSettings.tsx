import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, ChevronRight, Crown, Landmark, ListChecks, Map as MapIcon, Upload, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { Avatar, Button, ButtonLink, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { useCan } from '../../hooks/useCan';
import type { Bootstrap } from '../clubOperations/api';
import { OperationsSettings } from '../clubOperations/OperationsSettings';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { LeaveClubDialog } from '../clubOperations/leaving/LeaveClubDialog';
import { OwnershipPanel } from '../clubOperations/leaving/OwnershipPanel';
import { useLeaveStep } from '../clubOperations/leaving/useLeaveStep';
import type { ClubManagementOverview } from '../clubs/domain';
import { ClubOrganizationSection } from '../clubWorkspace/settings/ClubOrganizationSection';
import { JoiningPolicy } from '../clubWorkspace/settings/JoiningPolicy';
import { ClubPresentationSettings } from '../clubWorkspace/settings/presentation/ClubPresentationSettings';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { officePath } from './officeLinks';

const SECTIONS = ['joining', 'details', 'profile', 'activities', 'facilities', 'imports'] as const;
type Section = typeof SECTIONS[number];

/**
 * Club office › Settings, for the Owner and Admins: the club page, how players join and who approves them,
 * verification, the ownership, the club's details and the tools it uses. Each row opens its editor here, in the
 * address as `section`, with the way back to the list.
 */
export function OfficeSettings({ clubId, clubName, overview, boot, onRefresh }: {
    clubId: number; clubName: string; overview: ClubManagementOverview | null; boot: Bootstrap | null; onRefresh: () => Promise<void>;
}) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const can = useCan(`club:${clubId}`);
    const leave = useLeaveStep(clubId);
    const section = SECTIONS.find(value => value === params.get('section')) ?? null;
    const open = (next: Section | null) => guardWorkspaceNavigation(() => navigate(officePath(clubId, 'settings', next ? { section: next } : {})));
    const owner = overview?.members.find(member => member.role === 'OWNER');
    const ownerName = owner ? owner.fullName || owner.username : null;
    const handOver = can.decide('hand_over', false).allowed;
    const [notice, setNotice] = useState('');
    const changed = (message: string) => { setNotice(message); void onRefresh(); };

    if (section) return <PageFrame className="cw-page office-settings">
        <div className="office-back"><Button variant="ghost" size="sm" onClick={() => open(null)}><ArrowLeft aria-hidden="true" />{copy('Settings', 'პარამეტრები')}</Button></div>
        {section === 'joining' ? <>
            <JoiningPolicy clubId={clubId} disabled={false} />
            <p className="gk-muted office-settings__rule">{copy('New players: the squad’s coaches or any admin approve; the first answer counts.', 'ახალ მოთამაშეებს ადასტურებს გუნდის მწვრთნელი ან ნებისმიერი ადმინი; ითვლება პირველი პასუხი.')}</p>
        </> : section === 'details' ? boot ? <OperationsSettings key={boot.settings.revision} boot={boot} onSaved={onRefresh} /> : <Panel padded><Skeleton height={160} /></Panel>
            : section === 'profile' ? <ClubPresentationSettings clubId={clubId} part="profile" />
                : <ClubOrganizationSection clubId={clubId} section={section} />}
    </PageFrame>;

    // A row opens its editor here, or carries one button (a link elsewhere, or an action); a row with nothing to do just says.
    const row = (icon: LucideIcon | null, title: string, hint: string, action: { label?: string; onClick?: () => void; to?: string } | null, lead?: ReactNode) => {
        const Icon = icon;
        const body = <>{lead ?? (Icon && <span className="office-settings__icon"><Icon aria-hidden="true" /></span>)}<span className="office-settings__text"><strong>{title}</strong><small>{hint}</small></span></>;
        return <li className="office-settings__row" key={title}>
            {!action ? <span className="office-settings__main">{body}</span>
                : action.label ? <><span className="office-settings__main">{body}</span>{action.to ? <ButtonLink size="sm" to={action.to}>{action.label}</ButtonLink> : <Button size="sm" onClick={action.onClick}>{action.label}</Button>}</>
                    : <button type="button" className="office-settings__main office-settings__open" onClick={action.onClick}>{body}<ChevronRight aria-hidden="true" className="office-settings__go" /></button>}
        </li>;
    };
    return <PageFrame className="cw-page office-settings">
        <PageHeader title={copy('Settings', 'პარამეტრები')} />
        <div className="gk-stack">
            {notice && <p role="status" className="gk-notice cw-notices__success">{notice}</p>}
            <OwnershipPanel clubId={clubId} clubName={clubName} canAsk={can.decide('ask_handover', false).allowed} onChanged={changed} />
            <Panel flush><ul className="office-settings__list" aria-label={copy('Settings', 'პარამეტრები')}>
                {row(null, copy('The club page', 'კლუბის გვერდი'), copy('Name, crest, contacts, grounds, teams', 'სახელი, ემბლემა, კონტაქტები, მოედნები, გუნდები'),
                    { label: copy('Edit the page', 'გვერდის რედაქტირება'), to: `/clubs/${clubId}?edit=1` }, <Avatar name={clubName} size={32} square />)}
                {row(UserPlus, copy('How players join', 'როგორ უერთდებიან მოთამაშეები'), copy('New players: the squad’s coaches or any admin approve; the first answer counts', 'ახალ მოთამაშეებს ადასტურებს გუნდის მწვრთნელი ან ნებისმიერი ადმინი; ითვლება პირველი პასუხი'), { onClick: () => open('joining') })}
                {row(BadgeCheck, copy('Verification', 'ვერიფიკაცია'), copy('A verified club unlocks the store and fundraising', 'ვერიფიცირებული კლუბისთვის იხსნება მაღაზია და შემოწირულობები'),
                    { label: copy('Open', 'გახსნა'), to: `/clubs/${clubId}?verify=1` })}
                {row(Crown, ownerName ? copy(`Owner: ${ownerName}`, `მფლობელი: ${ownerName}`) : copy('Owner', 'მფლობელი'), copy('Only the owner can hand the club over', 'კლუბის გადაცემა მხოლოდ მფლობელს შეუძლია'),
                    handOver ? { label: copy('Hand over', 'გადაცემა'), onClick: () => leave.go('handover') } : null)}
                {row(Landmark, copy('Club details and tools', 'კლუბის მონაცემები და ინსტრუმენტები'), copy('Type, level, country, time zone, currency, legal name, and the tools More tools lists', 'ტიპი, დონე, ქვეყანა, დროის სარტყელი, ვალუტა, იურიდიული სახელი და სხვა ინსტრუმენტების სია'), { onClick: () => open('details') })}
                {row(Users, copy('Public profile', 'საჯარო პროფილი'), copy('What visitors see about the club', 'რას ხედავენ ვიზიტორები კლუბზე'), { onClick: () => open('profile') })}
                {row(ListChecks, copy('Activities', 'აქტივობები'), copy('What the club offers besides squads', 'რას სთავაზობს კლუბი გუნდების გარდა'), { onClick: () => open('activities') })}
                {row(MapIcon, copy('Venue relationships', 'მოედნებთან კავშირები'), copy('Grounds the club works with', 'მოედნები, რომლებთანაც კლუბი მუშაობს'), { onClick: () => open('facilities') })}
                {row(Upload, copy('Imports', 'იმპორტი'), copy('Bring in players and records from a file', 'მოთამაშეებისა და ჩანაწერების ფაილიდან შემოტანა'), { onClick: () => open('imports') })}
            </ul></Panel>
        </div>
        {/* After handing over, an Admin still; someone who then left goes to the club page, a closed club to Home. */}
        <LeaveClubDialog clubId={clubId} clubName={clubName} onDone={(message, outcome) => outcome === 'handed' ? changed(message) : navigate(outcome === 'closed' ? '/home' : `/clubs/${clubId}`, { replace: true })} />
    </PageFrame>;
}
