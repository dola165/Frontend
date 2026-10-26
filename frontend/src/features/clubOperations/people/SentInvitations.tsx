import { useState } from 'react';
import { Ban, Users } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import type { ClubManagementOverview, ClubMembershipInvite } from '../../clubs/domain';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formatDate } from '../../../utils/formatting';
import { useJobWords } from './jobWords';

const day = (value?: string | null) => value ? formatDate(value, { day: 'numeric', month: 'short' }) : null;

/**
 * Club invitations still waiting for an answer, each cancellable after asking. Giving someone a job is the invite on
 * People; this list keeps the older membership invitations (players included) visible until they are answered.
 */
export function SentInvitations({ overview, pendingKey, onCancelInvite, onOpenPeople }: {
    overview: ClubManagementOverview | null; pendingKey: string | null; onCancelInvite: (inviteId: number) => Promise<void>; onOpenPeople?: () => void;
}) {
    const { copy } = useJobWords();
    const [cancelling, setCancelling] = useState<ClubMembershipInvite | null>(null);
    const invitations = overview?.pendingInvitations ?? [];
    const person = (user: { fullName?: string | null; username: string }) => user.fullName || user.username;
    const role = (value: string) => ({
        OWNER: copy('Owner', 'მფლობელი'), CLUB_ADMIN: copy('Admin', 'ადმინი'), COACH: copy('Coach', 'მწვრთნელი'), PLAYER: copy('Player', 'მოთამაშე'), AGENT: copy('Agent', 'აგენტი'),
    } as Record<string, string>)[value] ?? value;
    const status = (value: string) => ({
        PENDING: copy('Waiting', 'მოლოდინში'), ACCEPTED: copy('Accepted', 'მიღებული'), DECLINED: copy('Declined', 'უარყოფილი'), CANCELLED: copy('Cancelled', 'გაუქმებული'),
        UNAVAILABLE: copy('Unavailable', 'მიუწვდომელი'), EXPIRED: copy('Expired', 'ვადაგასული'),
    } as Record<string, string>)[value] ?? value;
    const title = copy('Sent invitations', 'გაგზავნილი მოწვევები');
    return <PageFrame className="cw-page">
        <PageHeader title={copy('Invitations', 'მოწვევები')} subtitle={copy('Club invitations waiting for an answer. Staff jobs are given and followed in People.', 'კლუბის მოწვევები, რომლებიც პასუხს ელოდება. სამუშაოები ხალხის გვერდზე გაიცემა.')} />
        <div className="gk-stack">
            <Section title={title} hint={invitations.length ? String(invitations.length) : undefined}>
                <Panel flush>{!overview ? <div className="cw-skeleton-rows" role="status" aria-label={copy('Loading invitations', 'მოწვევები იტვირთება')}><Skeleton height={44} /></div>
                    : invitations.length ? <List label={title}>{invitations.map(invite => <ListRow key={invite.id}
                        lead={<Avatar src={resolveMediaUrl(invite.avatarUrl) || null} name={person(invite)} size={36} />} title={person(invite)}
                        meta={[role(invite.role), day(invite.createdAt) && copy(`Sent ${day(invite.createdAt)}`, `გაიგზავნა ${day(invite.createdAt)}`),
                            day(invite.expiresAt) && copy(`Expires ${day(invite.expiresAt)}`, `ვადა ${day(invite.expiresAt)}`)].filter(Boolean).join(' · ')}
                        trail={<><Badge tone="info">{status(invite.status)}</Badge><Button size="sm" variant="ghost" iconOnly aria-label={copy(`Cancel the invitation for ${person(invite)}`, `მოწვევის გაუქმება: ${person(invite)}`)}
                            title={copy('Cancel invitation', 'მოწვევის გაუქმება')} disabled={pendingKey === `cancel-${invite.id}`} onClick={() => setCancelling(invite)}><Ban aria-hidden="true" /></Button></>} />)}</List>
                        : <EmptyNote title={copy('No invitations waiting', 'მოლოდინში მოწვევა არ არის')}
                            action={onOpenPeople ? <Button size="sm" onClick={onOpenPeople}><Users aria-hidden="true" />{copy('Open People', 'ხალხის გახსნა')}</Button> : undefined}>
                            {copy('Invite coaches and staff from People.', 'მწვრთნელები და პერსონალი მოიწვიეთ ხალხის გვერდიდან.')}</EmptyNote>}</Panel>
            </Section>
        </div>
        <Dialog open={cancelling !== null} role="alertdialog" size="sm" onClose={() => setCancelling(null)}
            title={cancelling ? copy(`Cancel the invitation for ${person(cancelling)}?`, `გაუქმდეს მოწვევა: ${person(cancelling)}?`) : ''}
            description={copy('They can no longer accept it. You can invite them again later.', 'მისი მიღება აღარ იქნება შესაძლებელი. მოგვიანებით შეგიძლიათ ხელახლა მოიწვიოთ.')}
            footer={<><Button variant="ghost" onClick={() => setCancelling(null)}>{copy('Keep invitation', 'მოწვევის დატოვება')}</Button>
                <Button variant="danger" onClick={() => { const invite = cancelling; setCancelling(null); if (invite) void onCancelInvite(invite.id); }}>{copy('Cancel invitation', 'მოწვევის გაუქმება')}</Button></>} />
    </PageFrame>;
}
