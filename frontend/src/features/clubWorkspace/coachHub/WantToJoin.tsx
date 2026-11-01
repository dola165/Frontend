import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, ButtonLink, LoadFailed, Panel, Section } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { relativeTime } from '../../../utils/relativeTime';
import { formatDateTime } from '../../../utils/formatting';
import { squadLabel } from '../../../components/squads/squadLabels';
import { useCopy } from '../../../locales/useCopy';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import * as squadApi from '../../squadCommunication/api';
import { inviteToTrial, notNow } from './squadApi';
import { isJoinCase, type WantToJoinItem } from './useSquadCards';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';
import './squad-page.css';

type Step = 'ACCEPT' | 'TRIAL' | 'NOT_NOW';

/**
 * Want to join, at the top of Players (decision 2): applications, admission requests, join-code requests, and a family's
 * own requests to a group or the first visits they booked (step 5) in one list, newest first, each with its next step
 * (a visit reserved until the child's current club gives permission leads to recording it). Only the squad's head and assistant coaches, the head of coaching and
 * admins get it. The first answer counts; a later one is told who answered, and the list shows it. A list that failed
 * to load says so (`failed`), with Try again.
 */
export function WantToJoin({ items, failed = false, onRetry, data, onChanged }: { items: WantToJoinItem[]; failed?: boolean; onRetry?: () => void; data: CoachData; onChanged: () => void }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const { t } = useTranslation();
    const [busy, setBusy] = useState<string | null>(null), [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
    const several = data.shown.length > 1;
    const act = async (item: WantToJoinItem, step: Step) => {
        setBusy(item.key); setNotice(null);
        try {
            if (item.kind === 'APPLICATION') await (step === 'TRIAL' ? inviteToTrial(item.id) : notNow(item.id));
            else {
                const request = item.request!, group = request.groups.length === 1 ? request.groups[0] : null;
                const body: squadApi.SquadJoinDecision = { requestId: crypto.randomUUID(), expectedVersion: request.version,
                    action: step === 'ACCEPT' ? 'APPROVE' : step === 'TRIAL' ? 'REVIEW' : 'DECLINE', groupId: step === 'NOT_NOW' ? null : group?.id ?? null, groupVersion: step === 'NOT_NOW' ? null : group?.version ?? null };
                await (isJoinCase(item) ? squadApi.decideJoinCase(item.squadId!, request.caseId ?? item.id, body) : squadApi.decideJoinRequest(item.squadId!, item.id, body));
            }
            setNotice({ tone: 'success', text: copy(step === 'ACCEPT' ? 'acceptedNotice' : step === 'TRIAL' ? 'trialNotice' : 'notNowNotice', { name: item.name }) });
        } catch (error) { setNotice({ tone: 'danger', text: extractApiErrorMessage(error, copy('answerFailed')) }); }
        finally { setBusy(null); onChanged(); }
    };
    const meta = (item: WantToJoinItem) => [item.age ? copy('years', { count: item.age }) : null, item.position ? squadLabel(item.position, t).toLowerCase() : null,
        item.source === 'WORLD' ? copy('appliedWhen', { when: relativeTime(item.createdAt) }) : item.source === 'LINK' ? copy('askedWithCode')
            : item.source === 'VISIT' && item.request?.visit ? copy(item.request.visit.status === 'INVITED' ? 'firstVisitReserved' : 'firstVisitOn', { when: formatDateTime(item.request.visit.startsAt) })
            : item.source === 'GROUP' && item.request?.groups[0] ? copy('askedForGroup', { group: item.request.groups[0].name }) : copy('askedTheClub'),
        several && item.squadId ? data.names.get(item.squadId) : null].filter(Boolean).join(' · ');
    const steps = (item: WantToJoinItem) => {
        if (item.state === 'TRIAL') return <span className="cw-status cw-status--warning ch-join__state"><span className="cw-dot cw-dot--warning" aria-hidden="true" />{copy('afterTrial')}</span>;
        if (item.state === 'ANSWERED') return <span className="ch-quiet ch-join__state">{item.answeredBy ? copy('answeredBy', { name: item.answeredBy }) : copy('answered')}</span>;
        // A request through the join code or an admission goes into the squad's joining group; without one, set it up first.
        const groupless = item.kind === 'REQUEST' && item.request!.groups.length !== 1;
        if (groupless && item.request!.setup.destination) return <ButtonLink size="sm" variant="ghost" className="ch-join__state" to={item.request!.setup.destination}>{copy('setUpJoining')}</ButtonLink>;
        // A family's own request to a group, or a first visit they booked, is a joining case: Accept or Not now here, the
        // rest (a session to invite them to, the visit itself) in the request.
        const joinCase = isJoinCase(item);
        return <span className="ch-join__steps">
            {item.kind === 'REQUEST' && !groupless && <Button size="sm" variant="primary" disabled={busy === item.key} onClick={() => void act(item, 'ACCEPT')}>{copy('accept')}</Button>}
            {joinCase ? <ButtonLink size="sm" variant={item.request?.visit?.status === 'INVITED' ? 'primary' : undefined} to={item.request!.destination}>{copy(item.request?.visit?.status === 'INVITED' ? 'recordPermission' : 'openRequest')}</ButtonLink>
                : !groupless && <Button size="sm" disabled={busy === item.key} onClick={() => void act(item, 'TRIAL')}>{copy('inviteToTrial')}</Button>}
            <Button size="sm" variant="ghost" disabled={busy === item.key} onClick={() => void act(item, 'NOT_NOW')}>{copy('notNow')}</Button>
        </span>;
    };
    const waiting = items.filter(item => item.state === 'DECIDE').length;
    return <Section boxed title={copy('wantToJoin')} hint={waiting ? copy('waitingCount', { count: waiting }) : undefined}>
        <Panel flush>
            {items.length > 0 && <ul className="ch-join" aria-label={copy('wantToJoin')}>{items.map(item => <li key={item.key} className="ch-join__row" data-state={item.state}>
                <Avatar name={item.name} size={34} />
                <span className="ch-join__who"><strong>{item.name}</strong><span className="ch-quiet">{meta(item)}</span></span>
                {item.state === 'DECIDE' && <span className="cw-status cw-status--warning ch-join__decide"><span className="cw-dot cw-dot--warning" aria-hidden="true" />{copy('decide')}</span>}
                {steps(item)}
            </li>)}</ul>}
            {failed && onRetry && <LoadFailed text={copy('couldntLoad')} retry={copy('tryAgain')} onRetry={onRetry} />}
            {notice && <p className={`gk-notice ${notice.tone === 'danger' ? 'gk-notice--danger' : 'cw-notices__success'} ch-join__notice`} role="status">{notice.text}</p>}
        </Panel>
    </Section>;
}
