import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, FixtureRow, List, ListRow, Section, Skeleton } from '../../design/primitives';
import { requestDestination } from '../requests/api';
import { requestIcon } from '../requests/requestIcon';
import { dayLabel, timeLabel } from '../clubWorkspace/fixtures';
import type { WorldData } from '../world/useWorldData';
import type { SquadSpace } from '../squadCommunication/api';
import { useThisWeek } from './useThisWeek';

const SHOWN = 4;
const DECISIONS = 2;

/** The first block on Home: what is on in the next seven days, and the decisions waiting for me. */
export function ThisWeek({ spaces }: { spaces: WorldData<SquadSpace[]> }) {
    const week = useThisWeek(spaces);
    const shown = week.entries.slice(0, SHOWN);
    const more = week.entries.length - shown.length;
    const decisions = week.decisions.slice(0, DECISIONS);
    const waitingTotal = Math.max(week.decisionCount, week.decisions.length);
    return (
        <Section title="This week" id="home-week" hint={week.entries.length ? `${week.entries.length} ${week.entries.length === 1 ? 'entry' : 'entries'} in the next 7 days` : undefined}
            action={{ label: 'Open schedule', to: '/calendar' }}>
            <div className="gk-home-week">
                {week.scheduleLoading ? <div className="gk-home-week__loading" role="status" aria-label="Loading this week"><Skeleton height={48} /><Skeleton height={48} /></div>
                    : week.scheduleError && !week.entries.length ? <p className="gk-notice gk-notice--danger gk-home-week__notice" role="alert">{week.scheduleError} <Button size="sm" onClick={week.retrySchedule}>Try again</Button></p>
                        : !week.entries.length ? <EmptyNote title="Nothing planned for the next 7 days" action={<Link className="gk-section__action" to="/calendar">Open schedule</Link>}>
                            Sessions and matches for your squads and your own calendar appear here.</EmptyNote>
                            : <List label="This week">{shown.map(entry => (
                                <FixtureRow key={entry.key} time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={entry.title} meta={entry.meta || undefined}
                                    tone={entry.tone} to={entry.to} trail={<Badge tone={entry.badge.tone}>{entry.badge.label}</Badge>} />
                            ))}</List>}
                {!week.scheduleLoading && week.scheduleError && week.entries.length > 0 && <p className="gk-notice gk-notice--warning gk-home-week__notice" role="status">Some entries could not load. <Button size="sm" variant="ghost" onClick={week.retrySchedule}>Try again</Button></p>}
                {more > 0 && <Link className="gk-home-week__more" to="/calendar">{more} more this week</Link>}

                {(week.decisionsLoading || week.decisionsError || decisions.length > 0) && <div className="gk-home-week__waiting">
                    <p className="gk-home-week__label">Waiting for you{waitingTotal > 0 && <span className="gk-num"> · {waitingTotal}{week.decisionsPartial ? '+' : ''}</span>}</p>
                    {week.decisionsLoading ? <div className="gk-home-week__loading"><Skeleton height={44} /></div>
                        : week.decisionsError ? <p className="gk-notice gk-notice--danger gk-home-week__notice" role="alert">{week.decisionsError} <Button size="sm" onClick={week.retryDecisions}>Try again</Button></p>
                            : <List label="Waiting for you">{decisions.map(item => {
                                const Icon = requestIcon(item.family);
                                return <ListRow key={item.key} to={requestDestination(item.destination) ?? '/requests?view=INCOMING'} lead={<span className="gk-home-week__icon"><Icon aria-hidden="true" /></span>}
                                    title={item.title} meta={item.context} trail={<span className="gk-home-week__action">{item.actionLabel}</span>} />;
                            })}</List>}
                    {waitingTotal > decisions.length && !week.decisionsLoading && !week.decisionsError && <Link className="gk-home-week__more" to="/requests?view=INCOMING">See all {waitingTotal}{week.decisionsPartial ? '+' : ''} in your inbox</Link>}
                </div>}
            </div>
        </Section>
    );
}
