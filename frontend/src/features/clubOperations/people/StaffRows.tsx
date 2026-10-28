import { Link } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { Avatar, Button } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import type { ClubMembershipInvite } from '../../clubs/domain';
import { formatDate } from '../../../utils/formatting';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useNow } from '../../clubWorkspace/useNow';
import type { NameCheck, Specialist, Suggestion } from './api';
import { useJobWords } from './jobWords';

/**
 * What needs an admin on Staff: head coaches' suggestions (Confirm or Decline; the first answer counts) and invites
 * accepted under another name (Keep or Undo). A head coach sees their own suggestions waiting, and can withdraw them.
 * A dot in front, the state in words, the decision behind.
 */
export function StaffNeeds({ suggestions, nameChecks, me, admin, busy, onDecide, onSettle }: {
    suggestions: Suggestion[]; nameChecks: NameCheck[]; me: number; admin: boolean; busy: boolean;
    onDecide: (suggestion: Suggestion, decision: 'confirm' | 'decline' | 'withdraw') => void;
    onSettle: (check: NameCheck, outcome: 'keep' | 'undo') => void;
}) {
    const { copy, jobLabel, whereLabel } = useJobWords();
    if (!suggestions.length && !nameChecks.length) return null;
    return <ul className="pp-waiting" aria-label={admin ? copy('Needs you', 'თქვენ გელოდებათ') : copy('Your suggestions', 'თქვენი შეთავაზებები')}>
        {suggestions.map(({ person, job }) => {
            const decides = job.canConfirm ?? admin, mine = job.suggestedById === me;
            return <li key={`s-${job.id}`} className="pp-waiting__row">
                <span className="cw-dot cw-dot--warning" aria-hidden="true" />
                <span className="pp-waiting__text">
                    <strong>{mine ? person.name : copy(`${job.suggestedByName ?? 'A head coach'} suggests ${person.name}`, `${job.suggestedByName ?? 'მთავარი მწვრთნელი'} გთავაზობთ: ${person.name}`)}</strong>
                    <span className="gk-muted">{jobLabel(job)} · {whereLabel(job)}</span>
                </span>
                <span className="cw-status cw-status--warning">{decides ? copy('Decide', 'გადაწყვიტეთ') : copy('Waiting for an admin', 'ადმინს ელოდება')}</span>
                <span className="gk-row pp-waiting__actions">{decides ? <>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => onDecide({ person, job }, 'confirm')}>{copy('Confirm', 'დადასტურება')}</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide({ person, job }, 'decline')}>{copy('Decline', 'უარყოფა')}</Button>
                </> : mine && job.canEnd !== false && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide({ person, job }, 'withdraw')}>{copy('Withdraw', 'გაუქმება')}</Button>}</span>
            </li>;
        })}
        {nameChecks.map(check => <li key={`n-${check.id}`} className="pp-waiting__row">
            <span className="cw-dot cw-dot--warning" aria-hidden="true" />
            <span className="pp-waiting__text">
                <strong>{copy(`The invite for ${check.invitedName} was accepted by ${check.acceptedName}`, `${check.invitedName}-ის მოწვევა მიიღო ${check.acceptedName}-მ`)}</strong>
            </span>
            <span className="cw-status cw-status--warning">{copy('Decide', 'გადაწყვიტეთ')}</span>
            <span className="gk-row pp-waiting__actions">
                <Button size="sm" disabled={busy} onClick={() => onSettle(check, 'keep')}>{copy('Keep', 'დატოვება')}</Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => onSettle(check, 'undo')}>{copy('Undo', 'გაუქმება')}</Button>
            </span>
        </li>)}
    </ul>;
}

/** An older club invitation nobody has answered yet (a coach, an admin, a player): Waiting, with Cancel for admins. */
export function InvitationRow({ invite, canCancel, busy, onCancel }: { invite: ClubMembershipInvite; canCancel: boolean; busy: boolean; onCancel: () => void }) {
    const { copy } = useJobWords();
    const name = invite.fullName || invite.username;
    const role = ({ OWNER: copy('Owner', 'მფლობელი'), CLUB_ADMIN: copy('Admin', 'ადმინი'), COACH: copy('Coach', 'მწვრთნელი'), PLAYER: copy('Player', 'მოთამაშე'), AGENT: copy('Agent', 'აგენტი') } as Record<string, string>)[invite.role] ?? invite.role;
    const sent = invite.createdAt ? formatDate(invite.createdAt, { day: 'numeric', month: 'short' }) : null;
    return <li className="pp-person pp-person--plain">
        <div className="pp-person__head">
            <Avatar src={resolveMediaUrl(invite.avatarUrl) || null} name={name} size={40} />
            <div className="pp-person__who"><strong className="pp-person__name">{name}</strong>
                <span className="gk-muted pp-person__sub">{[role, sent && copy(`invited ${sent}`, `მოწვეულია ${sent}`)].filter(Boolean).join(' · ')}</span></div>
        </div>
        <div className="pp-jobs"><Status tone="warning">{copy('Waiting', 'ელოდება')}</Status></div>
        <div className="pp-person__actions">{canCancel && <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={onCancel}
            aria-label={copy(`Cancel the invitation for ${name}`, `მოწვევის გაუქმება: ${name}`)}><Ban aria-hidden="true" />{copy('Cancel invite', 'მოწვევის გაუქმება')}</Button>}</div>
    </li>;
}

/** An outside specialist the club works with now, listed in Staff with their own job; the record opens in Specialists. */
export function SpecialistRow({ specialist, href }: { specialist: Specialist; href: string | null }) {
    const { copy } = useJobWords();
    const now = useNow();
    const until = specialist.endsAt ? formatDate(specialist.endsAt, { day: 'numeric', month: 'short' }) : null;
    // An engagement that starts later says when ("from 4 Nov").
    const from = specialist.startsAt && new Date(specialist.startsAt).getTime() > now ? formatDate(specialist.startsAt, { day: 'numeric', month: 'short' }) : null;
    const contact = specialist.contact?.trim() || null;
    const email = contact && /^[^\s@<>()"]+@[^\s@<>()"]+\.[^\s@<>()"]+$/.test(contact) ? contact : null;
    return <li className="pp-person pp-person--plain">
        <div className="pp-person__head">
            <Avatar name={specialist.name} size={40} />
            <div className="pp-person__who"><strong className="pp-person__name">{href ? <Link to={href}>{specialist.name}</Link> : specialist.name}</strong>
                <span className="gk-muted pp-person__sub">{[specialist.specialisation ?? copy('Specialist', 'სპეციალისტი'), copy('outside specialist', 'გარე სპეციალისტი')].join(' · ')}</span></div>
        </div>
        <div className="pp-jobs pp-contacts">{contact && (email ? <a href={`mailto:${encodeURIComponent(email).replace('%40', '@')}`}>{email}</a> : /^[+\d][\d\s()-]{5,}$/.test(contact) ? <a href={`tel:${contact.replace(/[^+\d]/g, '')}`}>{contact}</a> : <span>{contact}</span>)}
            {from ? <span className="gk-faint">{copy(`from ${from}`, `${from}-დან`)}</span> : until && <span className="gk-faint">{copy(`until ${until}`, `${until}-მდე`)}</span>}</div>
    </li>;
}
