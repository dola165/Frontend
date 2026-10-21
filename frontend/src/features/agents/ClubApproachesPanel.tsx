import { useId, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, EmptyNote, Field, GkRoot, PageFrame, PageHeader, Skeleton, type BadgeTone } from '../../design/primitives';
import { Segmented } from '../../design/Tabs';
import type { ClubApproachAction, ClubApproachStatus } from './clubApproachesApi';
import { PAGE_SIZE, useClubApproaches, type ApproachMode } from './useClubApproaches';
import './club-approaches.css';

interface Props { mode: ApproachMode; clubId?: number }
const phrase = (ka: boolean, en: string, ge: string) => ka ? ge : en;
const ACTIONS: Record<ClubApproachAction, [string, string]> = {
    APPROVE: ['Approve', 'დადასტურება'], ACCEPT: ['Accept', 'მიღება'], DECLINE: ['Decline', 'უარყოფა'], CANCEL: ['Cancel', 'გაუქმება'], END: ['End', 'დასრულება'], REVOKE: ['Revoke', 'გაუქმება'],
};
const CONFIRM = new Set<ClubApproachAction>(['APPROVE', 'DECLINE', 'CANCEL', 'END', 'REVOKE']);
const STATUS: Record<ClubApproachStatus, [string, string, BadgeTone]> = {
    PENDING_PLAYER: ['Waiting for the player', 'მოთამაშის მოლოდინში', 'warning'], PENDING_CLUB: ['Waiting for the club', 'კლუბის მოლოდინში', 'warning'],
    ACTIVE: ['Active', 'აქტიური', 'accent'], DECLINED: ['Declined', 'უარყოფილია', 'neutral'], CANCELLED: ['Cancelled', 'გაუქმებულია', 'neutral'],
    ENDED: ['Ended', 'დასრულებულია', 'neutral'], REVOKED: ['Revoked', 'გაუქმებულია', 'neutral'],
};
const AUDIT: Record<string, [string, string]> = {
    PROPOSED: ['Approach proposed', 'მიმართვა შემოთავაზებულია'], APPROVE: ['Approved by player', 'მოთამაშემ დაადასტურა'], ACCEPT: ['Accepted', 'მიღებულია'],
    DECLINE: ['Declined', 'უარყოფილია'], CANCEL: ['Cancelled', 'გაუქმებულია'], END: ['Ended', 'დასრულებულია'], REVOKE: ['Revoked', 'გაუქმებულია'],
    REPRESENTATION_ENDED: ['Representation ended', 'წარმომადგენლობა დასრულდა'], MESSAGE: ['Message', 'შეტყობინება'],
};
// Older approaches carry a code such as TRIAL as their scope; show it as words.
const scopeText = (scope: string) => /^[A-Z][A-Z_]+$/.test(scope.trim()) ? scope.trim().charAt(0) + scope.trim().slice(1).toLowerCase().replaceAll('_', ' ') : scope;
const auditLabel = (kind: string | null | undefined, ka: boolean) => { const key = kind || 'MESSAGE'; return (AUDIT[key] ?? [key.replaceAll('_', ' '), key.replaceAll('_', ' ')])[ka ? 1 : 0]; };

/**
 * Approaches between an agent, a player and a club. A club sees an approach only after the player approves
 * sharing it. Agents propose; players approve; clubs accept or decline; every step can carry a note and
 * irreversible steps are confirmed first. In the club workspace this is the Agent approaches page.
 */
export function ClubApproachesPanel(props: Props) {
    const { sessionId } = useAuth();
    return <ClubApproachesContent key={`${sessionId}:${props.mode}:${props.clubId ?? 'self'}`} {...props} />;
}

