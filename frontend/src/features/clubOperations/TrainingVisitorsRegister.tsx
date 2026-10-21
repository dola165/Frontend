import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Skeleton } from '../../design/primitives';
import { useVisitorAttendance } from '../squadCommunication/useVisitorAttendance';
import { introductoryVisitors, type IntroductoryVisitor, type IntroductoryVisitorRegister } from '../squadCommunication/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../utils/apiError';
import './records/records.css';

/**
 * Introductory visitors at one training session, in the same rows as the register above them. Visitors are
 * not squad members: their attendance is recorded against their joining case, never as regular attendance.
 */
export function TrainingVisitorsRegister({ squad, session, revision, onHistoricalPlayers }: { squad: number; session: number; revision: number; onHistoricalPlayers?: (ids: number[]) => void }) {
    const copy = useJourneyCopy(), [reload, setReload] = useState(0);
    const scope = `${squad}:${session}:${revision}:${reload}`;
    const [result, setResult] = useState<{ scope: string; data: IntroductoryVisitorRegister | null; error: string } | null>(null);
    const data = result?.scope === scope ? result.data : null, error = result?.scope === scope ? result.error : '';
    useEffect(() => {
        const controller = new AbortController(); onHistoricalPlayers?.([]);
        void introductoryVisitors(squad, session, controller.signal).then(value => {
            if (controller.signal.aborted) return;
            setResult({ scope, data: value, error: '' });
            // Visitors who later joined appear once, here, rather than again as regular roster rows.
            onHistoricalPlayers?.(value.visitors.filter(row => ['CONFIRMED', 'ATTENDED', 'NO_SHOW'].includes(row.status)).map(row => row.playerId));
        }).catch(failure => { if (!controller.signal.aborted) setResult({ scope, data: null, error: extractApiErrorMessage(failure, copy('Introductory visitors could not load.', 'გაცნობითი სესიის სტუმრები ვერ ჩაიტვირთა.')) }); });
        return () => controller.abort();
    }, [squad, session, scope, onHistoricalPlayers, copy]);
    if (error) return <div className="rec-visitors"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => setReload(n => n + 1)}>{copy('Reload visitors', 'სტუმრების განახლება')}</Button></div></div>;
    if (!data) return <div className="rec-visitors" role="status" aria-label={copy('Loading introductory visitors…', 'გაცნობითი სესიის სტუმრები იტვირთება…')}><Skeleton height={44} /></div>;
    return <VisitorRows squad={squad} session={session} revision={data.sessionRevision} visitors={data.visitors} onSaved={() => setReload(n => n + 1)} />;
}

function VisitorRows({ squad, session, revision, visitors, onSaved }: { squad: number; session: number; revision: number; visitors: IntroductoryVisitor[]; onSaved: () => void }) {
    const { copy, rows, choice, busy, error, permission, record, pendingFor, select } = useVisitorAttendance({ squadId: squad, sessionId: session, revision, visitors, onSaved });
    if (!rows.length) return null;
    const title = copy('Introductory visitors', 'გაცნობითი სესიის სტუმრები');
    return <section className="rec-visitors" aria-label={title}>
        <div className="rec-visitors__head"><h3>{title}</h3><p className="gk-muted">{copy('Record what happened at this introduction. Visitors have no regular squad membership or availability reply.', 'ჩაწერეთ ამ გაცნობით სესიაზე ფაქტობრივი დასწრება. სტუმრებს არ აქვთ გუნდის რეგულარული წევრობა ან ხელმისაწვდომობის პასუხი.')}</p></div>
        <ul className="gk-list" aria-label={title}>{rows.map(row => {
            const done = row.status === 'ATTENDED' || row.status === 'NO_SHOW', retrying = Boolean(pendingFor(row));
            return <li key={row.participationId}><div className="gk-list-row rec-register-row">
                <span className="gk-list-row__lead"><Avatar name={row.name} size={36} /></span>
                <span className="gk-list-row__main"><span className="gk-list-row__title">{row.name}</span>
                    <span className="gk-list-row__meta rec-visitors__meta">{[permission(row), row.emergencyContact && `${copy('Emergency contact', 'საგანგებო კონტაქტი')}: ${row.emergencyContact}`].filter(Boolean).join(' · ')}</span></span>
                <span className="gk-list-row__trail rec-register-actions">
                    {done ? <Badge tone={row.status === 'ATTENDED' ? 'accent' : 'danger'}>{row.status === 'ATTENDED' ? copy('Attended', 'დაესწრო') : copy('Did not attend', 'არ დაესწრო')}</Badge>
                        : row.canRecord ? <>
                            <select className="gk-input rec-visitors__choice" aria-label={`${copy('Actual attendance for', 'ფაქტობრივი დასწრება მოთამაშისთვის')} ${row.name}`} disabled={busy !== null || retrying}
                                value={pendingFor(row)?.attendance ?? choice[row.participationId] ?? ''} onChange={event => select(row, event.target.value as 'ATTENDED' | 'NO_SHOW')}>
                                <option value="" disabled>{copy('Choose actual attendance', 'აირჩიეთ ფაქტობრივი დასწრება')}</option>
                                <option value="ATTENDED">{copy('Attended', 'დაესწრო')}</option><option value="NO_SHOW">{copy('Did not attend', 'არ დაესწრო')}</option>
                            </select>
                            <Button size="sm" variant="secondary" disabled={busy !== null || (!choice[row.participationId] && !retrying)} onClick={() => void record(row)}
                                aria-label={`${retrying ? copy('Retry attendance for', 'დასწრების ხელახლა შემოწმება მოთამაშისთვის') : copy('Save attendance for', 'დასწრების შენახვა მოთამაშისთვის')} ${row.name}`}>
                                {busy === row.participationId ? copy('Saving…', 'ინახება…') : retrying ? copy('Retry', 'ხელახლა') : copy('Save', 'შენახვა')}</Button>
                        </> : row.permissionStatus === 'CURRENT' ? <span className="gk-faint rec-visitors__wait">{copy('Recorded after the session starts', 'ჩაიწერება სესიის დაწყების შემდეგ')}</span> : null}
                </span>
            </div></li>;
        })}</ul>
        {error && <div className="rec-visitors__error"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" disabled={busy !== null} onClick={onSaved}>{copy('Reload latest session', 'სესიის განახლება')}</Button></div></div>}
    </section>;
}
