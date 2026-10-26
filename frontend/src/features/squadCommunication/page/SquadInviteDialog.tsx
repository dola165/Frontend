import { useEffect, useRef, useState } from 'react';
import { Check, Link2Off, RefreshCw, X } from 'lucide-react';
import { Avatar, Button, ButtonLink } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../api';
import { useJourneyCopy } from '../journeyCopy';
import { SquadApproveAll } from './SquadApproveAll';
import { LinkShare } from '../../../components/share/LinkShare';
import type { JoinRequests } from './useJoinRequests';


/**
 * Joining needs both sides: the coach shares the link (Copy, WhatsApp, or the QR code printed for the training
 * ground), the family says who's joining, the coach says yes, one at a time or all at once. The link is one per squad;
 * a new one stops the old one at once, and switching it off keeps every request already made. The yes routes the
 * request into the squad's joining group and offers the place; the family accepts the terms. Another parent asking
 * to be linked to a child already here shows below; their child's parent confirms them.
 */
export function SquadInviteDialog({ space, requests, onClose, onAnswered }: { space: api.SquadOverview; requests: JoinRequests; onClose: () => void; onAnswered: () => void }) {
    const copy = useJourneyCopy();
    const [link, setLink] = useState<api.SquadJoinLink | null>(null), [linkError, setLinkError] = useState(''), [error, setError] = useState('');
    const [busy, setBusy] = useState<'link' | number | null>(null), [approved, setApproved] = useState('');
    // One request id per intended change, kept across retries so a repeated click never makes a second link or decision.
    const pending = useRef(new Map<string, string>());
    const requestIdFor = (key: string) => { const found = pending.current.get(key); if (found) return found; const made = crypto.randomUUID(); pending.current.set(key, made); return made; };
    useEffect(() => {
        const abort = new AbortController();
        void api.joinLink(space.id, abort.signal).then(found => { if (!abort.signal.aborted) setLink(found); }).catch(e => { if (!abort.signal.aborted) setLinkError(extractApiErrorMessage(e, copy('The join link could not load.', 'ბმული ვერ ჩაიტვირთა.'))); });
        return () => abort.abort();
    }, [space.id, copy]);
    const url = link?.path ? `${window.location.origin}${link.path}` : '';
    const changeLink = async (action: 'create' | 'rotate' | 'disable') => {
        if (busy) return;
        if (action === 'rotate' && !window.confirm(copy('Make a new link? The old one and its printed QR code stop working at once.', 'შეიქმნას ახალი ბმული? ძველი და მისი დაბეჭდილი QR კოდი მაშინვე გაუქმდება.'))) return;
        if (action === 'disable' && !window.confirm(copy('Switch the link off? Requests already made stay.', 'გაითიშოს ბმული? უკვე გაგზავნილი მოთხოვნები რჩება.'))) return;
        setBusy('link'); setError('');
        try {
            setLink(action === 'disable' ? await api.disableJoinLink(space.id) : await api.createJoinLink(space.id, { requestId: requestIdFor(`${action}:${link?.code ?? 'none'}`) }));
            pending.current.delete(`${action}:${link?.code ?? 'none'}`);
        } catch (e) { setError(extractApiErrorMessage(e, copy('Could not save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(null); }
    };
    const decide = async (request: api.SquadJoinRequest, action: 'APPROVE' | 'DECLINE', group?: api.SquadJoinGroup) => {
        if (busy) return;
        if (action === 'DECLINE' && !window.confirm(copy(`Decline ${request.childName}? The family is told.`, `უარი ${request.childName}-ს? ოჯახი შეიტყობს.`))) return;
        const key = `${request.id}:${request.version}:${action}:${group?.id ?? ''}`;
        setBusy(request.id); setError(''); setApproved('');
        try {
            await api.decideJoinRequest(space.id, request.id, { requestId: requestIdFor(key), expectedVersion: request.version, action, groupId: group?.id ?? null, groupVersion: group?.version ?? null });
            pending.current.delete(key); requests.refresh(); onAnswered();
        } catch (e) { setError(extractApiErrorMessage(e, copy('Could not save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(null); }
    };
    const expiry = link?.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : null;
    const waiting = requests.items ?? [];
    return <Dialog open size="md" title={copy('Invite players', 'მოთამაშეების მოწვევა')} description={space.name} onClose={onClose}>
        <div className="sp-invite">
            <p className="sp-quiet">{copy('One link for the squad: share it in the parents’ group or print the QR code. Each family says who’s joining; you say yes here.', 'ერთი ბმული გუნდისთვის: გააზიარეთ მშობლების ჯგუფში ან დაბეჭდეთ QR კოდი. ოჯახი ირჩევს, ვინ წევრიანდება; თქვენ ადასტურებთ აქ.')}</p>
            {linkError ? <p className="gk-notice gk-notice--danger" role="alert">{linkError}</p>
                : !link ? <p className="sp-quiet" role="status">{copy('Loading…', 'იტვირთება…')}</p>
                : link.status === 'ACTIVE' ? <>
                    <LinkShare url={url} title={copy(`Join ${space.name}`, `შემოუერთდით: ${space.name}`)} subtitle={space.academy_name} message={`${space.name} · ${space.academy_name}`} label={copy('Join link', 'გაწევრიანების ბმული')} onError={setError} />
                    <div className="sp-invite__manage">
                        <small className="sp-quiet">{expiry ? copy(`Works until ${expiry}.`, `მოქმედებს ${expiry}-მდე.`) : copy('Works until you switch it off.', 'მოქმედებს გათიშვამდე.')}{link.createdByName ? ` · ${copy(`made by ${link.createdByName}`, `შექმნა ${link.createdByName}`)}` : ''}</small>
                        <Button size="sm" variant="ghost" disabled={busy === 'link'} onClick={() => void changeLink('rotate')}><RefreshCw aria-hidden="true" />{copy('New link', 'ახალი ბმული')}</Button>
                        <Button size="sm" variant="ghost" disabled={busy === 'link'} onClick={() => void changeLink('disable')}><Link2Off aria-hidden="true" />{copy('Switch off', 'გათიშვა')}</Button>
                    </div>
                </>
                : <div className="sp-invite__manage">
                    <small className="sp-quiet">{link.status === 'DISABLED' ? copy('The link is switched off. Requests already made stay.', 'ბმული გათიშულია. გაგზავნილი მოთხოვნები რჩება.') : link.status === 'EXPIRED' ? copy('The link has run out.', 'ბმულს ვადა გაუვიდა.') : copy('No link yet.', 'ბმული ჯერ არ არის.')}</small>
                    <Button variant="primary" disabled={busy === 'link'} onClick={() => void changeLink('create')}>{copy(link.status === 'NONE' ? 'Create link' : 'Make a new link', link.status === 'NONE' ? 'ბმულის შექმნა' : 'ახალი ბმულის შექმნა')}</Button>
                </div>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="sp-invite__waiting">
                <h3 className="sp-invite__head">{copy('Waiting for you', 'გელოდებათ')}</h3>
                {waiting.length > 1 && <SquadApproveAll squadId={space.id} requests={waiting} size="sm" onDone={result => { setApproved(copy(`${result.approved} offered a place in ${result.groupName}. Families accept the terms next.`, `${result.approved} მიიღო ადგილის შეთავაზება (${result.groupName}). შემდეგ ოჯახები პირობებს ეთანხმებიან.`)); requests.refresh(); onAnswered(); }} />}
            </div>
            {approved && <p className="sp-done" role="status">{approved}</p>}
            {requests.failed ? <p className="gk-notice gk-notice--danger" role="alert">{copy('The waiting list could not load.', 'მომლოდინეთა სია ვერ ჩაიტვირთა.')} <button type="button" className="sp-link" onClick={requests.refresh}>{copy('Try again', 'ხელახლა ცდა')}</button></p>
                : requests.items === null ? <p className="sp-quiet" role="status">{copy('Loading…', 'იტვირთება…')}</p>
                : waiting.length ? <ul className="sp-requests">{waiting.map(request => <RequestRow key={request.id} request={request} busy={busy === request.id} onDecide={decide} />)}</ul>
                : <p className="sp-quiet">{copy('Nobody is waiting.', 'არავინ ელოდება.')}</p>}
            <ParentLinks squadId={space.id} />
        </div>
    </Dialog>;
}

/** One child: who asked and when; Add offers the place in the squad's joining group, or points to setting one up first. */
function RequestRow({ request, busy, onDecide }: { request: api.SquadJoinRequest; busy: boolean; onDecide: (request: api.SquadJoinRequest, action: 'APPROVE' | 'DECLINE', group?: api.SquadJoinGroup) => Promise<void> }) {
    const copy = useJourneyCopy();
    const [group, setGroup] = useState<number>(request.groups[0]?.id ?? 0);
    const chosen = request.groups.find(item => item.id === group) ?? request.groups[0];
    const meta = [request.birthYear ? copy(`born ${request.birthYear}`, `დაბ. ${request.birthYear}`) : null, request.guardianName, request.source === 'LINK' ? copy('from the link', 'ბმულით') : copy('asked to join', 'მოითხოვა')].filter(Boolean).join(' · ');
    return <li>
        <Avatar name={request.childName} size={32} />
        <span className="sp-requests__text"><strong>{request.childName}</strong><small>{meta}</small>
            {request.groups.length > 1 && <select className="gk-input sp-requests__group" aria-label={copy(`Joining group for ${request.childName}`, `${request.childName} — ჯგუფი`)} value={chosen?.id} onChange={e => setGroup(Number(e.target.value))}>{request.groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</span>
        {chosen ? <Button size="sm" variant="primary" disabled={busy} onClick={() => void onDecide(request, 'APPROVE', chosen)}><Check aria-hidden="true" />{copy('Add', 'დამატება')}</Button>
            : <ButtonLink size="sm" variant="secondary" to={request.setup.destination ?? request.destination} title={copy('The squad has no joining terms yet. Set them up, then say yes here.', 'გუნდს გაწევრიანების პირობები ჯერ არ აქვს. შექმენით და დაადასტურეთ აქ.')}>{copy('Set up terms', 'პირობების შექმნა')}</ButtonLink>}
        <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Decline ${request.childName}`, `უარი: ${request.childName}`)} disabled={busy} onClick={() => void onDecide(request, 'DECLINE')}><X aria-hidden="true" /></Button>
    </li>;
}

/**
 * Another parent says a child here is theirs too. Their child's parent confirms them from a notice; the coach may
 * only link a child who has no parent yet, and may decline a mistake. Shown only when there is one.
 */
function ParentLinks({ squadId }: { squadId: number }) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<api.SquadParentLink[]>([]), [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState('');
    useEffect(() => {
        const abort = new AbortController();
        void api.parentLinks(squadId, abort.signal).then(found => { if (!abort.signal.aborted) setItems(found); }).catch(() => { /* Nothing to show. */ });
        return () => abort.abort();
    }, [squadId, revision]);
    if (!items.length) return null;
    const answer = async (item: api.SquadParentLink, accept: boolean) => {
        if (busy) return;
        if (!accept && !window.confirm(copy(`Decline ${item.requesterName}'s request? They are told it was not confirmed.`, `უარი ${item.requesterName}-ს? შეიტყობს, რომ არ დადასტურდა.`))) return;
        setBusy(item.id); setError('');
        try { await api.answerParentLink(squadId, item.id, accept); setRevision(n => n + 1); }
        catch (e) { setError(extractApiErrorMessage(e, copy('Could not save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(null); }
    };
    return <>
        <h3 className="sp-invite__head">{copy('Parents asking to be linked', 'მშობლები, რომლებიც დაკავშირებას ითხოვენ')}</h3>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <ul className="sp-requests">{items.map(item => { const child = item.childName.split(' ')[0]; return <li key={item.id}>
            <Avatar name={item.requesterName} size={32} />
            <span className="sp-requests__text"><strong>{copy(`${item.requesterName} · ${child}’s parent?`, `${item.requesterName} · ${child}-ს მშობელი?`)}</strong><small>{item.canLink ? copy(`${child} has no parent linked yet.`, `${child}-ს მშობელი ჯერ არ ჰყავს.`) : copy(`${child}’s parent confirms them.`, `ადასტურებს ${child}-ს მშობელი.`)}</small></span>
            {item.canLink && <Button size="sm" variant="primary" disabled={busy === item.id} onClick={() => void answer(item, true)}><Check aria-hidden="true" />{copy('Link', 'დაკავშირება')}</Button>}
            <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Decline ${item.requesterName}`, `უარი: ${item.requesterName}`)} disabled={busy === item.id} onClick={() => void answer(item, false)}><X aria-hidden="true" /></Button>
        </li>; })}</ul>
    </>;
}