function ClubApproachesContent({ mode, clubId }: Props) {
    const { i18n } = useTranslation();
    const { sessionId } = useAuth();
    const ka = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    const s = useClubApproaches(mode, clubId, sessionId, ka);
    const { proposal, discussion, action, selected } = s;
    const titleId = useId();
    const title = mode === 'agent' ? phrase(ka, 'Player–club approaches', 'მოთამაშე–კლუბის მიმართვები') : mode === 'club' ? phrase(ka, 'Agent approaches', 'აგენტის მიმართვები') : phrase(ka, 'Approaches about you', 'თქვენთან დაკავშირებული მიმართვები');
    const intro = phrase(ka, 'A club sees an approach only after the player approves sharing it.', 'კლუბი მიმართვას ხედავს მხოლოდ მას შემდეგ, რაც მოთამაშე გაზიარებას დაადასტურებს.');
    const newApproach = mode === 'agent' && <Button variant="primary" aria-expanded={proposal.open} onClick={() => proposal.setOpen(value => !value)}><Plus aria-hidden="true" />{phrase(ka, 'New approach', 'ახალი მიმართვა')}</Button>;

    let list: ReactNode;
    if (s.loading) list = <div className="gk-panel ca-list" role="status" aria-label={phrase(ka, 'Loading approaches', 'მიმართვები იტვირთება')}><div className="ca-skeletons">{[0, 1].map(i => <Skeleton key={i} height={56} />)}</div></div>;
    else if (s.error && !s.items.length) list = null;
    else if (!s.items.length) list = <div className="gk-panel ca-list"><EmptyNote title={phrase(ka, 'No approaches here yet.', 'აქ მიმართვები ჯერ არ არის.')}>{phrase(ka, 'An agent can propose contact with a club. The player reviews it first; once approved, the club can respond here.', 'აგენტს შეუძლია კლუბთან დაკავშირება შესთავაზოს მოთამაშეს. მოთამაშის თანხმობის შემდეგ კლუბს აქ შეუძლია პასუხის გაცემა.')}</EmptyNote></div>;
    else list = <div className="gk-panel ca-list"><ul className="gk-list">{s.items.map(item => {
        const [en, ge, tone] = STATUS[item.status] ?? [item.status, item.status, 'neutral'];
        return <li key={item.id}><button type="button" className="gk-list-row ca-row" aria-current={selected?.id === item.id || undefined} onClick={() => s.select(item)}>
            <span className="gk-list-row__main">
                <span className="gk-list-row__title">{mode === 'club' ? item.playerName : item.clubName}</span>
                <span className="gk-list-row__meta">{scopeText(item.scope)}</span>
            </span>
            <span className="gk-list-row__trail"><Badge tone={tone}>{ka ? ge : en}</Badge><ChevronRight aria-hidden="true" className="ca-chevron" /></span>
        </button></li>;
    })}</ul></div>;

    const detail = selected && <section className="gk-panel ca-detail" aria-labelledby={`${titleId}-detail`}>
        <header className="ca-detail__head">
            <h3 id={`${titleId}-detail`} className="ca-detail__title">{selected.playerName} · {selected.clubName}</h3>
            <Badge tone={STATUS[selected.status]?.[2] ?? 'neutral'}>{(STATUS[selected.status] ?? [selected.status, selected.status])[ka ? 1 : 0]}</Badge>
        </header>
        <div className="ca-detail__body">
            <dl className="ca-facts">
                <div><dt>{phrase(ka, 'Agent', 'აგენტი')}</dt><dd>{selected.agentName}</dd></div>
                <div><dt>{phrase(ka, 'Scope', 'საკითხი')}</dt><dd>{scopeText(selected.scope)}</dd></div>
                <div><dt>{phrase(ka, 'Last change', 'ბოლო ცვლილება')}</dt><dd>{new Intl.DateTimeFormat(ka ? 'ka-GE' : 'en-GB', { dateStyle: 'medium' }).format(new Date(selected.updatedAt))}</dd></div>
            </dl>
            {selected.message && <p className="ca-message">{selected.message}</p>}
            {selected.allowedActions.some(raw => raw !== 'MESSAGE') && <div className="ca-actions">{selected.allowedActions.filter(raw => raw !== 'MESSAGE').map(raw => {
                const next = raw as ClubApproachAction;
                return <Button key={next} variant={next === 'APPROVE' || next === 'ACCEPT' ? 'primary' : 'secondary'} disabled={s.busy}
                    onClick={() => CONFIRM.has(next) ? action.setPending(next) : void action.run(next)}>{ACTIONS[next]?.[ka ? 1 : 0] ?? next}</Button>;
            })}</div>}
            {action.pending && <div className="gk-notice gk-notice--warning ca-confirm" role="group" aria-label={phrase(ka, 'Confirm the change', 'ცვლილების დადასტურება')}>
                <p><strong>{phrase(ka, `${ACTIONS[action.pending][0]} this approach?`, `${ACTIONS[action.pending][1]}?`)}</strong> {action.pending === 'APPROVE' ? phrase(ka, 'This shares the approach with the club.', 'ეს მიმართვას კლუბს გაუზიარებს.') : phrase(ka, 'This cannot be undone.', 'ამ ქმედების გაუქმება შეუძლებელია.')}</p>
                <Field label={phrase(ka, 'Note (optional)', 'შენიშვნა (არასავალდებულო)')} htmlFor={`${titleId}-note`}><textarea id={`${titleId}-note`} className="gk-input" maxLength={2000} rows={2} value={action.note} onChange={event => action.setNote(event.target.value)} /></Field>
                <div className="ca-actions">
                    <Button variant="ghost" onClick={() => action.setPending(null)}>{phrase(ka, 'Cancel', 'გაუქმება')}</Button>
                    <Button variant={action.pending === 'APPROVE' ? 'primary' : 'danger'} disabled={s.busy} onClick={() => action.pending && void action.run(action.pending)}>{phrase(ka, 'Confirm', 'დადასტურება')}</Button>
                </div>
            </div>}
            <section className="ca-discussion" aria-labelledby={`${titleId}-discussion`}>
                <h4 id={`${titleId}-discussion`} className="ca-discussion__title"><MessageCircle aria-hidden="true" />{phrase(ka, 'Discussion and record', 'განხილვა და ჩანაწერი')}</h4>
                {discussion.messages.length > 0 ? <ul className="ca-messages">{discussion.messages.map(item => <li key={item.id}>
                    <p><strong>{auditLabel(item.kind, ka)}</strong><span className="ca-faint"> · {item.authorName}</span></p>{item.body && <p className="ca-message">{item.body}</p>}
                </li>)}</ul> : <p className="ca-faint">{phrase(ka, 'No messages yet.', 'შეტყობინებები ჯერ არ არის.')}</p>}
                {discussion.total > PAGE_SIZE && <div className="ca-pages">
                    <Button size="sm" variant="ghost" iconOnly aria-label={phrase(ka, 'Previous discussion page', 'წინა განხილვის გვერდი')} disabled={discussion.page === 0} onClick={() => discussion.setPage(value => value - 1)}><ChevronLeft aria-hidden="true" /></Button>
                    <span className="gk-num">{discussion.page + 1} / {Math.ceil(discussion.total / PAGE_SIZE)}</span>
                    <Button size="sm" variant="ghost" iconOnly aria-label={phrase(ka, 'Next discussion page', 'შემდეგი განხილვის გვერდი')} disabled={(discussion.page + 1) * PAGE_SIZE >= discussion.total} onClick={() => discussion.setPage(value => value + 1)}><ChevronRight aria-hidden="true" /></Button>
                </div>}
                {selected.allowedActions.includes('MESSAGE') && <form className="ca-compose" onSubmit={event => { event.preventDefault(); void discussion.send(); }}>
                    <input className="gk-input" maxLength={2000} value={discussion.body} onChange={event => discussion.setBody(event.target.value)} aria-label={phrase(ka, 'Message', 'შეტყობინება')} placeholder={phrase(ka, 'Write a message', 'დაწერეთ შეტყობინება')} />
                    <Button type="submit" disabled={s.busy || !discussion.body.trim()}>{phrase(ka, 'Send', 'გაგზავნა')}</Button>
                </form>}
            </section>
        </div>
    </section>;

    const body = <div className="ca-stack">
        {proposal.open && <form className="gk-panel ca-new" aria-label={phrase(ka, 'New approach', 'ახალი მიმართვა')} onSubmit={event => { event.preventDefault(); void proposal.submit(); }}>
            <Field label={phrase(ka, 'Player', 'მოთამაშე')} htmlFor={`${titleId}-player`} hint={proposal.options.length === 0 ? phrase(ka, 'No eligible player is available. End any legacy recorded connection, then send and accept a new mutual representation request.', 'შესაბამისი მოთამაშე მიუწვდომელია. დაასრულეთ ძველი კავშირი, შემდეგ გაგზავნეთ და დაადასტურეთ ახალი ორმხრივი წარმომადგენლობის მოთხოვნა.') : undefined}>
                <select id={`${titleId}-player`} className="gk-input" value={proposal.player} onChange={event => proposal.setPlayer(event.target.value)}><option value="">{phrase(ka, 'Select consenting player', 'აირჩიეთ თანხმობის მქონე მოთამაშე')}</option>{proposal.options.map(option => <option key={option.representationRequestId} value={option.representationRequestId}>{option.playerName}</option>)}</select></Field>
            <Field label={phrase(ka, 'Club', 'კლუბი')} htmlFor={`${titleId}-club`}>
                <input id={`${titleId}-club`} className="gk-input" value={proposal.clubQuery} onChange={event => { proposal.setClubQuery(event.target.value); proposal.setClub(null); }} placeholder={phrase(ka, 'Search clubs', 'მოძებნეთ კლუბი')} />
                {proposal.clubs.length > 0 && <ul className="gk-panel ca-suggestions">{proposal.clubs.map(item => <li key={item.id}><button type="button" className="gk-list-row" onClick={() => { proposal.setClub(item); proposal.setClubQuery(item.name); proposal.setClubs([]); }}>{item.name}</button></li>)}</ul>}</Field>
            <Field label={phrase(ka, 'Scope', 'საკითხი')} htmlFor={`${titleId}-scope`}><textarea id={`${titleId}-scope`} className="gk-input" required maxLength={500} rows={2} value={proposal.scope} onChange={event => proposal.setScope(event.target.value)} /></Field>
            <Field label={phrase(ka, 'Message (optional)', 'შეტყობინება (არასავალდებულო)')} htmlFor={`${titleId}-message`}><textarea id={`${titleId}-message`} className="gk-input" maxLength={2000} rows={3} value={proposal.message} onChange={event => proposal.setMessage(event.target.value)} /></Field>
            <div><Button type="submit" variant="primary" disabled={s.busy || !proposal.player || !proposal.club || !proposal.scope.trim()}>{s.busy ? phrase(ka, 'Sending…', 'იგზავნება…') : phrase(ka, 'Send for player approval', 'გაგზავნა მოთამაშის დასადასტურებლად')}</Button></div>
        </form>}
        <div className="ca-toolbar">
            <Segmented label={phrase(ka, 'Approaches to show', 'საჩვენებელი მიმართვები')} value={s.view} onChange={view => { if (!s.busy) { s.setView(view); s.setPage(0); } }}
                items={[{ id: 'OPEN', label: phrase(ka, 'Open', 'აქტიური') }, { id: 'HISTORY', label: phrase(ka, 'History', 'ისტორია') }]} />
            <Button variant="ghost" iconOnly aria-label={phrase(ka, 'Refresh approaches', 'მიმართვების განახლება')} onClick={() => void s.refresh()}><RefreshCw aria-hidden="true" /></Button>
        </div>
        {s.error && <div className="gk-notice gk-notice--danger" role="alert"><span className="ca-grow">{s.error}</span><Button size="sm" onClick={() => void s.refresh()}>{phrase(ka, 'Retry', 'თავიდან ცდა')}</Button></div>}
        <div className={selected ? 'ca-layout ca-layout--detail' : 'ca-layout'}>
            <div className="ca-stack ca-stack--tight">
                {list}
                {s.pages > 1 && <div className="ca-pages">
                    <Button size="sm" variant="ghost" iconOnly disabled={s.busy || s.page === 0} onClick={() => s.setPage(p => p - 1)} aria-label={phrase(ka, 'Previous page', 'წინა გვერდი')}><ChevronLeft aria-hidden="true" /></Button>
                    <span className="gk-num">{s.page + 1} / {s.pages}</span>
                    <Button size="sm" variant="ghost" iconOnly disabled={s.busy || s.page + 1 >= s.pages} onClick={() => s.setPage(p => p + 1)} aria-label={phrase(ka, 'Next page', 'შემდეგი გვერდი')}><ChevronRight aria-hidden="true" /></Button>
                </div>}
            </div>
            {detail}
        </div>
    </div>;

    if (mode === 'club') return <PageFrame className="cw-page"><PageHeader title={title} subtitle={intro} />{body}</PageFrame>;
    return <GkRoot className="ca-panel"><section className="gk-panel ca-section" aria-labelledby={titleId}>
        <header className="ca-section__head"><div><h2 id={titleId} className="ca-section__title">{title}</h2><p className="ca-faint">{intro}</p></div>{newApproach}</header>
        <div className="ca-section__body">{body}</div>
    </section></GkRoot>;
}
